"""Source separation backends.

``Separator`` protocol::

    separate(audio, sr, model, quality, progress_cb, cancel_event) -> {name: (2, n) float32}

- ``DemucsSeparator`` wraps ``demucs.api.Separator`` (Demucs 4.1.0). torch/demucs are
  imported lazily so the server starts (and ``/api/health`` answers) even when they are
  missing or broken.
- ``FakeSeparator`` is a fast, deterministic stand-in for tests/dev (no torch needed).

Cancellation: Demucs is aborted by raising ``KeyboardInterrupt`` from its progress
callback; ``separate`` turns that into ``SeparationCancelled`` (a ``KeyboardInterrupt``
subclass, so code that only knows the Demucs convention still works).
"""

from __future__ import annotations

import gc
import logging
import os
import threading
import time
from collections import OrderedDict
from typing import Any, Callable, Dict, List, Optional, Protocol, Tuple

import numpy as np

log = logging.getLogger("stem_player.separator")

ProgressCallback = Callable[[float], None]

# ---------------------------------------------------------------------------
# Models and stems
# ---------------------------------------------------------------------------

DEFAULT_MODEL = "htdemucs_6s"
QUALITIES = ("normal", "high")
SHIFTS = {"normal": 1, "high": 2}

STEMS_6 = ["drums", "bass", "other", "vocals", "guitar", "piano"]  # htdemucs_6s order
STEMS_4 = ["drums", "bass", "other", "vocals"]

MODELS: List[dict] = [
    {
        "id": "htdemucs_6s",
        "label": "6 parts",
        "stems": STEMS_6,
        "note": "Vocals, drums, bass, guitar, piano and other. Recommended.",
    },
    {
        "id": "htdemucs_ft",
        "label": "4 parts - best quality",
        "stems": STEMS_4,
        "note": "Vocals, drums, bass and other. Cleanest result, about 4x slower.",
    },
    {
        "id": "htdemucs",
        "label": "4 parts - fast",
        "stems": STEMS_4,
        "note": "Vocals, drums, bass and other. Quickest.",
    },
]
MODEL_IDS = tuple(m["id"] for m in MODELS)
MODEL_STEMS = {m["id"]: list(m["stems"]) for m in MODELS}

STEM_LABELS = {
    "vocals": "Vocals",
    "drums": "Drums",
    "bass": "Bass",
    "guitar": "Guitar",
    "piano": "Piano",
    "other": "Other",
}
# Order of rows in the player: lead parts first, the catch-all "other" last.
DISPLAY_ORDER = ["vocals", "drums", "bass", "guitar", "piano", "other"]


def stem_label(name: str) -> str:
    return STEM_LABELS.get(name, name.replace("_", " ").title())


def display_order(names) -> List[str]:
    names = list(names)
    known = [n for n in DISPLAY_ORDER if n in names]
    return known + [n for n in names if n not in DISPLAY_ORDER]


def public_models() -> List[dict]:
    return [dict(m, stems=display_order(m["stems"])) for m in MODELS]


class SeparationCancelled(KeyboardInterrupt):
    """Raised by ``separate`` when ``cancel_event`` was set."""


VCREDIST_MESSAGE = (
    "A Windows component that the splitting engine needs is missing. Install the "
    "Microsoft Visual C++ Redistributable (x64) from "
    "https://aka.ms/vs/17/release/vc_redist.x64.exe, restart the PC and start Stem Player "
    "again. If that doesn't help, close Stem Player, delete the .venv folder and run "
    "Start Stem Player.bat again."
)


def is_dll_load_error(exc: BaseException) -> bool:
    """PyTorch failing to load its DLLs on Windows ("DLL load failed while importing _C",
    "[WinError 126] ... Error loading c10.dll"). The usual cause is a missing or outdated
    Microsoft Visual C++ Redistributable, which deleting .venv does not fix."""
    if getattr(exc, "winerror", None) in (126, 127, 1114):
        return True
    text = str(exc).lower()
    return "dll load failed" in text or (".dll" in text and "error loading" in text)


class Separator(Protocol):
    name: str
    last_device: Optional[str]

    @property
    def device(self) -> str: ...

    def info(self, wait: bool = True) -> dict: ...

    def prepare(self, model: str, quality: str) -> Any: ...

    def separate(self, audio: np.ndarray, sr: int, model: str, quality: str,
                 progress_cb: Optional[ProgressCallback],
                 cancel_event: Optional[threading.Event]) -> Dict[str, np.ndarray]: ...


def _check_model(model: str, quality: str) -> None:
    if model not in MODEL_STEMS:
        raise ValueError(f"Unknown model {model!r}")
    if quality not in SHIFTS:
        raise ValueError(f"Unknown quality {quality!r}")


