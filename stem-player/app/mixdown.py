"""Custom mix: sum the chosen stems with gains, avoid clipping, render WAV or MP3.

Mix = sum(stem * gain). Gains are 0..2. If the mix peaks above 0.999 the whole mix is
scaled down so its peak is exactly 0.999 (no clipping, no limiter artefacts).
"""

from __future__ import annotations

import math
from pathlib import Path
from typing import Iterable, List, Sequence, Tuple

import numpy as np
import soundfile as sf

from . import audio_io

MIN_GAIN = 0.0
MAX_GAIN = 2.0
PEAK_LIMIT = 0.999
_GAIN_SLACK = 1e-6
FORMATS = {"wav": "audio/wav", "mp3": "audio/mpeg"}
_BLOCK = 1 << 18  # frames per block when reading stems for a mix

# float32(0.999) is a hair above 0.999; use the largest float32 that isn't.
_LIMIT32 = np.float32(PEAK_LIMIT)
if float(_LIMIT32) > PEAK_LIMIT:
    _LIMIT32 = np.nextafter(_LIMIT32, np.float32(0.0))


class MixSpecError(ValueError):
    """The ``stems=`` parameter is invalid. ``str(exc)`` is a short human message."""


def parse_mix_spec(spec: str | None, available: Sequence[str]) -> List[Tuple[str, float]]:
    """Parse ``"vocals:1,drums:0.6"`` into ``[("vocals", 1.0), ("drums", 0.6)]``.

    A missing gain means 1. Names must be in ``available``; gains must be within 0..2.
    """
    if spec is None or not spec.strip():
        raise MixSpecError("Choose at least one part to mix.")
    allowed = set(available)
    seen = set()
    result: List[Tuple[str, float]] = []
    for raw in spec.split(","):
        item = raw.strip()
        if not item:
            continue
        name, sep, gain_text = item.partition(":")
        name = name.strip()
        if name not in allowed:
            raise MixSpecError(f"Unknown part {name[:40]!r}.")
        if name in seen:
            raise MixSpecError(f"The part {name!r} is listed twice.")
        seen.add(name)
        if sep:
            try:
                gain = float(gain_text.strip())
            except ValueError:
                raise MixSpecError(f"Invalid volume for {name!r}.") from None
        else:
            gain = 1.0
        if not math.isfinite(gain) or not MIN_GAIN - _GAIN_SLACK <= gain <= MAX_GAIN + _GAIN_SLACK:
            raise MixSpecError(f"Volume for {name!r} must be between 0 and 2 (0-200%).")
        gain = min(MAX_GAIN, max(MIN_GAIN, gain))  # absorb float noise like 2.0000000000000004
        result.append((name, gain))
    if not result:
        raise MixSpecError("Choose at least one part to mix.")
    return result


def mix_arrays(parts: Iterable[Tuple[np.ndarray, float]]) -> np.ndarray:
    """Sum (channels, n) arrays with gains; scale down to PEAK_LIMIT if needed."""
    acc: np.ndarray | None = None
    for audio, gain in parts:
        audio = np.asarray(audio, dtype=np.float32)
        if acc is None:
            acc = np.zeros(audio.shape, dtype=np.float32)
        n = min(acc.shape[1], audio.shape[1])
        if n < acc.shape[1]:
            acc = acc[:, :n]
        if gain == 1.0:
            acc += audio[:, :n]
        elif gain != 0.0:
            acc += audio[:, :n] * np.float32(gain)
    if acc is None:
        raise MixSpecError("Choose at least one part to mix.")
    return _limit_peak(acc)


def _limit_peak(acc: np.ndarray) -> np.ndarray:
    """Scale the whole mix down (in place) if it peaks above PEAK_LIMIT."""
    peak = 0.0
    for start in range(0, acc.shape[-1], _BLOCK):
        peak = max(peak, float(np.max(np.abs(acc[:, start:start + _BLOCK]), initial=0.0)))
    if peak > PEAK_LIMIT:
        acc *= np.float32(float(_LIMIT32) / peak)
        # float32 rounding can leave a sample a hair above the limit
        np.clip(acc, -_LIMIT32, _LIMIT32, out=acc)
    return acc


def mix_files(paths_and_gains: Sequence[Tuple[Path, float]]) -> np.ndarray:
    """Mix stem WAVs (see ``mix_arrays``), reading them block by block straight into
    the mix buffer, so memory stays at about one copy of the result even for long songs.
    Muted stems aren't read (unless everything is muted: then the first one gives the
    length of the silent result)."""
    if not paths_and_gains:
        raise MixSpecError("Choose at least one part to mix.")
    audible = [(path, gain) for path, gain in paths_and_gains if gain != 0.0]
    chosen = audible or [(paths_and_gains[0][0], 0.0)]
    acc: np.ndarray | None = None
    for path, gain in chosen:
        with sf.SoundFile(str(path)) as fh:
            if acc is None:
                acc = np.zeros((fh.channels, fh.frames), dtype=np.float32)
            n = min(acc.shape[1], fh.frames)
            if n < acc.shape[1]:
                acc = acc[:, :n]
            if gain == 0.0:
                continue
            g = np.float32(gain)
            pos = 0
            for block in fh.blocks(blocksize=_BLOCK, dtype="float32", always_2d=True, frames=n):
                k = block.shape[0]
                if gain == 1.0:
                    acc[:, pos:pos + k] += block.T
                else:
                    acc[:, pos:pos + k] += block.T * g
                pos += k
    assert acc is not None
    return _limit_peak(np.ascontiguousarray(acc))


def render(audio: np.ndarray, fmt: str) -> bytes:
    if fmt == "wav":
        return audio_io.wav16_bytes(audio)
    if fmt == "mp3":
        return audio_io.encode_mp3(audio)
    raise MixSpecError("Format must be wav or mp3.")
