"""Plain helpers shared by the tests (fixtures live in conftest.py)."""

from __future__ import annotations

import time
from pathlib import Path

import numpy as np

SR = 44100
BASE_URL = "http://127.0.0.1:8765"
FINAL_STATUSES = ("done", "error", "cancelled")


def make_song(seconds: float = 3.0, sr: int = SR) -> np.ndarray:
    """A small stereo test song: sine bass, noise-burst drums, a centred 'vocal' tone."""
    t = np.arange(int(seconds * sr)) / sr
    bass = 0.30 * np.sin(2 * np.pi * 55 * t) + 0.15 * np.sin(2 * np.pi * 110 * t)
    vocal = 0.20 * np.sin(2 * np.pi * 440 * t + 3 * np.sin(2 * np.pi * 5 * t)) \
        + 0.08 * np.sin(2 * np.pi * 880 * t)
    rng = np.random.default_rng(1234)
    drums = np.zeros_like(t)
    hit = int(0.12 * sr)
    envelope = np.exp(-np.arange(hit) / (0.02 * sr))
    for start in np.arange(0.0, seconds, 0.5):
        i = int(start * sr)
        burst = rng.standard_normal(hit) * envelope * 0.5
        drums[i:i + hit] += burst[: max(0, len(drums) - i)]
    left = bass + vocal + drums
    right = bass + vocal + 0.7 * drums
    audio = np.stack([left, right])
    audio *= 0.9 / np.max(np.abs(audio))
    return audio.astype(np.float32)


def upload(client, path: Path, *, filename: str | None = None, model: str | None = None,
           quality: str | None = None, content: bytes | None = None):
    data = {}
    if model is not None:
        data["model"] = model
    if quality is not None:
        data["quality"] = quality
    body = content if content is not None else Path(path).read_bytes()
    files = {"file": (filename or Path(path).name, body, "application/octet-stream")}
    return client.post("/api/songs", data=data, files=files)


def wait_for(client, song_id: str, statuses=FINAL_STATUSES, timeout: float = 30.0,
             predicate=None) -> dict:
    deadline = time.monotonic() + timeout
    meta = None
    while time.monotonic() < deadline:
        resp = client.get(f"/api/songs/{song_id}")
        assert resp.status_code == 200, resp.text
        meta = resp.json()["song"]
        if meta["status"] in statuses and (predicate is None or predicate(meta)):
            return meta
        time.sleep(0.02)
    raise AssertionError(f"timed out waiting for {statuses}; last meta: {meta}")
