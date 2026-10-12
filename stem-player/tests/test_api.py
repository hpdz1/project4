"""End-to-end API tests with the FakeSeparator and a temporary library."""

from __future__ import annotations

import io
import json
import re
import subprocess
import time
from pathlib import Path
from urllib.parse import quote

import numpy as np
import pytest
import soundfile as sf

from app import audio_io
from app.jobs import INTERRUPTED_MESSAGE
from app.library import ID_RE, Library
from app.separator import FakeSeparator

from helpers import upload, wait_for

SIX = ["vocals", "drums", "bass", "guitar", "piano", "other"]


def _read_wav_bytes(data: bytes):
    audio, sr = sf.read(io.BytesIO(data), dtype="float32", always_2d=True)
    return audio.T, sr


def _done_song(client, path, **kwargs) -> dict:
    resp = upload(client, path, **kwargs)
    assert resp.status_code == 201, resp.text
    return wait_for(client, resp.json()["song"]["id"])


# ---------------------------------------------------------------------------
# health / static
# ---------------------------------------------------------------------------

def test_health(make_client):
    client = make_client()
    body = client.get("/api/health").json()
    assert body["ok"] is True
    assert body["app"] == "stem-player"
    assert body["separator"] == "fake"
    assert body["separator_available"] is True and body["separator_status"] == "ready"
    assert body["device"] == "cpu"
    assert "demucs_version" in body
    ids = [m["id"] for m in body["models"]]
    assert ids == ["htdemucs_6s", "htdemucs_ft", "htdemucs"]
    six = body["models"][0]
    assert six["stems"] == SIX
    assert {"id", "label", "stems", "note"} <= set(six)


def test_static_index_and_unknown_api(make_client):
    client = make_client()
    resp = client.get("/")
    assert resp.status_code == 200
    assert "player" in resp.text
    assert resp.headers["cache-control"] == "no-cache"
    resp = client.get("/api/nope")
    assert resp.status_code == 404
    assert resp.json() == {"detail": "Not found."}


def test_static_mime_types(make_client, static_dir):
    (static_dir / "app.js").write_text("export const x = 1;\n", encoding="utf-8")
    (static_dir / "styles.css").write_text("body{}\n", encoding="utf-8")
    client = make_client()
    js = client.get("/app.js")
    assert js.status_code == 200
    assert js.headers["content-type"].startswith("text/javascript")
    assert client.get("/styles.css").headers["content-type"].startswith("text/css")
    assert client.get("/index.html").headers["content-type"].startswith("text/html")


def test_missing_static_folder_is_explained(make_client, static_dir):
    (static_dir / "index.html").unlink()
    client = make_client()
    r = client.get("/")
    assert r.status_code == 503 and "player files are missing" in r.text
    assert client.get("/api/health").status_code == 200


def test_local_only_guards(make_client):
    client = make_client()
    assert client.get("/api/songs", headers={"host": "evil.example:8765"}).status_code == 400
    resp = client.post("/api/songs", headers={"origin": "http://evil.example"},
                       files={"file": ("a.wav", b"x")})
    assert resp.status_code == 403
    resp = client.get("/api/songs")
    assert resp.status_code == 200
    assert resp.headers["cache-control"] == "no-store"


# ---------------------------------------------------------------------------
# the main flow
# ---------------------------------------------------------------------------

