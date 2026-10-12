"""Shared fixtures. The tests use the FakeSeparator, so torch/demucs are not needed."""

from __future__ import annotations

import subprocess
import sys
import warnings
from contextlib import ExitStack
from pathlib import Path

import numpy as np
import pytest
import soundfile as sf

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

with warnings.catch_warnings():  # starlette 1.x nags about httpx vs httpx2; both work
    warnings.simplefilter("ignore")
    from fastapi.testclient import TestClient  # noqa: E402

from app import audio_io  # noqa: E402
from app.config import Settings  # noqa: E402
from app.main import create_app  # noqa: E402
from app.separator import FakeSeparator  # noqa: E402

from helpers import BASE_URL, SR, make_song  # noqa: E402


@pytest.fixture(scope="session")
def song_audio() -> np.ndarray:
    return make_song()


@pytest.fixture(scope="session")
def media_dir(tmp_path_factory) -> Path:
    return tmp_path_factory.mktemp("media")


@pytest.fixture(scope="session")
def song_wav(media_dir: Path, song_audio: np.ndarray) -> Path:
    path = media_dir / "Test Song.wav"
    sf.write(str(path), song_audio.T, SR, subtype="PCM_16")
    return path


@pytest.fixture(scope="session")
def song_mp3(media_dir: Path, song_wav: Path) -> Path:
    path = media_dir / "Test Song.mp3"
    subprocess.run(
        [audio_io.ffmpeg_exe(), "-nostdin", "-y", "-loglevel", "error", "-i", str(song_wav),
         "-codec:a", "libmp3lame", "-b:a", "192k", str(path)],
        check=True,
    )
    return path


@pytest.fixture
def static_dir(tmp_path: Path) -> Path:
    path = tmp_path / "static"
    path.mkdir()
    (path / "index.html").write_text("<!doctype html><title>Stem Player</title><p>player</p>",
                                     encoding="utf-8")
    return path


@pytest.fixture
def make_client(tmp_path: Path, static_dir: Path):
    """Factory: ``make_client(separator=..., max_upload_bytes=..., library_dir=...)``.
    The app's lifespan (worker thread) runs for the client's lifetime."""
    stack = ExitStack()

    def factory(separator=None, max_upload_bytes=None, library_dir=None):
        kwargs = {}
        if max_upload_bytes is not None:
            kwargs["max_upload_bytes"] = max_upload_bytes
        settings = Settings(library_dir=Path(library_dir or tmp_path / "library"),
                            static_dir=static_dir, separator="fake", **kwargs)
        app = create_app(settings, separator or FakeSeparator(step_delay=0.0, steps=5))
        client = stack.enter_context(TestClient(app, base_url=BASE_URL))
        client.app_state = app.state  # type: ignore[attr-defined]
        return client

    yield factory
    stack.close()
