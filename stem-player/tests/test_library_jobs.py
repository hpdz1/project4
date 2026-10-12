from __future__ import annotations

import errno
import json
import threading
from pathlib import Path

import pytest

from app import library as lib
from app.jobs import INTERRUPTED_MESSAGE, JobConflict, JobManager, friendly_error
from app.library import Library, SongNotFound
from app.separator import FakeSeparator


def _add(library: Library, name: str = "My Song.mp3", content: bytes = b"data") -> dict:
    tmp = library.incoming_dir() / "upload.part"
    tmp.write_bytes(content)
    return library.create(upload_path=tmp, original_filename=name, model="htdemucs_6s", quality="normal")


@pytest.fixture
def library(tmp_path) -> Library:
    library = Library(tmp_path / "lib")
    library.ensure()
    return library


def test_titles_and_slugs():
    assert lib.title_from_filename("My Song.mp3") == "My Song"
    assert lib.title_from_filename("C:\\fakepath\\a.b.c.flac") == "a.b.c"
    assert lib.title_from_filename("/x/y/\u00c9t\u00e9  \u2014 \u65e5\u672c.m4a") == "\u00c9t\u00e9 \u2014 \u65e5\u672c"
    assert lib.title_from_filename("") == "Untitled"
    assert lib.title_from_filename("noext") == "noext"
    assert lib.title_from_filename("bad\x00\x07name.wav") == "bad name"
    assert lib.slugify("\u00c9t\u00e9 \u2014 \u65e5\u672c!") == "ete"
    assert lib.slugify("\u65e5\u672c") == "song"
    assert lib.slugify("A" * 100) == "a" * 40
    assert lib.extension_of("x.MP3") == "mp3"
    assert lib.extension_of("x") == "bin"
    assert lib.extension_of("x.m\u00e44") == "bin"
    assert lib.extension_of("x.../../etc") == "bin"


def test_create_get_list(library):
    meta = _add(library, "My Song.mp3", b"abc")
    assert lib.ID_RE.match(meta["id"])
    assert meta["id"].split("-")[2:-1] == ["my", "song"]
    assert len(meta["id"].split("-")[-1]) == 4
    folder = library.root / meta["id"]
    assert (folder / "original.mp3").read_bytes() == b"abc"
    assert json.loads((folder / "meta.json").read_text("utf-8")) == meta
    assert library.get(meta["id"]) == meta
    assert library.list() == [meta]
    assert library.original_path(meta["id"]) == (folder / "original.mp3").resolve()
    assert not list(library.incoming_dir().iterdir())


def test_path_safety(library):
    for bad in ("..", ".", "../x", "a/b", "A", "x" * 81, "", "a\\b", "%2e%2e", "a.b", None, 5):
        assert not lib.is_valid_id(bad)
        assert library.get(bad) is None
        with pytest.raises(SongNotFound):
            library.song_dir(bad)
    meta = _add(library)
    for bad in ("../meta", "..", "a/b", "A", "x" * 33, "", "meta.json", "a\\b"):
        with pytest.raises(SongNotFound):
            library.stem_path(meta["id"], bad)
    assert library.stem_path(meta["id"], "vocals").parent == library.stems_dir(meta["id"]).resolve()


def test_update_is_conditional_and_atomic(library):
    meta = _add(library)
    sid = meta["id"]
    assert library.update(sid, only_if_status=("processing",), progress=0.5) is None
    assert library.get(sid)["progress"] == 0.0
    assert library.update(sid, only_if_status=("queued",), progress=0.5)["progress"] == 0.5
    leftovers = [p.name for p in (library.root / sid).iterdir() if p.name.endswith(".tmp")]
    assert leftovers == []
    assert library.update("does-not-exist", progress=1) is None


def test_concurrent_updates_do_not_lose_writes(library):
    sid = _add(library)["id"]

    def bump(key):
        for i in range(50):
            library.mutate(sid, lambda m: m.__setitem__(key, m.get(key, 0) + 1))

    threads = [threading.Thread(target=bump, args=(f"k{i}",)) for i in range(4)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    meta = library.get(sid)
    assert [meta[f"k{i}"] for i in range(4)] == [50] * 4


def test_delete_and_cleanup(library):
    meta = _add(library)
    sid = meta["id"]
    assert library.delete(sid) is True
    assert library.get(sid) is None and library.list() == []
    assert not (library.root / sid).exists()
    # a folder whose deletion didn't finish (marker left behind) is hidden and purged at startup
    other = _add(library, "Other.wav")
    (library.root / other["id"] / lib.DELETED_MARKER).touch()
    (library.incoming_dir() / "stale.part").write_bytes(b"x")
    assert library.get(other["id"]) is None
    library.cleanup()
    assert not (library.root / other["id"]).exists()
    assert list(library.incoming_dir().iterdir()) == []


def test_corrupt_meta_is_skipped(library):
    good = _add(library, "Good.wav")
    bad = _add(library, "Bad.wav")
    (library.root / bad["id"] / "meta.json").write_text("{not json", encoding="utf-8")
    assert [m["id"] for m in library.list()] == [good["id"]]


def test_recover_interrupted(library):
    ids = {}
    for status in ("queued", "processing", "done", "error", "cancelled"):
        meta = _add(library, f"{status}.wav")
        library.update(meta["id"], status=status)
        ids[status] = meta["id"]
    jobs = JobManager(library, FakeSeparator(step_delay=0))
    assert sorted(jobs.recover_interrupted()) == sorted([ids["queued"], ids["processing"]])
    for status, sid in ids.items():
        meta = library.get(sid)
        if status in ("queued", "processing"):
            assert meta["status"] == "error" and meta["error"] == INTERRUPTED_MESSAGE
        else:
            assert meta["status"] == status


def test_job_conflicts(library):
    jobs = JobManager(library, FakeSeparator(step_delay=0))
    sid = _add(library)["id"]
    library.update(sid, status="done")
    with pytest.raises(JobConflict):
        jobs.cancel(sid)
    with pytest.raises(JobConflict):
        jobs.retry(sid)
    with pytest.raises(SongNotFound):
        jobs.cancel("nope")
    library.update(sid, status="error")
    (library.original_path(sid)).unlink()
    with pytest.raises(JobConflict):
        jobs.retry(sid)


def test_friendly_errors():
    assert "memory" in friendly_error(MemoryError(), "separating")
    assert "memory" in friendly_error(RuntimeError("CUDA out of memory. Tried to allocate"), "separating")
    cpu_oom = RuntimeError("[enforce fail at alloc_cpu.cpp:114] data. DefaultCPUAllocator: not "
                           "enough memory: you tried to allocate 4233600000 bytes.")
    assert "ran out of memory" in friendly_error(cpu_oom, "separating")
    assert "disk is full" in friendly_error(OSError(errno.ENOSPC, "No space left"), "saving")
    assert "internet" in friendly_error(OSError("Connection reset by peer"), "loading_model")
    assert "Demucs" in friendly_error(ModuleNotFoundError("No module named 'torch'"), "loading_model")
    message = friendly_error(ValueError("boom"), "separating")
    assert "splitting the song" in message and "ValueError: boom" in message and "Retry" in message