def test_full_flow_wav(make_client, song_wav, song_audio):
    client = make_client()
    resp = upload(client, song_wav)
    assert resp.status_code == 201, resp.text
    song = resp.json()["song"]
    assert song["status"] == "queued"
    assert song["title"] == "Test Song"
    assert song["original_filename"] == "Test Song.wav"
    assert song["model"] == "htdemucs_6s" and song["quality"] == "normal"
    assert ID_RE.match(song["id"]) and "-test-song-" in song["id"]
    assert re.match(r"^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$", song["created_at"])

    meta = wait_for(client, song["id"])
    assert meta["status"] == "done", meta
    assert meta["stage"] == "done" and meta["progress"] == 1.0 and meta["error"] is None
    assert meta["device"] == "cpu" and meta["samplerate"] == 44100
    assert meta["duration"] == pytest.approx(3.0, abs=0.01)
    names = [s["name"] for s in meta["stems"]]
    assert names == SIX
    by_name = {s["name"]: s for s in meta["stems"]}
    assert by_name["piano"]["detected"] is False
    for name in ("vocals", "drums", "bass", "other"):
        assert by_name[name]["detected"] is True, by_name[name]
    assert by_name["vocals"]["label"] == "Vocals"
    assert sum(s["energy_share"] for s in meta["stems"]) == pytest.approx(1.0, abs=0.01)

    # stems are 16-bit stereo 44.1k WAVs that add back up to the song
    total = None
    for name in names:
        r = client.get(f"/api/songs/{song['id']}/stems/{name}.wav")
        assert r.status_code == 200
        assert r.headers["content-type"] == "audio/wav"
        assert r.headers["accept-ranges"] == "bytes"
        info = sf.info(io.BytesIO(r.content))
        assert (info.samplerate, info.channels, info.subtype) == (44100, 2, "PCM_16")
        audio, _ = _read_wav_bytes(r.content)
        total = audio if total is None else total + audio
    original, _ = audio_io.decode(song_wav)
    assert np.max(np.abs(total - original)) < 0.002

    peaks = client.get(f"/api/songs/{song['id']}/peaks").json()
    assert set(peaks) == set(names)
    for values in peaks.values():
        assert len(values) == 1600
        assert all(0.0 <= v <= 1.0 for v in values)
    assert max(peaks["piano"]) < 0.001 < max(peaks["bass"])

    listed = client.get("/api/songs").json()["songs"]
    assert [s["id"] for s in listed] == [song["id"]]

    original_resp = client.get(f"/api/songs/{song['id']}/original")
    assert original_resp.status_code == 200
    assert original_resp.content == song_wav.read_bytes()


def test_mp3_upload_and_four_stem_model(make_client, song_mp3):
    client = make_client()
    meta = _done_song(client, song_mp3, model="htdemucs_ft", quality="high")
    assert meta["status"] == "done", meta
    assert meta["model"] == "htdemucs_ft" and meta["quality"] == "high"
    assert [s["name"] for s in meta["stems"]] == ["vocals", "drums", "bass", "other"]
    assert meta["duration"] == pytest.approx(3.0, abs=0.1)
    # a stem the model doesn't produce is a 404
    assert client.get(f"/api/songs/{meta['id']}/stems/piano.wav").status_code == 404


def test_songs_newest_first(make_client, song_wav):
    client = make_client()
    first = _done_song(client, song_wav, filename="First.wav")
    time.sleep(1.1)  # created_at has 1-second resolution
    second = _done_song(client, song_wav, filename="Second.wav")
    ids = [s["id"] for s in client.get("/api/songs").json()["songs"]]
    assert ids == [second["id"], first["id"]]


def test_undecodable_file_becomes_error(make_client, tmp_path):
    client = make_client()
    junk = tmp_path / "notes.txt"
    junk.write_text("this is not audio\n" * 100)
    resp = upload(client, junk)
    assert resp.status_code == 201
    meta = wait_for(client, resp.json()["song"]["id"])
    assert meta["status"] == "error"
    assert "Couldn't read this file as audio" in meta["error"]
    assert meta["stage"] == "decoding"


# ---------------------------------------------------------------------------
# downloads
# ---------------------------------------------------------------------------

def test_stem_download_headers_and_range(make_client, song_wav):
    client = make_client()
    meta = _done_song(client, song_wav)
    url = f"/api/songs/{meta['id']}/stems/vocals.wav"

    plain = client.get(url)
    assert "content-disposition" not in plain.headers
    size = len(plain.content)

    dl = client.get(url, params={"download": "1"})
    assert dl.status_code == 200
    assert dl.headers["content-disposition"] == 'attachment; filename="Test Song - Vocals.wav"'

    part = client.get(url, headers={"Range": "bytes=0-99"})
    assert part.status_code == 206
    assert len(part.content) == 100
    assert part.headers["content-range"] == f"bytes 0-99/{size}"
    assert part.content == plain.content[:100]

    tail = client.get(url, headers={"Range": f"bytes={size - 10}-"})
    assert tail.status_code == 206 and tail.content == plain.content[-10:]


