"""Decide which separated parts are actually present in a song.

For each stem: ``rms_db = 20*log10(rms + 1e-12)`` over the whole stem (both channels) and
``energy_share = sum(stem^2) / sum over all stems(stem^2)``.
``detected = rms_db > -50 and energy_share >= 0.015``; ``other`` is always detected if
any audio exists.
"""

from __future__ import annotations

import math
from typing import Dict, Mapping

import numpy as np

RMS_DB_THRESHOLD = -50.0         # quieter than this is "essentially silent"
ENERGY_SHARE_THRESHOLD = 0.015   # less than 1.5% of the song's energy is "not really there"
ALWAYS_DETECTED = ("other",)     # the catch-all part is shown whenever there's any audio
ANY_AUDIO_DB = -90.0             # a stem louder than this means the song has audio
_EPS = 1e-12
_CHUNK = 1 << 20


def sum_squares(audio: np.ndarray) -> float:
    """Sum of squared samples, accumulated in float64 in chunks (no big temporaries)."""
    flat = np.ravel(audio)  # a view for contiguous arrays
    total = 0.0
    for start in range(0, flat.size, _CHUNK):
        block = flat[start:start + _CHUNK].astype(np.float64)
        total += float(np.dot(block, block))
    return total


def rms_db(audio: np.ndarray) -> float:
    count = max(1, int(np.asarray(audio).size))
    rms = math.sqrt(sum_squares(audio) / count)
    return 20.0 * math.log10(rms + _EPS)


def analyze(stems: Mapping[str, np.ndarray]) -> Dict[str, dict]:
    """Return ``{name: {"rms_db", "energy_share", "detected"}}`` for each stem."""
    energies = {name: sum_squares(audio) for name, audio in stems.items()}
    total = sum(energies.values())
    result: Dict[str, dict] = {}
    for name, audio in stems.items():
        count = max(1, int(np.asarray(audio).size))
        rms = math.sqrt(energies[name] / count)
        level = 20.0 * math.log10(rms + _EPS)
        share = energies[name] / total if total > 0 else 0.0
        result[name] = {
            "rms_db": level,
            "energy_share": share,
            "detected": level > RMS_DB_THRESHOLD and share >= ENERGY_SHARE_THRESHOLD,
        }
    any_audio = any(info["rms_db"] > ANY_AUDIO_DB for info in result.values())
    for name in ALWAYS_DETECTED:
        if name in result and any_audio:
            result[name]["detected"] = True
    for info in result.values():
        info["rms_db"] = round(info["rms_db"], 1)
        info["energy_share"] = round(info["energy_share"], 4)
    return result
