"""One background worker thread that splits songs one at a time (FIFO).

Song states: queued -> processing (stages decoding, loading_model, separating, saving)
-> done | error | cancelled. ``meta.progress`` is the overall 0..1 progress of the song.

Every write the worker makes while processing is conditional on the song still being
``processing``, so a cancel/retry/delete from the API always wins over a worker that
is still winding down.
"""

from __future__ import annotations

import errno
import gc
import logging
import queue
import threading
import time
from typing import Dict, List, Optional

from . import analysis, audio_io
from .audio_io import AudioDecodeError
from .library import Library, SongNotFound, is_valid_stem_name
from .separator import (VCREDIST_MESSAGE, SeparationCancelled, Separator, display_order,
                        is_dll_load_error, stem_label)

log = logging.getLogger("stem_player.jobs")

INTERRUPTED_MESSAGE = "Interrupted — click Retry"
PROGRESS_WRITE_INTERVAL = 0.5  # seconds between progress writes to meta.json

# Overall progress at the start of each stage (separating fills 0.05..0.95).
STAGE_START = {"decoding": 0.0, "loading_model": 0.03, "separating": 0.05, "saving": 0.95}
SEPARATING_SPAN = (0.05, 0.95)
STAGE_TEXT = {
    "queued": "waiting",
    "decoding": "reading the file",
    "loading_model": "loading the AI model",
    "separating": "splitting the song",
    "saving": "saving the parts",
}


class JobConflict(Exception):
    """The requested action doesn't fit the song's current state (HTTP 409)."""


class _Run:
    def __init__(self, song_id: str, title: str, model: str, quality: str) -> None:
        self.song_id = song_id
        self.title = title
        self.model = model
        self.quality = quality
        self.cancel = threading.Event()
        self.deleted = False
        self.stage = "decoding"
        self.progress = 0.0
        self.last_write = 0.0
        self.started = time.monotonic()


def friendly_error(exc: BaseException, stage: str) -> str:
    """Short, human message for meta.error (the traceback goes to the log)."""
    name = type(exc).__name__
    text = str(exc)
    lowered = f"{name} {text}".lower()
    memory_words = ("out of memory", "outofmemory", "not enough memory", "cannot allocate memory",
                    "can't allocate memory", "unable to allocate", "defaultcpuallocator",
                    "bad_alloc")
    if isinstance(exc, MemoryError) or any(word in lowered for word in memory_words):
        return ("Your PC ran out of memory while splitting this song. Close other programs "
                "and click Retry, or try a shorter song.")
    if isinstance(exc, OSError) and getattr(exc, "errno", None) == errno.ENOSPC:
        return "Your disk is full. Free up some space and click Retry."
    if is_dll_load_error(exc):
        return VCREDIST_MESSAGE
    if isinstance(exc, ImportError):
        return ("The splitting engine (Demucs) isn't installed properly. Close Stem Player, "
                "delete the .venv folder and run Start Stem Player.bat again.")
    if stage == "loading_model":
        network_words = ("connection", "timeout", "timed out", "resolve", "network", "http",
                         "ssl", "proxy", "offline", "localentrynotfound", "urlopen")
        if any(word in lowered for word in network_words):
            return ("Couldn't download the AI model. Check your internet connection and click "
                    "Retry (the download is only needed the first time).")
        return f"Couldn't load the AI model ({name}: {text[:160]}). Click Retry to try again."
    detail = f"{name}: {text[:160]}" if text else name
    return f"Something went wrong while {STAGE_TEXT.get(stage, stage)} ({detail}). Click Retry to try again."