def test_unicode_title_download_name(make_client, song_wav):
    client = make_client()
    name = "Caf\u00e9 \u2013 \u00dcn\u00efcode \u6b4c.wav"
    meta = _done_song(client, song_wav, filename=name)
    assert meta["title"] == "Caf\u00e9 \u2013 \u00dcn\u00efcode \u6b4c"
    assert meta["original_filename"] == name
    assert "-cafe-unicode-" in meta["id"]
    header = client.get(f"/api/songs/{meta['id']}/stems/bass.wav?download=1").headers["content-disposition"]
    expected = quote("Caf\u00e9 \u2013 \u00dcn\u00efcode \u6b4c - Bass.wav", safe="")
    assert header.startswith('attachment; filename="')
    assert header.endswith(f"filename*=UTF-8''{expected}")
    header.encode("latin-1")  # must be a valid header value


def test_unsafe_title_characters_in_download_name(make_client, song_wav):
    client = make_client()
    meta = _done_song(client, song_wav)
    r = client.patch(f"/api/songs/{meta['id']}", json={"title": 'AC/DC: "Live"?'})
    assert r.status_code == 200
    header = client.get(f"/api/songs/{meta['id']}/mix?stems=bass:1").headers["content-disposition"]
    assert header == 'attachment; filename="AC_DC_ _Live__ - custom mix.wav"'


def test_mix_wav_and_mp3(make_client, song_wav):
    client = make_client()
    meta = _done_song(client, song_wav)
    sid = meta["id"]
    bass, _ = _read_wav_bytes(client.get(f"/api/songs/{sid}/stems/bass.wav").content)

    # muting all but one stem gives (almost exactly) that stem
    r = client.get(f"/api/songs/{sid}/mix", params={"stems": "bass:1", "format": "wav"})
    assert r.status_code == 200
    assert r.headers["content-type"] == "audio/wav"
    assert r.headers["content-disposition"] == 'attachment; filename="Test Song - custom mix.wav"'
    only_bass, sr = _read_wav_bytes(r.content)
    assert sr == 44100 and only_bass.shape == bass.shape
    assert np.max(np.abs(only_bass - bass)) <= 2 / 32768

    # gains are applied
    r = client.get(f"/api/songs/{sid}/mix", params={"stems": "bass:0.5,vocals:0"})
    half, _ = _read_wav_bytes(r.content)
    assert np.max(np.abs(half - bass * 0.5)) <= 2 / 32768

    # everything at 200% is scaled down to a 0.999 peak instead of clipping
    loud = ",".join(f"{s['name']}:2" for s in meta["stems"])
    mixed, _ = _read_wav_bytes(client.get(f"/api/songs/{sid}/mix", params={"stems": loud}).content)
    peak = float(np.max(np.abs(mixed)))
    assert 0.99 <= peak <= 0.999

    # MP3
    r = client.get(f"/api/songs/{sid}/mix", params={"stems": "vocals:1,drums:0.6", "format": "mp3"})
    assert r.status_code == 200
    assert r.headers["content-type"] == "audio/mpeg"
    assert r.headers["content-disposition"] == 'attachment; filename="Test Song - custom mix.mp3"'
    head = r.content[:3]
    assert head == b"ID3" or (r.content[0] == 0xFF and r.content[1] & 0xE0 == 0xE0)
    mp3_path = Path(client.app_state.library.root) / "mix.mp3"
    mp3_path.write_bytes(r.content)
    decoded, _ = audio_io.decode(mp3_path)
    assert decoded.shape[1] / 44100 == pytest.approx(3.0, abs=0.1)
    assert float(np.max(np.abs(decoded))) <= 1.0


