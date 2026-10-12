from __future__ import annotations

import math

import numpy as np
import pytest
import soundfile as sf

from app import analysis, mixdown
from app.mixdown import MixSpecError


def _tone(level_db: float, n: int = 44100) -> np.ndarray:
    amp = 10 ** (level_db / 20) * math.sqrt(2)  # sine RMS = amp / sqrt(2)
    t = np.arange(n) / 44100
    x = (amp * np.sin(2 * np.pi * 220 * t)).astype(np.float32)
    return np.stack([x, x])


def test_detection_rule():
    stems = {
        "vocals": _tone(-12),
        "drums": _tone(-14),
        "bass": _tone(-30),     # loud enough but < 1.5% of the energy -> not detected
        "piano": _tone(-60),    # below -50 dB -> not detected
        "guitar": np.zeros((2, 44100), np.float32),
        "other": _tone(-70),    # always detected when the song has audio
    }
    info = analysis.analyze(stems)
    assert info["vocals"]["detected"] and info["drums"]["detected"]
    assert not info["bass"]["detected"]
    assert info["bass"]["rms_db"] == pytest.approx(-30, abs=0.1)
    assert info["bass"]["energy_share"] < analysis.ENERGY_SHARE_THRESHOLD
    assert not info["piano"]["detected"]
    assert info["piano"]["rms_db"] == pytest.approx(-60, abs=0.1)
    assert not info["guitar"]["detected"]
    assert info["guitar"]["rms_db"] == pytest.approx(-240, abs=0.1)
    assert info["guitar"]["energy_share"] == 0
    assert info["other"]["detected"]
    assert sum(v["energy_share"] for v in info.values()) == pytest.approx(1.0, abs=1e-3)


def test_other_not_detected_for_silence():
    silent = {name: np.zeros((2, 1000), np.float32) for name in ("vocals", "other")}
    info = analysis.analyze(silent)
    assert not info["other"]["detected"] and not info["vocals"]["detected"]


def test_sum_squares_matches_numpy():
    x = np.random.default_rng(0).standard_normal((2, 3_000_000)).astype(np.float32)
    assert analysis.sum_squares(x) == pytest.approx(float(np.sum(x.astype(np.float64) ** 2)), rel=1e-9)
    assert analysis.sum_squares(x[:, ::3]) == pytest.approx(float(np.sum(x[:, ::3].astype(np.float64) ** 2)), rel=1e-9)


def test_parse_mix_spec():
    avail = ["vocals", "drums", "bass", "other"]
    assert mixdown.parse_mix_spec("vocals:1,drums:0.6", avail) == [("vocals", 1.0), ("drums", 0.6)]
    assert mixdown.parse_mix_spec(" bass , other:2 ,", avail) == [("bass", 1.0), ("other", 2.0)]
    assert mixdown.parse_mix_spec("bass:0", avail) == [("bass", 0.0)]
    assert mixdown.parse_mix_spec("bass:2.0000000000000004,other:-0", avail) == [("bass", 2.0), ("other", 0.0)]
    for bad in (None, "", " , ", "piano:1", "bass:2.01", "bass:-1", "bass:inf", "bass:nan",
                "bass:x", "bass:1,bass:1", "../x:1"):
        with pytest.raises(MixSpecError):
            mixdown.parse_mix_spec(bad, avail)


def test_mix_arrays_gain_and_peak_limit():
    a = np.full((2, 100), 0.4, np.float32)
    b = np.full((2, 100), -0.1, np.float32)
    out = mixdown.mix_arrays([(a, 1.0), (b, 2.0)])
    assert np.allclose(out, 0.2)
    loud = mixdown.mix_arrays([(a, 2.0), (a, 2.0)])  # 1.6 -> scaled to 0.999
    assert float(np.max(np.abs(loud))) == pytest.approx(0.999, abs=1e-6)
    assert float(np.max(np.abs(loud))) <= 0.999
    silent = mixdown.mix_arrays([(a, 0.0)])
    assert not silent.any()
    ragged = mixdown.mix_arrays([(a, 1.0), (b[:, :50], 1.0)])
    assert ragged.shape == (2, 50)


def test_mix_files_blockwise_matches_mix_arrays(tmp_path, monkeypatch):
    rng = np.random.default_rng(5)
    parts = []
    for i, n in enumerate((10_007, 10_007, 9_001)):  # last one shorter: mix is trimmed
        audio = (rng.standard_normal((2, n)) * 0.2).astype(np.float32)
        path = tmp_path / f"s{i}.wav"
        sf.write(str(path), audio.T, 44100, subtype="FLOAT")
        parts.append((path, audio))
    monkeypatch.setattr(mixdown, "_BLOCK", 1000)
    gains = [1.0, 0.6, 2.0]
    got = mixdown.mix_files([(path, g) for (path, _a), g in zip(parts, gains)])
    want = mixdown.mix_arrays([(a, g) for (_p, a), g in zip(parts, gains)])
    assert got.shape == want.shape == (2, 9_001) and got.flags.c_contiguous
    assert np.allclose(got, want, atol=1e-6)
    loud = mixdown.mix_files([(path, 2.0) for path, _a in parts])  # peak-limited
    assert 0.99 < float(np.max(np.abs(loud))) <= 0.999
    silent = mixdown.mix_files([(parts[0][0], 0.0), (parts[1][0], 0.0)])
    assert silent.shape == (2, 10_007) and not silent.any()
