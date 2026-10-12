"""Audio decoding/encoding.

- ``decode``: any audio/video file -> float32 array of shape (2, n) at 44.1 kHz, using the
  ffmpeg binary bundled with the ``imageio-ffmpeg`` package (no separate install needed).
- ``write_wav16``: 16-bit PCM WAV via soundfile (atomic, chunked, clipped).
- ``encode_mp3``: 320 kbps MP3 bytes via lameenc.
- ``compute_peaks``: waveform overview (max |sample| per bucket).
"""

from __future__ import annotations

import io
import logging
import os
import subprocess
import tempfile
from functools import lru_cache
from pathlib import Path
from typing import List, Tuple

import numpy as np
import soundfile as sf

from .fsutil import replace_with_retry, unlink_quiet

log = logging.getLogger("stem_player.audio")

SAMPLE_RATE = 44100
CHANNELS = 2
PEAK_BUCKETS = 1600
MP3_BITRATE = 320
MP3_QUALITY = 2
MIN_SAMPLES = SAMPLE_RATE // 10  # shorter than 0.1 s is not a song
# Longest file that is split. Demucs needs roughly 5 GB of RAM for 30 minutes of audio
# (and the browser about 3 GB to play 6 parts of it); a 2-hour concert video would
# otherwise make the PC swap for a very long time before failing.
MAX_SECONDS = 30 * 60
_CHUNK = 1 << 20  # frames per block when writing/encoding (keeps memory flat)
_READ_SIZE = 1 << 22  # bytes per read from ffmpeg (a multiple of the 8-byte frame size)

UNREADABLE_MESSAGE = (
    "Couldn't read this file as audio. It may be damaged, protected, or not a "
    "music/video file. Try a different file (MP3, WAV, FLAC, M4A, OGG...)."
)


class AudioDecodeError(Exception):
    """The file couldn't be turned into audio. ``str(exc)`` is a short human message."""


@lru_cache(maxsize=1)
def ffmpeg_exe() -> str:
    """Path to the ffmpeg binary shipped with imageio-ffmpeg."""
    import imageio_ffmpeg

    return imageio_ffmpeg.get_ffmpeg_exe()


def _subprocess_kwargs() -> dict:
    if os.name == "nt":  # don't flash a console window for ffmpeg on Windows
        return {"creationflags": getattr(subprocess, "CREATE_NO_WINDOW", 0)}
    return {}


def _too_long_message(max_seconds: float) -> str:
    minutes = int(round(max_seconds / 60))
    return (f"This file is longer than {minutes} minutes, which is more than Stem Player can "
            "split at once. Cut it into shorter pieces (or pick a single song) and add those.")