@pytest.mark.parametrize("query, status", [
    ({}, 400),
    ({"stems": ""}, 400),
    ({"stems": "nope:1"}, 400),
    ({"stems": "bass:3"}, 400),
    ({"stems": "bass:-0.1"}, 400),
    ({"stems": "bass:nan"}, 400),
    ({"stems": "bass:abc"}, 400),
    ({"stems": "bass:1,bass:0.5"}, 400),
    ({"stems": "../meta:1"}, 400),
    ({"stems": "bass:1", "format": "flac"}, 400),
    ({"stems": "bass,vocals:2"}, 200),
    ({"stems": "bass:0,vocals:2.0", "format": "MP3"}, 200),
])
def test_mix_validation(make_client, song_wav, query, status):
    client = make_client()
    meta = _done_song(client, song_wav)
    r = client.get(f"/api/songs/{meta['id']}/mix", params=query)
    assert r.status_code == status, r.text
    if status != 200:
        assert isinstance(r.json()["detail"], str)


def test_mix_requires_finished_song(make_client, song_wav):
    client = make_client(separator=FakeSeparator(step_delay=0.05, steps=200))
    sid = upload(client, song_wav).json()["song"]["id"]
    r = client.get(f"/api/songs/{sid}/mix", params={"stems": "bass:1"})
    assert r.status_code == 409
    client.post(f"/api/songs/{sid}/cancel")


# ---------------------------------------------------------------------------
# rename / cancel / retry / delete
# ---------------------------------------------------------------------------

def test_rename(make_client, song_wav):
    client = make_client()
    meta = _done_song(client, song_wav)
    url = f"/api/songs/{meta['id']}"
    r = client.patch(url, json={"title": "  My   new\tname \u266b "})
    assert r.status_code == 200
    assert r.json()["song"]["title"] == "My new name \u266b"
    assert client.get(url).json()["song"]["title"] == "My new name \u266b"
    assert client.patch(url, json={"title": "   "}).status_code == 400
    assert client.patch(url, json={"name": "x"}).status_code == 400
    assert client.patch(url, json={"title": 5}).status_code == 400
    bad = client.patch(url, content=b"not json", headers={"content-type": "application/json"})
    assert bad.status_code == 400 and isinstance(bad.json()["detail"], str)
    long = client.patch(url, json={"title": "x" * 500}).json()["song"]["title"]
    assert len(long) == 200


def test_cancel_processing_then_retry(make_client, song_wav):
    fake = FakeSeparator(step_delay=0.05, steps=400)
    client = make_client(separator=fake)
    sid = upload(client, song_wav).json()["song"]["id"]
    meta = wait_for(client, sid, statuses=("processing",),
                    predicate=lambda m: m["stage"] == "separating" and m["progress"] > 0.05)
    assert 0.05 < meta["progress"] < 0.95

    r = client.post(f"/api/songs/{sid}/cancel")
    assert r.status_code == 200
    assert r.json()["song"]["status"] == "cancelled"
    assert client.app_state.jobs.wait_idle(10)
    assert client.get(f"/api/songs/{sid}").json()["song"]["status"] == "cancelled"
    assert client.post(f"/api/songs/{sid}/cancel").status_code == 409

    fake.step_delay = 0.0
    r = client.post(f"/api/songs/{sid}/retry")
    assert r.status_code == 200
    song = r.json()["song"]
    assert song["status"] == "queued" and song["progress"] == 0.0 and song["error"] is None
    meta = wait_for(client, sid)
    assert meta["status"] == "done"
    assert client.post(f"/api/songs/{sid}/retry").status_code == 409


def test_cancel_queued_song(make_client, song_wav):
    fake = FakeSeparator(step_delay=0.02, steps=50)
    client = make_client(separator=fake)
    first = upload(client, song_wav, filename="One.wav").json()["song"]["id"]
    second = upload(client, song_wav, filename="Two.wav").json()["song"]["id"]
    assert client.get(f"/api/songs/{second}").json()["song"]["status"] == "queued"
    r = client.post(f"/api/songs/{second}/cancel")
    assert r.status_code == 200 and r.json()["song"]["status"] == "cancelled"
    assert wait_for(client, first)["status"] == "done"
    assert client.app_state.jobs.wait_idle(10)
    assert client.get(f"/api/songs/{second}").json()["song"]["status"] == "cancelled"
    assert fake.calls == 1