def _to_stereo_f32(arr: Any) -> np.ndarray:
    arr = np.asarray(arr, dtype=np.float32)
    if arr.ndim == 1:
        arr = arr[None, :]
    if arr.ndim == 3 and arr.shape[0] == 1:  # (1, channels, n)
        arr = arr[0]
    if arr.ndim != 2:
        raise ValueError(f"unexpected stem shape {arr.shape}")
    if arr.shape[0] == 1:
        arr = np.repeat(arr, 2, axis=0)
    elif arr.shape[0] > 2:
        arr = arr[:2]
    return arr


# ---------------------------------------------------------------------------
# Demucs
# ---------------------------------------------------------------------------


class _DemucsProgress:
    """Turns Demucs callback dicts into one monotonic 0..1 progress value.

    progress = (model_idx_in_bag + (shift_idx + segment_offset/audio_length) / shifts) / models
    On a segment's "end" event the (estimated) segment stride is added so a finished
    segment counts as done. With shifts the shifted audio is slightly longer than
    ``audio_length``, hence the clamping.
    """

    def __init__(self, shifts: int) -> None:
        self.shifts = max(1, int(shifts))
        self.value = 0.0
        self.stride = 0
        self._last_start: Dict[Tuple[int, int], int] = {}

    def update(self, info: dict) -> float:
        models = max(1, int(info.get("models") or 1))
        model_idx = min(max(0, int(info.get("model_idx_in_bag") or 0)), models - 1)
        shift_idx = min(max(0, int(info.get("shift_idx") or 0)), self.shifts - 1)
        length = max(1, int(info.get("audio_length") or 1))
        offset = max(0, int(info.get("segment_offset") or 0))
        state = info.get("state")

        key = (model_idx, shift_idx)
        if state == "start":
            prev = self._last_start.get(key)
            if prev is not None and offset > prev:
                step = offset - prev
                self.stride = step if self.stride == 0 else min(self.stride, step)
            self._last_start[key] = offset
        position = offset + (self.stride if state == "end" else 0)
        seg_fraction = min(1.0, position / length)
        fraction = (model_idx + (shift_idx + seg_fraction) / self.shifts) / models
        self.value = max(self.value, min(1.0, max(0.0, fraction)))
        return self.value


class _ActiveRun:
    def __init__(self, progress_cb: Optional[ProgressCallback],
                 cancel_event: Optional[threading.Event], shifts: int) -> None:
        self.progress_cb = progress_cb
        self.cancel_event = cancel_event
        self.tracker = _DemucsProgress(shifts)

    def cancelled(self) -> bool:
        return self.cancel_event is not None and self.cancel_event.is_set()


def _dist_version(dist: str) -> Optional[str]:
    try:
        from importlib.metadata import version

        return version(dist)
    except Exception:
        return None


