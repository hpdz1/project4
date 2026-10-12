from __future__ import annotations

import math
import subprocess

import numpy as np
import pytest
import soundfile as sf

from app import audio_io
from app.audio_io import AudioDecodeError


def test_decode_wav(song_wav, song_audio):
    audio, sr = audio_io.decode(song_wav)
    assert sr == 44100
    assert audio.dtype == np.float32 and audio.shape == song_audio.shape
    assert audio.flags.c_contiguous
    assert np.max(np.abs(audio - song_audio)) < 2 / 32768
    assert audio_io.duration_of(audio, sr) == pytest.approx(3.0)


def test_decode_mp3(song_mp3):
    audio, sr = audio_io.decode(song_mp3)
    assert sr == 44100 and audio.shape[0] == 2
    assert audio.shape[1] / sr == pytest.approx(3.0, abs=0.1)
    assert 0.5 < float(np.max(np.abs(audio))) <= 1.05


def test_decode_mono_48k_and_odd_names(tmp_path):
    t = np.arange(48000) / 48000
    mono = (0.5 * np.sin(2 * np.pi * 440 * t)).astype(np.float32)
    path = tmp_path / "dir with spaces" / "ünïcøde song (live) [48k].flac"
    path.parent.mkdir()
    sf.write(str(path), mono, 48000)
    audio, sr = audio_io.decode(path)
    assert sr == 44100 and audio.shape[0] == 2
    assert audio.shape[1] == pytest.approx(44100, abs=50)
    assert np.allclose(audio[0], audio[1])


def test_decode_video_with_audio(tmp_path, song_wav):
    video = tmp_path / "clip.mp4"
    subprocess.run(
        [audio_io.ffmpeg_exe(), "-nostdin", "-y", "-loglevel", "error",
         "-f", "lavfi", "-i", "color=c=black:s=64x64:r=10:d=3", "-i", str(song_wav),
         "-shortest", "-c:v", "mpeg4", "-c:a", "aac", str(video)],
        check=True,
    )
    audio, sr = audio_io.decode(video)
    assert audio.shape[1] / sr == pytest.approx(3.0, abs=0.15)


@pytest.mark.parametrize("content", [b"", b"hello, I am not audio" * 50, bytes(range(256)) * 40])
def test_decode_garbage(tmp_path, content):
    path = tmp_path / "bad.mp3"
    path.write_bytes(content)
    with pytest.raises(AudioDecodeError) as info:
        audio_io.decode(path)
    assert str(info.value)


def test_decode_missing_file(tmp_path):
    with pytest.raises(AudioDecodeError):
        audio_io.decode(tmp_path / "nope.wav")


def test_decode_video_without_audio(tmp_path):
    video = tmp_path / "silent.mp4"
    subprocess.run(
        [audio_io.ffmpeg_exe(), "-nostdin", "-y", "-loglevel", "error",
         "-f", "lavfi", "-i", "color=c=black:s=64x64:r=10:d=1", "-c:v", "mpeg4", str(video)],
        check=True,
    )
    with pytest.raises(AudioDecodeError):
        audio_io.decode(video)


def test_write_wav16_clips_and_is_atomic(tmp_path):
    audio = np.array([[0.0, 0.5, 1.5, -1.5, -0.25], [1.0, -1.0, 2.0, -3.0, 0.0]], dtype=np.float32)
    path = tmp_path / "sp ace" / "out.wav"
    path.parent.mkdir()
    audio_io.write_wav16(path, audio)
    info = sf.info(str(path))
    assert (info.samplerate, info.channels, info.subtype, info.frames) == (44100, 2, "PCM_16", 5)
    back, _ = audio_io.read_wav(path)
    assert back.shape == (2, 5)
    assert np.all(np.abs(back) <= 1.0)
    assert back[0, 2] == pytest.approx(1.0, abs=1e-4) and back[1, 3] == pytest.approx(-1.0, abs=1e-4)
    assert back[0, 1] == pytest.approx(0.5, abs=1e-4)
    assert [p.name for p in path.parent.iterdir()] == ["out.wav"]