def test_delete(make_client, song_wav):
    client = make_client()
    meta = _done_song(client, song_wav)
    folder = Path(client.app_state.library.root) / meta["id"]
    assert folder.is_dir()
    r = client.delete(f"/api/songs/{meta['id']}")
    assert r.status_code == 200 and r.json() == {"ok": True}
    assert not folder.exists()
    assert client.get(f"/api/songs/{meta['id']}").status_code == 404
    assert client.get("/api/songs").json()["songs"] == []
    assert client.delete(f"/api/songs/{meta['id']}").status_code == 404


def test_delete_while_processing(make_client, song_wav):
    client = make_client(separator=FakeSeparator(step_delay=0.05, steps=400))
    sid = upload(client, song_wav).json()["song"]["id"]
    wait_for(client, sid, statuses=("processing",), predicate=lambda m: m["stage"] == "separating")
    assert client.delete(f"/api/songs/{sid}").json() == {"ok": True}
    assert client.get(f"/api/songs/{sid}").status_code == 404
    assert client.app_state.jobs.wait_idle(10)
    assert not (Path(client.app_state.library.root) / sid).exists()


# ---------------------------------------------------------------------------
# invalid input / path safety
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("path", [
    "/api/songs/..%2F..%2Fetc",
    "/api/songs/%2e%2e",
    "/api/songs/%2e%2e/peaks",
    "/api/songs/..%5Cwindows",
    "/api/songs/UPPERCASE",
    "/api/songs/has.dot",
    "/api/songs/" + "a" * 81,
    "/api/songs/does-not-exist",
    "/api/songs/does-not-exist/peaks",
    "/api/songs/does-not-exist/original",
    "/api/songs/does-not-exist/stems/vocals.wav",
    "/api/songs/%2e%2e/stems/vocals.wav",
    "/api/songs/..%2f..%2fstem-player/stems/vocals.wav",
])
def test_invalid_song_ids(make_client, path):
    client = make_client()
    r = client.get(path)
    assert r.status_code in (400, 404), (path, r.status_code)
    assert "root:" not in r.text


def test_invalid_stem_names(make_client, song_wav):
    client = make_client()
    meta = _done_song(client, song_wav)
    base = f"/api/songs/{meta['id']}"
    for stem in ("..%2Fmeta", "%2e%2e", "..%5C..%5Cmeta", "VOCALS", "nope", "meta", "..%2F..%2F..%2Frun"):
        r = client.get(f"{base}/stems/{stem}.wav")
        assert r.status_code in (400, 404), (stem, r.status_code)
        assert not r.content.startswith(b"RIFF")
    for method in ("patch", "delete"):
        r = getattr(client, method)("/api/songs/%2e%2e", **({"json": {"title": "x"}} if method == "patch" else {}))
        assert r.status_code == 404
    assert client.post("/api/songs/%2e%2e/cancel").status_code == 404
    assert client.post("/api/songs/%2e%2e/retry").status_code == 404


# ---------------------------------------------------------------------------
# uploads
# ---------------------------------------------------------------------------

def _song_dirs(client):
    root = Path(client.app_state.library.root)
    return [p for p in root.iterdir() if p.is_dir() and not p.name.startswith(".")]


def test_upload_limit_streaming(make_client, tmp_path):
    limit = 64 * 1024
    client = make_client(max_upload_bytes=limit)
    big = tmp_path / "big.wav"
    big.write_bytes(b"\0" * (limit + 10))  # within the Content-Length slack: caught while streaming
    r = upload(client, big)
    assert r.status_code == 413
    assert "too big" in r.json()["detail"]
    huge = tmp_path / "huge.wav"
    huge.write_bytes(b"\0" * (limit + 2 * 1024 * 1024))  # rejected from Content-Length
    assert upload(client, huge).status_code == 413
    assert _song_dirs(client) == []
    incoming = Path(client.app_state.library.root) / ".incoming"
    assert list(incoming.iterdir()) == []
    ok = tmp_path / "ok.wav"
    ok.write_bytes(b"\0" * (limit - 1))
    assert upload(client, ok).status_code == 201