class DemucsSeparator:
    """Demucs 4.1.0 via ``demucs.api.Separator``; CUDA when available, else CPU."""

    name = "demucs"
    cache_size = 2  # loaded models kept in memory (normal/high share one: only shifts differ)

    def __init__(self, overlap: float = 0.25, segment: Optional[float] = None, jobs: int = 0) -> None:
        self.overlap = overlap
        self.segment = segment
        self.jobs = jobs
        self.last_device: Optional[str] = None
        self._lock = threading.RLock()          # model cache (held while a model loads)
        self._device_lock = threading.RLock()   # device detection / CPU fallback flag
        self._info_lock = threading.Lock()      # cached health info
        self._cache: "OrderedDict[str, Any]" = OrderedDict()
        self._device: Optional[str] = None
        self._force_cpu = False
        self._info: Optional[dict] = None
        self._active: Optional[_ActiveRun] = None

    # -- lazy imports ------------------------------------------------------
    @staticmethod
    def _modules():
        import torch  # noqa: F401  (heavy; imported only when needed)
        import demucs.api

        return torch, demucs.api

    @property
    def device(self) -> str:
        with self._device_lock:
            if self._force_cpu:
                return "cpu"
            if self._device is None:
                torch, _api = self._modules()
                device = "cpu"
                try:
                    if torch.cuda.is_available():
                        # Smoke test: a CUDA build can report a GPU it has no kernels for.
                        probe = torch.zeros(8, device="cuda")
                        float((probe + 1).sum())
                        device = "cuda"
                except Exception as exc:
                    log.warning("An NVIDIA GPU was found but can't be used (%s); using the CPU.", exc)
                self._device = device
            return self._device

    def info(self, wait: bool = True) -> dict:
        """Versions/device for /api/health. Never raises; cached after the first call.

        ``status`` is "ready", "unavailable" (torch/demucs missing or broken) or, with
        ``wait=False`` while torch is still being imported, "loading".
        """
        if not self._info_lock.acquire(blocking=wait):
            return {
                "status": "loading",
                "available": None,
                "device": None,
                "demucs_version": _dist_version("demucs"),
                "torch_version": _dist_version("torch"),
                "error": None,
            }
        try:
            if self._info is not None:
                return dict(self._info)
            info: Dict[str, Any] = {
                "status": "unavailable",
                "available": False,
                "device": None,
                "demucs_version": None,
                "torch_version": None,
                "error": None,
            }
            try:
                torch, _api = self._modules()
            except Exception as exc:  # ImportError, OSError (DLL load failed), ...
                log.warning("Demucs is unavailable: %s: %s", type(exc).__name__, exc)
                if is_dll_load_error(exc):
                    info["error"] = f"{VCREDIST_MESSAGE} ({type(exc).__name__}: {str(exc)[:200]})"
                else:
                    info["error"] = (
                        "Demucs (the splitting engine) is not installed or failed to load "
                        f"({type(exc).__name__}: {str(exc)[:200]}). Close Stem Player, delete "
                        "the .venv folder and run Start Stem Player.bat again."
                    )
                info["demucs_version"] = _dist_version("demucs")
                info["torch_version"] = _dist_version("torch")
            else:
                import demucs

                info["status"] = "ready"
                info["available"] = True
                info["demucs_version"] = _dist_version("demucs") or getattr(demucs, "__version__", None)
                info["torch_version"] = getattr(torch, "__version__", None)
                try:
                    info["device"] = self.device
                except Exception as exc:  # pragma: no cover - defensive
                    log.warning("Could not detect the compute device: %s", exc)
                    info["device"] = "cpu"
            self._info = info
            return dict(info)
        finally:
            self._info_lock.release()

    # -- model cache -------------------------------------------------------
    def prepare(self, model: str, quality: str) -> Any:
        """Load (or reuse) the Demucs separator for ``model``/``quality``.

        The first use of a model downloads its weights from Hugging Face (cached).
        """
        _check_model(model, quality)
        shifts = SHIFTS[quality]
        with self._lock:
            sep = self._cache.get(model)
            if sep is not None:
                self._cache.move_to_end(model)
                # Same weights for both qualities: just change the number of shifts
                # instead of loading (and holding) a second copy of the model.
                sep.update_parameter(shifts=shifts)
                return sep
            _torch, api = self._modules()
            device = self.device
            while len(self._cache) >= self.cache_size:
                self._cache.popitem(last=False)
                gc.collect()
            log.info("Loading AI model %s (%s quality) on %s...", model, quality, device)
            sep = api.Separator(
                model=model,
                device=device,
                shifts=shifts,
                overlap=self.overlap,
                split=True,
                segment=self.segment,
                jobs=self.jobs,
                progress=False,
                callback=self._callback,
            )
            self._cache[model] = sep
            return sep

    def _drop_cache(self) -> None:
        with self._lock:
            self._cache.clear()
        gc.collect()

    # -- callback ------------------------------------------------------------
    def _callback(self, info: dict) -> None:
        run = self._active
        if run is None:
            return
        if run.cancelled():
            raise KeyboardInterrupt  # Demucs' documented way to abort
        try:
            value = run.tracker.update(info)
            if run.progress_cb is not None:
                run.progress_cb(value)
        except Exception:  # progress reporting must never break the separation
            log.debug("progress callback failed", exc_info=True)
        if run.cancelled():
            raise KeyboardInterrupt

    # -- separation ----------------------------------------------------------
    def _run_once(self, sep: Any, wav: Any, sr: int, run: _ActiveRun) -> Dict[str, Any]:
        self._active = run
        try:
            _mix, stems = sep.separate_tensor(wav, sr)
            return stems
        except KeyboardInterrupt:
            if run.cancelled():
                raise SeparationCancelled() from None
            raise
        finally:
            self._active = None

    def separate(self, audio: np.ndarray, sr: int, model: str, quality: str,
                 progress_cb: Optional[ProgressCallback] = None,
                 cancel_event: Optional[threading.Event] = None) -> Dict[str, np.ndarray]:
        _check_model(model, quality)
        torch, _api = self._modules()
        run = _ActiveRun(progress_cb, cancel_event, SHIFTS[quality])
        if run.cancelled():
            raise SeparationCancelled()

        sep = self.prepare(model, quality)
        device = self.device
        wav = torch.from_numpy(np.ascontiguousarray(audio, dtype=np.float32))
        stems: Optional[Dict[str, Any]] = None
        gpu_error: Optional[str] = None
        try:
            stems = self._run_once(sep, wav, sr, run)
        except SeparationCancelled:
            raise
        except Exception as exc:
            if device != "cuda":
                raise
            gpu_error = f"{type(exc).__name__}: {str(exc)[:300]}"
        if gpu_error is not None:
            # GPU out of memory / driver trouble: finish this (and later) songs on the CPU.
            # This runs outside the except block on purpose: the traceback references the
            # failed attempt's frames, whose CPU-side buffers are several GB for a long song.
            log.warning("Splitting on the graphics card failed (%s). Using the processor "
                        "instead (slower) until Stem Player is restarted.", gpu_error)
            sep = None
            with self._device_lock:
                self._force_cpu = True
            with self._info_lock:
                self._info = None
            self._drop_cache()
            try:
                torch.cuda.empty_cache()
            except Exception:
                pass
            sep = self.prepare(model, quality)
            device = "cpu"
            stems = self._run_once(sep, wav, sr, run)
        assert stems is not None

        result: Dict[str, np.ndarray] = {}
        for name, tensor in stems.items():
            if hasattr(tensor, "detach"):
                tensor = tensor.detach().cpu().numpy()
            result[str(name)] = _to_stereo_f32(tensor)
        self.last_device = device
        return result


