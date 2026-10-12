"""Paths and settings.

Environment variables (all optional):

- ``STEM_PLAYER_LIBRARY``    folder that holds the songs (default: ``<stem-player>/library``)
- ``STEM_PLAYER_SEPARATOR``  ``demucs`` (default) or ``fake`` (fast, for tests/dev, no torch)
- ``STEM_PLAYER_PORT``       first port to try (default 8765)

Also read elsewhere: ``STEM_PLAYER_NO_BROWSER=1`` (run.py: don't open a browser window)
and ``STEM_PLAYER_FAKE_DELAY`` (separator.py: seconds per step of the fake separator).
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping, Optional

ROOT = Path(__file__).resolve().parent.parent
HOST = "127.0.0.1"  # localhost only, never 0.0.0.0
DEFAULT_PORT = 8765
MAX_UPLOAD_BYTES = 500 * 1024 * 1024  # 500 MB (as Windows Explorer counts them)
SEPARATORS = ("demucs", "fake")


class ConfigError(ValueError):
    """A setting from the environment is invalid (message is human-readable)."""


@dataclass(frozen=True)
class Settings:
    root: Path = ROOT
    library_dir: Path = ROOT / "library"
    static_dir: Path = ROOT / "static"
    separator: str = "demucs"
    host: str = HOST
    port: int = DEFAULT_PORT
    max_upload_bytes: int = MAX_UPLOAD_BYTES

    @classmethod
    def from_env(cls, environ: Optional[Mapping[str, str]] = None) -> "Settings":
        env = os.environ if environ is None else environ

        library = (env.get("STEM_PLAYER_LIBRARY") or "").strip()
        library_dir = Path(library).expanduser() if library else ROOT / "library"
        library_dir = library_dir.resolve()

        separator = (env.get("STEM_PLAYER_SEPARATOR") or "demucs").strip().lower()
        if separator not in SEPARATORS:
            raise ConfigError(
                f"STEM_PLAYER_SEPARATOR must be 'demucs' or 'fake', not {separator!r}."
            )

        port_text = (env.get("STEM_PLAYER_PORT") or "").strip()
        port = DEFAULT_PORT
        if port_text:
            try:
                port = int(port_text)
            except ValueError:
                raise ConfigError(f"STEM_PLAYER_PORT must be a number, not {port_text!r}.") from None
            if not 1 <= port <= 65535:
                raise ConfigError(f"STEM_PLAYER_PORT must be between 1 and 65535, not {port}.")

        return cls(library_dir=library_dir, separator=separator, port=port)


def model_cache_env(root: Path = ROOT) -> dict:
    """Environment defaults that keep downloaded AI model files inside the app folder
    (so deleting the folder removes everything) and turn off Hugging Face telemetry."""
    models = root / "models"
    return {
        "HF_HOME": str(models / "huggingface"),
        "TORCH_HOME": str(models / "torch"),
        "HF_HUB_DISABLE_TELEMETRY": "1",
        "HF_HUB_DISABLE_SYMLINKS_WARNING": "1",
    }