def test_upload_limit_message(make_client):
    client = make_client()
    assert client.get("/api/health").json()["max_upload_mb"] == 500


@pytest.mark.parametrize("kwargs, detail", [
    ({"model": "mdx_extra"}, "Unknown model"),
    ({"quality": "ultra"}, "Quality"),
    ({"content": b""}, "empty"),
])
def test_upload_validation(make_client, song_wav, kwargs, detail):
    client = make_client()
    r = upload(client, song_wav, **kwargs)
    assert r.status_code == 400
    assert detail in r.json()["detail"]
    assert _song_dirs(client) == []
    assert list((Path(client.app_state.library.root) / ".incoming").iterdir()) == []


def test_upload_without_file(make_client):
    client = make_client()
    r = client.post("/api/songs", data={"model": "htdemucs_6s"}, files={"other": ("x.txt", b"x")})
    assert r.status_code == 400 and "No file" in r.json()["detail"]
    r = client.post("/api/songs", json={"file": "x"})
    assert r.status_code == 400
    r = client.post("/api/songs", content=b"--x\r\nbroken", headers={"content-type": "multipart/form-data; boundary=x"})
    assert r.status_code == 400


def test_upload_filename_with_path_and_unicode(make_client, song_wav):
    client = make_client()
    r = upload(client, song_wav, filename="C:\\fakepath\\Mi Canci\u00f3n.final.MP3")
    assert r.status_code == 201
    song = r.json()["song"]
    assert song["title"] == "Mi Canci\u00f3n.final"
    assert song["original_filename"] == "Mi Canci\u00f3n.final.MP3"
    folder = Path(client.app_state.library.root) / song["id"]
    assert (folder / "original.mp3").is_file()


# ---------------------------------------------------------------------------
# crash recovery
# ---------------------------------------------------------------------------

def test_crash_recovery_marks_unfinished_songs(make_client, tmp_path, song_wav):
    lib_dir = tmp_path / "crashed-library"
    library = Library(lib_dir)
    library.ensure()
    ids = {}
    for status in ("queued", "processing", "done"):
        tmp = library.incoming_dir() / f"{status}.part"
        tmp.write_bytes(song_wav.read_bytes())
        meta = library.create(upload_path=tmp, original_filename=f"{status}.wav",
                              model="htdemucs_6s", quality="normal")
        library.update(meta["id"], status=status, stage="separating" if status == "processing" else status)
        ids[status] = meta["id"]
    (library.incoming_dir() / "half-upload.part").write_bytes(b"partial")

    client = make_client(library_dir=lib_dir)
    for status in ("queued", "processing"):
        meta = client.get(f"/api/songs/{ids[status]}").json()["song"]
        assert meta["status"] == "error"
        assert meta["error"] == INTERRUPTED_MESSAGE == "Interrupted \u2014 click Retry"
    assert client.get(f"/api/songs/{ids['done']}").json()["song"]["status"] == "done"
    assert list((lib_dir / ".incoming").iterdir()) == []

    r = client.post(f"/api/songs/{ids['processing']}/retry")
    assert r.status_code == 200
    assert wait_for(client, ids["processing"])["status"] == "done"


def test_meta_json_on_disk_matches_api(make_client, song_wav):
    client = make_client()
    meta = _done_song(client, song_wav)
    on_disk = json.loads((Path(client.app_state.library.root) / meta["id"] / "meta.json").read_text("utf-8"))
    assert on_disk == meta
    folder = Path(client.app_state.library.root) / meta["id"]
    assert sorted(p.name for p in folder.iterdir()) == ["meta.json", "original.wav", "peaks.json", "stems"]
    assert sorted(p.name for p in (folder / "stems").iterdir()) == sorted(f"{n}.wav" for n in SIX)