def decode(path: os.PathLike | str, max_seconds: float | None = None) -> Tuple[np.ndarray, int]:
    """Decode an audio or video file to float32 stereo at 44.1 kHz.

    Returns ``(audio, 44100)`` with ``audio.shape == (2, n)``.
    Raises ``AudioDecodeError`` with a friendly message if the file can't be decoded or
    is longer than ``max_seconds`` (default ``MAX_SECONDS``; ``math.inf`` for no limit).

    ffmpeg's output is read in blocks and copied into the final (2, n) array block by
    block, freeing each block as it goes, so the peak memory is about one copy of the
    audio (not two or three), and an over-long file is stopped as soon as it passes
    the limit instead of being decoded completely first.
    """
    path = Path(path)
    if not path.is_file():
        raise AudioDecodeError("The uploaded file is missing from the library folder.")
    try:
        exe = ffmpeg_exe()
    except Exception as exc:  # pragma: no cover - only when the install is broken
        log.exception("ffmpeg (imageio-ffmpeg) is not available")
        raise AudioDecodeError(
            "The audio decoder (ffmpeg) is missing. Delete the .venv folder and run "
            "Start Stem Player.bat again to repair the installation."
        ) from exc

    cmd = [
        exe, "-nostdin", "-hide_banner", "-loglevel", "error",
        "-i", str(path),
        "-vn", "-sn", "-dn",
        "-f", "f32le", "-acodec", "pcm_f32le",
        "-ac", str(CHANNELS), "-ar", str(SAMPLE_RATE),
        "pipe:1",
    ]
    frame_bytes = 4 * CHANNELS
    if max_seconds is None:
        max_seconds = MAX_SECONDS
    limit = None if max_seconds == float("inf") else int(max_seconds * SAMPLE_RATE) * frame_bytes
    blocks: List[bytes] = []
    total = 0
    too_long = False
    # stderr goes to a temp file: an undrained stderr pipe can deadlock ffmpeg when a
    # damaged file makes it print many errors.
    with tempfile.TemporaryFile() as errfile:
        try:
            proc = subprocess.Popen(cmd, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                                    stderr=errfile, **_subprocess_kwargs())
        except OSError as exc:
            log.exception("Could not start ffmpeg at %s", exe)
            raise AudioDecodeError("Couldn't start the audio decoder (ffmpeg).") from exc
        try:
            assert proc.stdout is not None
            while True:
                block = proc.stdout.read(_READ_SIZE)
                if not block:
                    break
                total += len(block)
                if limit is not None and total > limit:
                    too_long = True
                    break
                blocks.append(block)
        except BaseException:
            proc.kill()
            raise
        finally:
            if too_long:
                proc.kill()
            proc.stdout.close()
            returncode = proc.wait()
        errfile.seek(0, os.SEEK_END)
        errfile.seek(max(0, errfile.tell() - 4000))
        stderr_tail = errfile.read().decode("utf-8", "replace").strip()[-800:]

    if too_long:
        blocks.clear()
        raise AudioDecodeError(_too_long_message(max_seconds))

    usable = total - (total % frame_bytes)
    if returncode != 0:
        # Truncated/damaged files often still yield most of the audio: keep it if
        # there's at least a second, otherwise report the file as unreadable.
        if usable < frame_bytes * SAMPLE_RATE:
            log.warning("ffmpeg failed (%s) on %s: %s", returncode, path.name, stderr_tail)
            raise AudioDecodeError(UNREADABLE_MESSAGE)
        log.warning("ffmpeg reported errors on %s but produced audio; continuing: %s",
                    path.name, stderr_tail)

    if usable == 0:
        raise AudioDecodeError("This file doesn't contain any audio.")
    n = usable // frame_bytes
    if n < MIN_SAMPLES:
        raise AudioDecodeError("This file is too short to split (less than 0.1 seconds of audio).")

    # De-interleave block by block into the final planar array.
    audio = np.empty((CHANNELS, n), dtype=np.float32)
    blocks.reverse()  # pop() from the end = original order, O(1)
    pos = 0
    carry = b""
    while blocks and pos < n:
        block = blocks.pop()
        if carry:
            block = carry + block
        frames = min(len(block) // frame_bytes, n - pos)
        if frames:
            interleaved = np.frombuffer(block, dtype="<f4", count=frames * CHANNELS)
            target = audio[:, pos:pos + frames]
            target[...] = interleaved.reshape(frames, CHANNELS).T
            # per block: nan_to_num allocates full-size masks even with copy=False
            np.nan_to_num(target, copy=False, nan=0.0, posinf=1.0, neginf=-1.0)
            pos += frames
            del interleaved, target
        carry = block[frames * frame_bytes:]
        del block
    blocks.clear()
    if pos < n:  # pragma: no cover - defensive; the blocks always hold n frames
        audio = audio[:, :pos]
    return audio, SAMPLE_RATE


def duration_of(audio: np.ndarray, samplerate: int = SAMPLE_RATE) -> float:
    """Length in seconds of a (channels, n) array."""
    return round(audio.shape[-1] / float(samplerate), 3)


def _as_2d(audio: np.ndarray) -> np.ndarray:
    audio = np.asarray(audio)
    if audio.ndim == 1:
        audio = audio[None, :]
    if audio.ndim != 2:
        raise ValueError(f"expected audio of shape (channels, n), got {audio.shape}")
    return audio


def write_wav16(path: os.PathLike | str, audio: np.ndarray, samplerate: int = SAMPLE_RATE) -> None:
    """Write (channels, n) float audio as 16-bit PCM WAV. Samples are clipped to [-1, 1].

    The file is written next to the target and moved into place when complete.
    """
    audio = _as_2d(audio)
    path = Path(path)
    tmp = path.with_name(path.name + ".part")
    channels, n = audio.shape
    try:
        with sf.SoundFile(str(tmp), mode="w", samplerate=samplerate, channels=channels,
                          subtype="PCM_16", format="WAV") as fh:
            for start in range(0, n, _CHUNK):
                block = np.clip(audio[:, start:start + _CHUNK], -1.0, 1.0)
                fh.write(np.ascontiguousarray(block.T, dtype=np.float32))
        replace_with_retry(tmp, path)
    finally:
        if tmp.exists():
            unlink_quiet(tmp)


def wav16_bytes(audio: np.ndarray, samplerate: int = SAMPLE_RATE) -> bytes:
    """Same as ``write_wav16`` but returns the WAV file as bytes."""
    audio = _as_2d(audio)
    buf = io.BytesIO()
    channels, n = audio.shape
    with sf.SoundFile(buf, mode="w", samplerate=samplerate, channels=channels,
                      subtype="PCM_16", format="WAV") as fh:
        for start in range(0, n, _CHUNK):
            block = np.clip(audio[:, start:start + _CHUNK], -1.0, 1.0)
            fh.write(np.ascontiguousarray(block.T, dtype=np.float32))
    return buf.getvalue()


def read_wav(path: os.PathLike | str) -> Tuple[np.ndarray, int]:
    """Read a WAV (or any soundfile-supported file) as float32 (channels, n)."""
    data, sr = sf.read(str(path), dtype="float32", always_2d=True)
    return np.ascontiguousarray(data.T), int(sr)


def encode_mp3(audio: np.ndarray, samplerate: int = SAMPLE_RATE,
               bitrate: int = MP3_BITRATE, quality: int = MP3_QUALITY) -> bytes:
    """Encode (channels, n) float audio to MP3 bytes with lameenc (320 kbps, quality 2)."""
    import lameenc

    audio = _as_2d(audio)
    channels, n = audio.shape
    if channels > 2:
        raise ValueError("MP3 export supports mono or stereo only")
    encoder = lameenc.Encoder()
    encoder.set_bit_rate(int(bitrate))
    encoder.set_in_sample_rate(int(samplerate))
    encoder.set_channels(int(channels))
    encoder.set_quality(int(quality))
    out = bytearray()
    for start in range(0, n, _CHUNK):
        block = np.clip(audio[:, start:start + _CHUNK], -1.0, 1.0) * 32767.0
        pcm = np.ascontiguousarray(np.rint(block).T.astype("<i2"))  # interleaved int16
        out += encoder.encode(pcm.tobytes())
    out += encoder.flush()
    return bytes(out)


def compute_peaks(audio: np.ndarray, buckets: int = PEAK_BUCKETS) -> List[float]:
    """Waveform overview: ``buckets`` values in 0..1, each the max |sample| (any channel)."""
    audio = _as_2d(audio)
    buckets = max(1, int(buckets))
    n = audio.shape[1]
    if n == 0:
        return [0.0] * buckets
    # Loudest channel per frame, computed in blocks (no full-size temporary copies).
    env = np.empty(n, dtype=np.float32)
    for start in range(0, n, _CHUNK):
        env[start:start + _CHUNK] = np.abs(audio[:, start:start + _CHUNK]).max(axis=0)
    if n >= buckets:
        edges = np.linspace(0, n, buckets + 1).astype(np.int64)[:-1]  # strictly increasing
        peaks = np.maximum.reduceat(env, edges)
    else:
        idx = (np.arange(buckets) * n) // buckets
        peaks = env[idx]
    peaks = np.clip(np.nan_to_num(peaks, nan=0.0), 0.0, 1.0)
    return [round(float(v), 4) for v in peaks]