# ---------------------------------------------------------------------------
# Fake (tests / development)
# ---------------------------------------------------------------------------


class FakeSeparator:
    """Deterministic FFT band-split "separation". Fast; no torch needed.

    - bass:   everything below 250 Hz
    - drums:  everything above 5 kHz
    - vocals: the centre (mid) signal between 300 Hz and 3 kHz
    - guitar: the sides between 300 Hz and 3 kHz plus 3-5 kHz (6-stem model only)
    - piano:  the mix at -80 dB (near-silent, so it is reported as "not detected")
    - other:  the remainder, so all stems add up to the mix exactly
    """

    name = "fake"

    def __init__(self, step_delay: Optional[float] = None, steps: int = 20) -> None:
        if step_delay is None:
            step_delay = float(os.environ.get("STEM_PLAYER_FAKE_DELAY", "0.05"))
        self.step_delay = max(0.0, float(step_delay))
        self.steps = max(1, int(steps))
        self.last_device: Optional[str] = None
        self.calls = 0

    @property
    def device(self) -> str:
        return "cpu"

    def info(self, wait: bool = True) -> dict:
        return {
            "status": "ready",
            "available": True,
            "device": "cpu",
            "demucs_version": None,
            "torch_version": None,
            "error": None,
        }

    def prepare(self, model: str, quality: str) -> None:
        _check_model(model, quality)

    @staticmethod
    def _split(audio: np.ndarray, sr: int, names: List[str]) -> Dict[str, np.ndarray]:
        audio = np.asarray(audio, dtype=np.float32)
        n = audio.shape[1]
        spec = np.fft.rfft(audio.astype(np.float64), axis=1)
        freqs = np.fft.rfftfreq(n, 1.0 / sr)

        def band(lo: float, hi: float) -> np.ndarray:
            return ((freqs >= lo) & (freqs < hi)).astype(np.float64)

        def to_time(s: np.ndarray) -> np.ndarray:
            return np.fft.irfft(s, n=n, axis=1).astype(np.float32)

        mid = (spec[0] + spec[1]) / 2.0
        side = (spec[0] - spec[1]) / 2.0
        voice_band = band(300.0, 3000.0)

        out: Dict[str, np.ndarray] = {
            "bass": to_time(spec * band(0.0, 250.0)),
            "drums": to_time(spec * band(5000.0, np.inf)),
            "vocals": to_time(np.stack([mid, mid]) * voice_band),
        }
        if "guitar" in names:
            out["guitar"] = to_time(np.stack([side, -side]) * voice_band + spec * band(3000.0, 5000.0))
        if "piano" in names:
            out["piano"] = (audio * np.float32(1e-4)).astype(np.float32)
        rest = audio.copy()
        for part in out.values():
            rest -= part
        out["other"] = rest
        return {name: out[name] for name in names}

    def separate(self, audio: np.ndarray, sr: int, model: str, quality: str,
                 progress_cb: Optional[ProgressCallback] = None,
                 cancel_event: Optional[threading.Event] = None) -> Dict[str, np.ndarray]:
        _check_model(model, quality)
        self.calls += 1
        total = self.steps * SHIFTS[quality]
        for step in range(total):
            if cancel_event is not None and cancel_event.is_set():
                raise SeparationCancelled()
            if self.step_delay:
                time.sleep(self.step_delay)
            if progress_cb is not None:
                progress_cb((step + 1) / (total + 1))
        if cancel_event is not None and cancel_event.is_set():
            raise SeparationCancelled()
        result = self._split(audio, sr, MODEL_STEMS[model])
        if progress_cb is not None:
            progress_cb(1.0)
        self.last_device = "cpu"
        return result


def make_separator(kind: str) -> Separator:
    if kind == "fake":
        return FakeSeparator()
    if kind == "demucs":
        return DemucsSeparator()
    raise ValueError(f"Unknown separator {kind!r}")