def test_delete_during_saving_leaves_no_folder(make_client, song_wav, monkeypatch):
    """A delete that lands after the worker's last cancel check must not resurrect the
    song folder when the worker goes on to save the parts."""
    from app import jobs as jobs_module

    client = make_client()
    jobs = client.app_state.jobs
    real_analyze = jobs_module.analysis.analyze

    def analyze_then_delete(stems):
        jobs.delete(jobs.current_id)
        return real_analyze(stems)

    monkeypatch.setattr(jobs_module.analysis, "analyze", analyze_then_delete)
    sid = upload(client, song_wav).json()["song"]["id"]
    assert jobs.wait_idle(10)
    assert client.get(f"/api/songs/{sid}").status_code == 404
    assert not (Path(client.app_state.library.root) / sid).exists()
    assert _song_dirs(client) == []


# ---------------------------------------------------------------------------
# review fixes
# ---------------------------------------------------------------------------

def test_too_long_song_becomes_friendly_error(make_client, song_wav, monkeypatch):
    monkeypatch.setattr(audio_io, "MAX_SECONDS", 1.0)
    client = make_client()
    meta = _done_song(client, song_wav)
    assert meta["status"] == "error" and meta["stage"] == "decoding"
    assert "longer than" in meta["error"] and "shorter pieces" in meta["error"]


def test_cancelled_upload_is_quiet_and_leaves_nothing(tmp_path):
    """The browser's Cancel button aborts the request mid-body: no traceback in the
    console, no half-written file in .incoming."""
    import asyncio

    from starlette.requests import Request

    from app.uploads import UploadAborted, receive_upload

    boundary = "XyZ"
    head = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; "
            f"filename=\"a.mp3\"\r\nContent-Type: audio/mpeg\r\n\r\n").encode()
    messages = [
        {"type": "http.request", "body": head + b"\0" * 100_000, "more_body": True},
        {"type": "http.disconnect"},
    ]

    async def receive():
        return messages.pop(0)

    scope = {"type": "http", "method": "POST", "path": "/api/songs", "query_string": b"",
             "headers": [(b"content-type", f"multipart/form-data; boundary={boundary}".encode())]}
    incoming = tmp_path / ".incoming"
    incoming.mkdir()
    with pytest.raises(UploadAborted):
        asyncio.run(receive_upload(Request(scope, receive), incoming, 10_000_000))
    assert list(incoming.iterdir()) == []


def test_original_is_never_served_as_html(make_client, tmp_path):
    client = make_client()
    page = tmp_path / "page.html"
    page.write_text("<script>alert(1)</script>", encoding="utf-8")
    sid = upload(client, page).json()["song"]["id"]
    wait_for(client, sid)
    r = client.get(f"/api/songs/{sid}/original")
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/octet-stream"
    assert r.headers["x-content-type-options"] == "nosniff"


def test_delete_with_a_locked_file_finishes_later(make_client, song_wav, monkeypatch):
    """Windows can't delete a file another program has open (a stem being downloaded,
    a media player, antivirus). The song must disappear at once, keep its "deleted"
    marker until the very end, and its folder must be removed once the file is free -
    without waiting for the next start of Stem Player."""
    import os

    client = make_client()
    jobs = client.app_state.jobs
    monkeypatch.setattr(jobs, "PURGE_RETRY_INTERVAL", 0.2)
    meta = _done_song(client, song_wav)
    folder = Path(client.app_state.library.root) / meta["id"]

    real_unlink = os.unlink
    locked = {"on": True}

    def unlink(path, *args, **kwargs):
        if locked["on"] and os.fspath(path).endswith("vocals.wav"):
            raise PermissionError(13, "The process cannot access the file because it is "
                                      "being used by another process")
        return real_unlink(path, *args, **kwargs)

    monkeypatch.setattr(os, "unlink", unlink)
    r = client.delete(f"/api/songs/{meta['id']}")
    assert r.status_code == 200 and r.json() == {"ok": True}
    assert client.get(f"/api/songs/{meta['id']}").status_code == 404
    assert client.get("/api/songs").json()["songs"] == []
    assert sorted(p.name for p in folder.iterdir()) == [".deleted", "stems"]

    locked["on"] = False
    deadline = time.monotonic() + 5
    while folder.exists() and time.monotonic() < deadline:
        time.sleep(0.05)
    assert not folder.exists()
