"""DemucsSeparator against minimal fake ``torch`` / ``demucs.api`` modules.

The fake ``Separator.separate_tensor`` drives the callback the way Demucs 4.1.0's
``apply_model`` does: for each model in the bag, each shift, each segment: a "start"
and an "end" event with model_idx_in_bag, shift_idx, segment_offset, state,
audio_length and models. With shifts the shifted audio is up to 0.5 s longer than
audio_length, so offsets can run past it.
"""

from __future__ import annotations

import sys
import threading
import time
import types
import weakref

import numpy as np
import pytest

from app.jobs import friendly_error
from app.separator import (DemucsSeparator, SeparationCancelled, _DemucsProgress)

SOURCES_6 = ["drums", "bass", "other", "vocals", "guitar", "piano"]


class FakeTensor:
    def __init__(self, array):
        self.array = np.asarray(array)

    @property
    def shape(self):
        return self.array.shape

    def detach(self):
        return self

    def cpu(self):
        return self

    def numpy(self):
        return self.array


class _Scratch:
    """Stands in for the multi-GB buffers of a separation attempt (weakref-able)."""


def install_fakes(monkeypatch, *, cuda=False, fail_on_cuda=False, probes=None):
    created = []
    probes = [] if probes is None else probes

    class FakeApiSeparator:
        def __init__(self, model, device, shifts, overlap, split, segment, jobs, progress,
                     callback=None, callback_arg=None):
            self.model_name, self.device, self.shifts = model, device, shifts
            self.callback = callback
            self.samplerate, self.audio_channels = 44100, 2
            self.bag = 4 if model == "htdemucs_ft" else 1
            self.sources = SOURCES_6 if model == "htdemucs_6s" else SOURCES_6[:4]
            self.alive_at_start = None
            created.append(self)

        def update_parameter(self, **kwargs):  # demucs.api.Separator.update_parameter
            for key, value in kwargs.items():
                setattr(self, key, value)

        def separate_tensor(self, wav, sr=None):
            assert isinstance(wav, FakeTensor) and wav.array.dtype == np.float32
            assert wav.shape[0] == 2 and sr == 44100
            self.alive_at_start = [ref() is not None for ref in probes]
            if fail_on_cuda and self.device == "cuda":
                scratch = _Scratch()  # referenced only by this (failing) frame
                probes.append(weakref.ref(scratch))
                raise RuntimeError("CUDA out of memory. Tried to allocate 2.00 GiB")
            length = wav.shape[1]
            stride = max(1, length // 4)
            for model_idx in range(self.bag):
                for shift_idx in range(self.shifts):
                    for offset in range(0, length + stride // 2, stride):
                        for state in ("start", "end"):
                            self.callback({
                                "model_idx_in_bag": model_idx, "shift_idx": shift_idx,
                                "segment_offset": offset, "state": state,
                                "audio_length": length, "models": self.bag,
                            })
            mix = wav.array
            return wav, {name: FakeTensor(mix * (i + 1) / 10) for i, name in enumerate(self.sources)}

    torch = types.ModuleType("torch")
    torch.__version__ = "2.99.0+fake"
    torch.from_numpy = FakeTensor
    torch.zeros = lambda n, device=None: np.zeros(n)
    torch.cuda = types.SimpleNamespace(is_available=lambda: cuda, empty_cache=lambda: None)

    api = types.ModuleType("demucs.api")
    api.Separator = FakeApiSeparator
    demucs = types.ModuleType("demucs")
    demucs.__version__ = "4.1.0"
    demucs.api = api
    monkeypatch.setitem(sys.modules, "torch", torch)
    monkeypatch.setitem(sys.modules, "demucs", demucs)
    monkeypatch.setitem(sys.modules, "demucs.api", api)
    return created


def _audio(n=44100):
    t = np.arange(n) / 44100
    return np.stack([np.sin(2 * np.pi * 110 * t), np.cos(2 * np.pi * 110 * t)]).astype(np.float64) * 0.5


@pytest.mark.parametrize("model, quality", [("htdemucs_6s", "normal"), ("htdemucs_ft", "high"),
                                            ("htdemucs", "high")])
def test_progress_is_monotonic_and_reaches_one(monkeypatch, model, quality):
    created = install_fakes(monkeypatch)
    sep = DemucsSeparator()
    values = []
    out = sep.separate(_audio(), 44100, model, quality, values.append, threading.Event())
    assert created[0].shifts == (2 if quality == "high" else 1)
    assert values and all(0.0 <= v <= 1.0 for v in values)
    assert values == sorted(values)
    assert values[-1] == pytest.approx(1.0)
    assert values[0] < 0.2
    # halfway through the callbacks, progress is roughly halfway (steps are coarse here)
    assert 0.25 <= values[len(values) // 2] <= 0.75
    assert set(out) == set(created[0].sources)


def test_output_conversion(monkeypatch):
    created = install_fakes(monkeypatch)
    sep = DemucsSeparator()
    audio = _audio(1000)
    out = sep.separate(audio, 44100, "htdemucs_6s", "normal", None, None)
    assert list(out) == SOURCES_6
    for i, name in enumerate(SOURCES_6):
        assert out[name].dtype == np.float32 and out[name].shape == (2, 1000)
        assert np.allclose(out[name], audio.astype(np.float32) * (i + 1) / 10, atol=1e-6)
    assert created[0].device == "cpu" and sep.last_device == "cpu"


def test_cancel_raises_keyboard_interrupt_from_callback(monkeypatch):
    install_fakes(monkeypatch)
    sep = DemucsSeparator()
    cancel = threading.Event()
    seen = []

    def progress(value):
        seen.append(value)
        if len(seen) == 3:
            cancel.set()

    with pytest.raises(SeparationCancelled) as info:
        sep.separate(_audio(), 44100, "htdemucs_6s", "normal", progress, cancel)
    assert isinstance(info.value, KeyboardInterrupt)  # what the job runner catches
    assert len(seen) == 3
    # the separator is reusable afterwards
    out = sep.separate(_audio(), 44100, "htdemucs_6s", "normal", None, threading.Event())
    assert len(out) == 6


def test_cancel_before_start(monkeypatch):
    created = install_fakes(monkeypatch)
    cancel = threading.Event()
    cancel.set()
    with pytest.raises(KeyboardInterrupt):
        DemucsSeparator().separate(_audio(), 44100, "htdemucs_6s", "normal", None, cancel)
    assert created == []


def test_model_cache_per_model(monkeypatch):
    created = install_fakes(monkeypatch)
    sep = DemucsSeparator()
    first = sep.prepare("htdemucs_6s", "normal")
    assert first.shifts == 1
    assert sep.prepare("htdemucs_6s", "normal") is first
    # High quality reuses the loaded model and only changes the number of shifts.
    assert sep.prepare("htdemucs_6s", "high") is first and first.shifts == 2
    assert sep.prepare("htdemucs_6s", "normal") is first and first.shifts == 1
    assert len(created) == 1
    fast = sep.prepare("htdemucs", "high")
    assert fast.shifts == 2 and len(created) == 2
    sep.prepare("htdemucs_ft", "normal")  # cache holds 2: the least recently used is dropped
    assert len(created) == 3
    assert sep.prepare("htdemucs", "normal") is fast
    assert sep.prepare("htdemucs_6s", "normal") is not first
    with pytest.raises(ValueError):
        sep.prepare("nope", "normal")


def test_high_quality_run_uses_two_shifts_after_normal(monkeypatch):
    created = install_fakes(monkeypatch)
    sep = DemucsSeparator()
    sep.separate(_audio(1000), 44100, "htdemucs_6s", "normal", None, None)
    assert created[-1].shifts == 1
    sep.separate(_audio(1000), 44100, "htdemucs_6s", "high", None, None)
    assert len(created) == 1 and created[0].shifts == 2


def test_cuda_device_and_info(monkeypatch):
    created = install_fakes(monkeypatch, cuda=True)
    sep = DemucsSeparator()
    info = sep.info()
    assert info == {"status": "ready", "available": True, "device": "cuda",
                    "demucs_version": "4.1.0", "torch_version": "2.99.0+fake", "error": None}
    sep.separate(_audio(1000), 44100, "htdemucs", "normal", None, None)
    assert created[0].device == "cuda" and sep.last_device == "cuda"


def test_gpu_failure_falls_back_to_cpu(monkeypatch):
    created = install_fakes(monkeypatch, cuda=True, fail_on_cuda=True)
    sep = DemucsSeparator()
    out = sep.separate(_audio(1000), 44100, "htdemucs_6s", "normal", None, None)
    assert len(out) == 6
    assert [s.device for s in created] == ["cuda", "cpu"]
    assert sep.last_device == "cpu" and sep.device == "cpu"
    assert sep.info()["device"] == "cpu"


def test_gpu_fallback_releases_failed_attempt_first(monkeypatch):
    """The CPU retry must not run while the GPU attempt's traceback (and the big buffers
    its frames hold) is still alive - that would double peak RAM for long songs."""
    probes = []
    created = install_fakes(monkeypatch, cuda=True, fail_on_cuda=True, probes=probes)
    sep = DemucsSeparator()
    sep.separate(_audio(1000), 44100, "htdemucs_6s", "normal", None, None)
    assert [s.device for s in created] == ["cuda", "cpu"]
    assert len(probes) == 1
    assert created[1].alive_at_start == [False]


def test_dll_load_failure_points_to_vc_redist(monkeypatch):
    def broken():
        raise OSError('[WinError 126] The specified module could not be found. Error loading '
                      '"C:\\Stem Player\\.venv\\Lib\\site-packages\\torch\\lib\\c10.dll" '
                      'or one of its dependencies.')

    sep = DemucsSeparator()
    monkeypatch.setattr(sep, "_modules", broken)
    info = sep.info()
    assert info["status"] == "unavailable"
    assert "Visual C++ Redistributable" in info["error"] and "c10.dll" in info["error"]
    message = friendly_error(ImportError("DLL load failed while importing _C: The specified "
                                         "module could not be found."), "loading_model")
    assert "Visual C++ Redistributable" in message


def test_missing_demucs_does_not_crash(monkeypatch):
    monkeypatch.setitem(sys.modules, "torch", None)
    monkeypatch.setitem(sys.modules, "demucs", None)
    monkeypatch.setitem(sys.modules, "demucs.api", None)
    info = DemucsSeparator().info()
    assert info["status"] == "unavailable"
    assert info["available"] is False and info["device"] is None
    assert "Demucs" in info["error"] and ".venv" in info["error"]


def test_health_endpoint_without_demucs(monkeypatch, make_client):
    monkeypatch.setitem(sys.modules, "torch", None)
    monkeypatch.setitem(sys.modules, "demucs", None)
    monkeypatch.setitem(sys.modules, "demucs.api", None)
    client = make_client(separator=DemucsSeparator())
    body = client.get("/api/health").json()
    assert body["ok"] is True and body["separator"] == "demucs"
    for _ in range(100):  # the start-up warm-up may still hold the info lock
        body = client.get("/api/health").json()
        if body["separator_status"] != "loading":
            break
        time.sleep(0.02)
    assert body["separator_status"] == "unavailable"
    assert body["separator_available"] is False and body["demucs_version"] is None
    assert "Demucs" in body["separator_error"]


def test_health_does_not_block_while_torch_loads(monkeypatch, make_client):
    install_fakes(monkeypatch)
    sep = DemucsSeparator()
    sep._info_lock.acquire()  # as if the start-up warm-up were still importing torch
    try:
        client = make_client(separator=sep)
        body = client.get("/api/health").json()
        assert body["separator_status"] == "loading"
        assert body["separator_available"] is True and body["device"] is None
        assert [m["id"] for m in body["models"]][0] == "htdemucs_6s"
    finally:
        sep._info_lock.release()
    for _ in range(100):
        body = client.get("/api/health").json()
        if body["separator_status"] == "ready":
            break
        time.sleep(0.02)
    assert body["separator_status"] == "ready" and body["device"] == "cpu"


def test_progress_tracker_with_shifted_offsets():
    tracker = _DemucsProgress(shifts=2)
    length, stride = 1000, 250
    values = []
    for shift in range(2):
        for offset in range(0, length + 300, stride):  # shifted audio runs past audio_length
            for state in ("start", "end"):
                values.append(tracker.update({"model_idx_in_bag": 0, "shift_idx": shift,
                                              "segment_offset": offset, "state": state,
                                              "audio_length": length, "models": 1}))
    assert values == sorted(values)
    assert values[-1] == 1.0
    assert max(v for v in values[: len(values) // 2]) <= 0.5 + 1e-9  # first shift fills half
    assert tracker.update({}) == 1.0  # missing keys don't break it