class JobManager:
    # While idle, retry removing deleted songs whose files were still in use (seconds).
    PURGE_RETRY_INTERVAL = 10.0

    def __init__(self, library: Library, separator: Separator) -> None:
        self.library = library
        self.separator = separator
        self._queue: "queue.Queue[Optional[str]]" = queue.Queue()
        self._lock = threading.RLock()
        self._current: Optional[_Run] = None
        self._thread: Optional[threading.Thread] = None
        self._stopping = threading.Event()
        self._idle = threading.Event()
        self._idle.set()

    # -- lifecycle -------------------------------------------------------------
    def start(self) -> None:
        self.recover_interrupted()
        if self._thread is not None and self._thread.is_alive():
            return
        self._stopping.clear()
        self._thread = threading.Thread(target=self._loop, name="stem-player-worker", daemon=True)
        self._thread.start()

    def stop(self, timeout: float = 5.0) -> None:
        self._stopping.set()
        with self._lock:
            if self._current is not None:
                self._current.cancel.set()
        self._queue.put(None)
        if self._thread is not None:
            self._thread.join(timeout)
            self._thread = None

    def recover_interrupted(self) -> List[str]:
        """Songs left queued/processing by a previous run (crash, window closed) become
        errors the user can retry."""
        recovered = []
        for meta in self.library.list():
            if meta.get("status") in ("queued", "processing"):
                if self.library.update(meta["id"], only_if_status=("queued", "processing"),
                                       status="error", error=INTERRUPTED_MESSAGE) is not None:
                    recovered.append(meta["id"])
        if recovered:
            log.info("Marked %d unfinished song(s) as interrupted.", len(recovered))
        return recovered

    # -- queries ---------------------------------------------------------------
    @property
    def current_id(self) -> Optional[str]:
        run = self._current
        return run.song_id if run is not None else None

    def wait_idle(self, timeout: float = 10.0) -> bool:
        """Wait until the worker has nothing in progress and the queue is empty (tests)."""
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            if self._idle.is_set() and self._queue.empty():
                return True
            time.sleep(0.02)
        return False

    # -- actions ---------------------------------------------------------------
    def enqueue(self, song_id: str) -> None:
        self._queue.put(song_id)

    def cancel(self, song_id: str) -> dict:
        with self._lock:
            meta = self.library.require(song_id)
            status = meta.get("status")
            if status not in ("queued", "processing"):
                raise JobConflict("This song isn't being processed, so there's nothing to cancel.")
            run = self._current
            if run is not None and run.song_id == song_id:
                run.cancel.set()
            new = self.library.update(song_id, only_if_status=("queued", "processing"), status="cancelled")
            if new is None:
                raise SongNotFound(song_id)
            log.info("Cancelled %r.", new.get("title"))
            return new

    def retry(self, song_id: str) -> dict:
        with self._lock:
            meta = self.library.require(song_id)
            if meta.get("status") not in ("error", "cancelled"):
                raise JobConflict("Only songs that failed or were cancelled can be retried.")
            if self.library.original_path(song_id) is None:
                raise JobConflict("The original file is missing, so this song can't be retried. "
                                  "Delete it and add the song again.")
            new = self.library.update(song_id, only_if_status=("error", "cancelled"),
                                      status="queued", stage="queued", progress=0.0,
                                      error=None, stems=[])
            if new is None:
                raise SongNotFound(song_id)
            self.enqueue(song_id)
            return new

    def delete(self, song_id: str) -> None:
        with self._lock:
            self.library.require(song_id)
            run = self._current
            if run is not None and run.song_id == song_id:
                run.deleted = True
                run.cancel.set()
            self.library.delete(song_id)

    # -- worker ------------------------------------------------------------------
    def _loop(self) -> None:
        last_purge = time.monotonic()
        while not self._stopping.is_set():
            try:
                song_id = self._queue.get(timeout=min(0.5, self.PURGE_RETRY_INTERVAL))
            except queue.Empty:
                if time.monotonic() - last_purge >= self.PURGE_RETRY_INTERVAL:
                    last_purge = time.monotonic()
                    try:
                        self.library.purge_deleted()
                    except Exception:  # housekeeping must never stop the worker
                        log.debug("purge_deleted failed", exc_info=True)
                continue
            if song_id is None:
                continue
            self._idle.clear()
            try:
                self._process(song_id)
            except BaseException:  # the worker must survive anything
                log.exception("Unexpected error in the worker for %s", song_id)
            finally:
                self._idle.set()

    def _claim(self, song_id: str) -> Optional[_Run]:
        with self._lock:
            if self._stopping.is_set():
                return None
            meta = self.library.get(song_id)
            if meta is None or meta.get("status") != "queued":
                return None  # cancelled/deleted while waiting, or a duplicate queue entry
            run = _Run(song_id, meta.get("title") or song_id, meta["model"], meta["quality"])
            updated = self.library.update(song_id, only_if_status=("queued",), status="processing",
                                          stage="decoding", progress=0.0, error=None, stems=[])
            if updated is None:
                return None
            self._current = run
            return run

    def _process(self, song_id: str) -> None:
        run = self._claim(song_id)
        if run is None:
            return
        log.info("Splitting %r (%s, %s quality)...", run.title, run.model, run.quality)
        try:
            self._execute(run)
        except KeyboardInterrupt:  # includes SeparationCancelled
            if self._stopping.is_set() and not run.deleted:
                self._finish(run, status="error", error=INTERRUPTED_MESSAGE)
            else:
                self._finish(run, status="cancelled")
            log.info("Stopped %r.", run.title)
        except AudioDecodeError as exc:
            log.warning("Could not decode %r: %s", run.title, exc)
            self._finish(run, status="error", error=str(exc))
        except Exception as exc:
            if run.cancel.is_set():
                self._finish(run, status="cancelled")
            else:
                log.exception("Failed while %s %r", STAGE_TEXT.get(run.stage, run.stage), run.title)
                self._finish(run, status="error", error=friendly_error(exc, run.stage))
        finally:
            with self._lock:
                self._current = None
            if run.deleted or self.library.is_deleted(song_id):
                try:
                    self.library.purge(song_id, force=run.deleted)
                except SongNotFound:
                    pass
            gc.collect()

    # -- helpers ---------------------------------------------------------------------
    def _write(self, run: _Run, **changes) -> Optional[dict]:
        return self.library.update(run.song_id, only_if_status=("processing",), **changes)

    def _check(self, run: _Run) -> None:
        if run.cancel.is_set():
            raise SeparationCancelled()

    def _stage(self, run: _Run, stage: str, **extra) -> None:
        run.stage = stage
        run.progress = max(run.progress, STAGE_START.get(stage, run.progress))
        run.last_write = time.monotonic()
        self._write(run, stage=stage, progress=round(run.progress, 4), **extra)

    def _progress(self, run: _Run, value: float) -> None:
        value = min(1.0, max(run.progress, float(value)))
        run.progress = value
        now = time.monotonic()
        if now - run.last_write >= PROGRESS_WRITE_INTERVAL:
            run.last_write = now
            self._write(run, progress=round(value, 4))

    def _finish(self, run: _Run, **changes) -> None:
        self._write(run, **changes)

    def _execute(self, run: _Run) -> None:
        song_id = run.song_id

        # 1. Decode first: an unsupported file fails fast, before any model download.
        self._stage(run, "decoding")
        original = self.library.original_path(song_id)
        if original is None:
            raise AudioDecodeError("The uploaded file is missing from the library folder.")
        audio, sr = audio_io.decode(original)
        self._check(run)
        self._write(run, duration=audio_io.duration_of(audio, sr), samplerate=sr)

        # 2. Load the model (downloads weights on first use).
        self._stage(run, "loading_model")
        self.separator.prepare(run.model, run.quality)
        self._check(run)

        # 3. Separate.
        self._stage(run, "separating", device=self.separator.device)
        lo, hi = SEPARATING_SPAN
        stems = self.separator.separate(
            audio, sr, run.model, run.quality,
            lambda p: self._progress(run, lo + (hi - lo) * min(1.0, max(0.0, p))),
            run.cancel,
        )
        del audio
        self._check(run)

        # 4. Analyse and save.
        self._stage(run, "saving")
        names = display_order(stems.keys())
        for name in names:
            if not is_valid_stem_name(name):
                raise ValueError(f"unexpected stem name {name!r}")
        info = analysis.analyze(stems)
        # No parents=True: if the song was deleted meanwhile, don't recreate its folder.
        self.library.stems_dir(song_id).mkdir(exist_ok=True)
        peaks: Dict[str, list] = {}
        for index, name in enumerate(names):
            self._check(run)
            audio_io.write_wav16(self.library.stem_path(song_id, name), stems[name], sr)
            peaks[name] = audio_io.compute_peaks(stems[name])
            self._progress(run, 0.95 + 0.04 * (index + 1) / len(names))
        self._check(run)
        self.library.write_peaks(song_id, peaks)
        stems_meta = [
            {
                "name": name,
                "label": stem_label(name),
                "detected": bool(info[name]["detected"]),
                "rms_db": info[name]["rms_db"],
                "energy_share": info[name]["energy_share"],
            }
            for name in names
        ]
        device = getattr(self.separator, "last_device", None) or self.separator.device
        self._finish(run, status="done", stage="done", progress=1.0, error=None,
                     stems=stems_meta, device=device)
        elapsed = time.monotonic() - run.started
        found = [s["label"] for s in stems_meta if s["detected"]]
        log.info("Finished %r in %dm%02ds on %s. Parts found: %s.", run.title,
                 int(elapsed // 60), int(elapsed % 60), device, ", ".join(found) or "none")