def test_wav16_bytes_matches_file(tmp_path, song_audio):
    data = audio_io.wav16_bytes(song_audio)
    path = tmp_path / "x.wav"
    audio_io.write_wav16(path, song_audio)
    assert data == path.read_bytes()


def test_encode_mp3(tmp_path, song_audio):
    data = audio_io.encode_mp3(song_audio)
    assert len(data) > 1000
    # 320 kbps for 3 s is ~120 kB
    assert 100_000 < len(data) < 140_000
    path = tmp_path / "x.mp3"
    path.write_bytes(data)
    decoded, _ = audio_io.decode(path)
    assert decoded.shape[1] / 44100 == pytest.approx(3.0, abs=0.1)
    loud = audio_io.encode_mp3(song_audio * 4)  # out-of-range input is clipped, not wrapped
    assert len(loud) > 1000


def test_compute_peaks(song_audio):
    peaks = audio_io.compute_peaks(song_audio)
    assert len(peaks) == 1600
    assert all(0.0 <= v <= 1.0 for v in peaks)
    assert max(peaks) == pytest.approx(float(np.max(np.abs(song_audio))), abs=1e-4)
    loud = audio_io.compute_peaks(song_audio * 3, buckets=10)
    assert len(loud) == 10 and max(loud) == 1.0 and all(0.0 <= v <= 1.0 for v in loud)
    short = np.array([[0.1, -0.5, 0.2], [0.0, 0.0, 0.9]], dtype=np.float32)
    assert len(audio_io.compute_peaks(short)) == 1600
    assert max(audio_io.compute_peaks(short)) == pytest.approx(0.9)
    assert audio_io.compute_peaks(np.zeros((2, 0), np.float32), buckets=4) == [0.0] * 4


def test_decode_odd_read_sizes_match(song_wav, song_audio, monkeypatch):
    """ffmpeg output is read in blocks; blocks that split a frame must be stitched."""
    monkeypatch.setattr(audio_io, "_READ_SIZE", 4099)  # not a multiple of the 8-byte frame
    audio, _sr = audio_io.decode(song_wav)
    assert audio.shape == song_audio.shape and audio.flags.c_contiguous
    assert np.max(np.abs(audio - song_audio)) < 2 / 32768


def test_decode_replaces_nan_and_inf(tmp_path):
    x = np.zeros((44100, 2), np.float32)
    x[100, 0], x[200, 1], x[300, 0] = np.nan, np.inf, -np.inf
    x[400:, :] = 0.25
    path = tmp_path / "float.wav"
    sf.write(str(path), x, 44100, subtype="FLOAT")
    audio, _sr = audio_io.decode(path)
    assert np.all(np.isfinite(audio))
    assert audio[0, 100] == 0.0 and audio[1, 200] == 1.0 and audio[0, 300] == -1.0
    assert audio[0, 500] == pytest.approx(0.25)


def test_decode_rejects_files_over_the_length_limit(song_wav, monkeypatch):
    assert audio_io.MAX_SECONDS == 30 * 60
    with pytest.raises(AudioDecodeError) as info:
        audio_io.decode(song_wav, max_seconds=1)
    assert "longer than" in str(info.value) and "shorter pieces" in str(info.value)
    monkeypatch.setattr(audio_io, "MAX_SECONDS", 2.0)  # the default is read at call time
    with pytest.raises(AudioDecodeError):
        audio_io.decode(song_wav)
    assert audio_io.decode(song_wav, max_seconds=60)[0].shape[1] == 3 * 44100
    assert audio_io.decode(song_wav, max_seconds=math.inf)[0].shape[1] == 3 * 44100


def test_compute_peaks_blocks_match_reference(monkeypatch):
    rng = np.random.default_rng(3)
    audio = (rng.standard_normal((2, 100_003)) * 0.3).astype(np.float32)
    expected = np.abs(audio).max(axis=0)
    edges = np.linspace(0, audio.shape[1], 1601).astype(np.int64)[:-1]
    reference = [round(float(v), 4) for v in np.clip(np.maximum.reduceat(expected, edges), 0, 1)]
    monkeypatch.setattr(audio_io, "_CHUNK", 777)
    assert audio_io.compute_peaks(audio) == reference
