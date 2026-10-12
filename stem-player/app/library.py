"""Song library on disk: ``library/<song_id>/`` with ``meta.json``, ``original.<ext>``,
``stems/<name>.wav`` and ``peaks.json``.

All meta.json reads and writes go through one lock, and writes are atomic (temp file +
``os.replace``), so the API and the worker thread never see half-written files.
Paths are only ever built from validated ids/names and checked to stay inside the
library folder.
"""

from __future__ import annotations

import logging
import os
import re
import secrets
import threading
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Collection, Dict, List, Optional

from .fsutil import atomic_write_json, read_json, replace_with_retry, rmtree_quiet, unlink_quiet

log = logging.getLogger("stem_player.library")

ID_RE = re.compile(r"^[a-z0-9-]{1,80}$")
STEM_NAME_RE = re.compile(r"^[a-z0-9_]{1,32}$")
EXT_RE = re.compile(r"^[a-z0-9]{1,10}$")
META_FILE = "meta.json"
PEAKS_FILE = "peaks.json"
STEMS_DIR = "stems"
DELETED_MARKER = ".deleted"
INCOMING_DIR = ".incoming"
MAX_TITLE_LENGTH = 200
SAMPLE_RATE = 44100

STATUSES = ("queued", "processing", "done", "error", "cancelled")
ACTIVE_STATUSES = ("queued", "processing")


class SongNotFound(LookupError):
    """No such song (or an invalid id)."""


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def clean_title(text: str) -> str:
    """Remove control characters, collapse whitespace, trim, cap the length."""
    text = "".join(" " if unicodedata.category(ch) in ("Cc", "Zl", "Zp") else ch for ch in str(text))
    text = re.sub(r"\s+", " ", text).strip()
    return text[:MAX_TITLE_LENGTH].strip()


def basename_of(filename: str) -> str:
    """Last path component of a browser-supplied filename (handles C:\\fakepath\\...)."""
    return re.split(r"[\\/]", str(filename or ""))[-1].strip()


def title_from_filename(filename: str) -> str:
    """``"My Song.mp3"`` -> ``"My Song"``; unicode is kept as-is."""
    base = basename_of(filename)
    stem, _ext = os.path.splitext(base)
    return clean_title(stem) or clean_title(base) or "Untitled"


def extension_of(filename: str) -> str:
    """Lower-case, sanitised extension for ``original.<ext>`` (``bin`` if unusable)."""
    _stem, ext = os.path.splitext(basename_of(filename))
    ext = ext.lower().lstrip(".")
    return ext if EXT_RE.match(ext) else "bin"


def slugify(text: str, max_length: int = 40) -> str:
    ascii_text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_text.lower()).strip("-")
    slug = slug[:max_length].strip("-")
    return slug or "song"


def is_valid_id(song_id: object) -> bool:
    return isinstance(song_id, str) and bool(ID_RE.match(song_id))


def is_valid_stem_name(name: object) -> bool:
    return isinstance(name, str) and bool(STEM_NAME_RE.match(name))


class Library:
    def __init__(self, root: os.PathLike | str) -> None:
        self.root = Path(root)
        self._lock = threading.RLock()

    # -- folders -------------------------------------------------------------
    @property
    def lock(self) -> threading.RLock:
        return self._lock

    def ensure(self) -> None:
        self.root.mkdir(parents=True, exist_ok=True)
        (self.root / INCOMING_DIR).mkdir(exist_ok=True)

    def incoming_dir(self) -> Path:
        path = self.root / INCOMING_DIR
        path.mkdir(parents=True, exist_ok=True)
        return path

    def cleanup(self) -> None:
        """Startup housekeeping: drop half-received uploads and half-deleted songs."""
        incoming = self.root / INCOMING_DIR
        if incoming.is_dir():
            for leftover in incoming.iterdir():
                if leftover.is_file():
                    unlink_quiet(leftover)
        self.purge_deleted()

    def purge_deleted(self, attempts: int = 1) -> int:
        """Try to remove song folders that were deleted but couldn't be removed yet
        (Windows: a file was still open). Returns how many are still left."""
        left = 0
        if not self.root.is_dir():
            return 0
        for child in self.root.iterdir():
            if child.is_dir() and is_valid_id(child.name) and (child / DELETED_MARKER).exists():
                if not rmtree_quiet(child, keep_last=DELETED_MARKER, attempts=attempts):
                    left += 1
        return left

    def _resolved_root(self) -> Path:
        return self.root.resolve()

    def song_dir(self, song_id: str) -> Path:
        """Folder of a song. Raises ``SongNotFound`` for invalid ids or unsafe paths."""
        if not is_valid_id(song_id):
            raise SongNotFound(song_id)
        root = self._resolved_root()
        path = (root / song_id).resolve()
        if path.parent != root:
            raise SongNotFound(song_id)
        return path

    def _meta_path(self, song_id: str) -> Path:
        return self.song_dir(song_id) / META_FILE

    def _is_deleted(self, folder: Path) -> bool:
        return (folder / DELETED_MARKER).exists()

    # -- read ----------------------------------------------------------------
    def get(self, song_id: str) -> Optional[dict]:
        """meta dict, or None if the song doesn't exist / is being deleted / is unreadable."""
        try:
            folder = self.song_dir(song_id)
        except SongNotFound:
            return None
        with self._lock:
            if not folder.is_dir() or self._is_deleted(folder):
                return None
            path = folder / META_FILE
            try:
                meta = read_json(path)
            except FileNotFoundError:
                return None
            except (OSError, ValueError) as exc:
                log.warning("Unreadable %s: %s", path, exc)
                return None
        if not isinstance(meta, dict) or meta.get("id") != song_id:
            return None
        return meta

    def require(self, song_id: str) -> dict:
        meta = self.get(song_id)
        if meta is None:
            raise SongNotFound(song_id)
        return meta

    def list(self) -> List[dict]:
        """All songs, newest first."""
        songs: List[dict] = []
        if not self.root.is_dir():
            return songs
        for child in self.root.iterdir():
            if child.is_dir() and is_valid_id(child.name):
                meta = self.get(child.name)
                if meta is not None:
                    songs.append(meta)
        songs.sort(key=lambda m: (str(m.get("created_at") or ""), str(m.get("id"))), reverse=True)
        return songs

    # -- create / update -----------------------------------------------------
    def new_id(self, title: str) -> str:
        stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
        slug = slugify(title)
        for _ in range(100):
            song_id = f"{stamp}-{slug}-{secrets.token_hex(2)}"
            if not (self.root / song_id).exists():
                return song_id
        raise RuntimeError("could not allocate a song id")

    def create(self, *, upload_path: Path, original_filename: str, model: str, quality: str) -> dict:
        """Move an uploaded file into a new song folder and write its meta (status queued)."""
        original_filename = clean_title(basename_of(original_filename)) or "upload"
        title = title_from_filename(original_filename)
        with self._lock:
            self.ensure()
            song_id = self.new_id(title)
            folder = self.song_dir(song_id)
            folder.mkdir()
            try:
                replace_with_retry(Path(upload_path), folder / f"original.{extension_of(original_filename)}")
                meta = {
                    "id": song_id,
                    "title": title,
                    "original_filename": original_filename,
                    "created_at": utc_now_iso(),
                    "model": model,
                    "quality": quality,
                    "status": "queued",
                    "stage": "queued",
                    "progress": 0.0,
                    "error": None,
                    "device": None,
                    "duration": None,
                    "samplerate": SAMPLE_RATE,
                    "stems": [],
                }
                self._write_meta(song_id, meta)
            except BaseException:
                rmtree_quiet(folder)
                raise
        return meta

    def _write_meta(self, song_id: str, meta: dict) -> None:
        atomic_write_json(self._meta_path(song_id), meta, fsync=True)

    def mutate(self, song_id: str, fn: Callable[[dict], Optional[bool]]) -> Optional[dict]:
        """Read-modify-write meta under the lock. ``fn`` edits the dict in place and may
        return False to skip writing. Returns the (new) meta, or None if the song is gone."""
        with self._lock:
            meta = self.get(song_id)
            if meta is None:
                return None
            if fn(meta) is False:
                return meta
            try:
                self._write_meta(song_id, meta)
            except FileNotFoundError:  # folder deleted meanwhile
                return None
            return meta

    def update(self, song_id: str, only_if_status: Optional[Collection[str]] = None,
               **changes) -> Optional[dict]:
        """Apply ``changes`` to meta. With ``only_if_status``, nothing is written unless the
        current status is one of those (returns None in that case)."""
        result: Dict[str, Optional[dict]] = {"meta": None}

        def apply(meta: dict) -> Optional[bool]:
            if only_if_status is not None and meta.get("status") not in only_if_status:
                return False
            meta.update(changes)
            result["meta"] = meta
            return None

        self.mutate(song_id, apply)
        return result["meta"]

    def set_title(self, song_id: str, title: str) -> Optional[dict]:
        return self.update(song_id, title=title)

    # -- files ---------------------------------------------------------------
    def original_path(self, song_id: str) -> Optional[Path]:
        folder = self.song_dir(song_id)
        if not folder.is_dir():
            return None
        candidates = sorted(
            p for p in folder.iterdir()
            if p.is_file() and p.name.startswith("original.") and not p.name.endswith((".part", ".tmp"))
        )
        return candidates[0] if candidates else None

    def stems_dir(self, song_id: str) -> Path:
        return self.song_dir(song_id) / STEMS_DIR

    def stem_path(self, song_id: str, stem: str) -> Path:
        """Path of a stem WAV; ``stem`` must be a valid name (callers check it is in
        ``meta.stems``). Raises ``SongNotFound`` if the name or path is unsafe."""
        if not is_valid_stem_name(stem):
            raise SongNotFound(f"{song_id}/{stem}")
        stems = self.stems_dir(song_id)
        path = (stems / f"{stem}.wav").resolve()
        if path.parent != stems.resolve():
            raise SongNotFound(f"{song_id}/{stem}")
        return path

    def peaks_path(self, song_id: str) -> Path:
        return self.song_dir(song_id) / PEAKS_FILE

    def write_peaks(self, song_id: str, peaks: dict) -> None:
        atomic_write_json(self.peaks_path(song_id), peaks, indent=None)

    # -- delete --------------------------------------------------------------
    def delete(self, song_id: str) -> bool:
        """Hide the song immediately (marker file) and remove its folder. If a file is
        still in use (e.g. by the worker), the folder is removed later."""
        folder = self.song_dir(song_id)
        with self._lock:
            if not folder.is_dir():
                return False
            try:
                (folder / DELETED_MARKER).touch()
            except OSError as exc:
                log.warning("Could not mark %s as deleted: %s", song_id, exc)
        return self.purge(song_id)

    def purge(self, song_id: str, force: bool = False) -> bool:
        """Remove a folder that was marked deleted (any folder with ``force``, used by
        the worker for a song deleted while it was being processed). Returns True if
        it is gone."""
        folder = self.song_dir(song_id)
        if not folder.exists():
            return True
        if not force and not self._is_deleted(folder):
            return False
        if force:
            try:  # so a folder that can't be removed right away stays hidden
                (folder / DELETED_MARKER).touch()
            except OSError:
                pass
        gone = rmtree_quiet(folder, keep_last=DELETED_MARKER)
        if not gone:
            try:  # belt and braces: the marker must survive a partial delete
                folder.mkdir(exist_ok=True)
                (folder / DELETED_MARKER).touch()
            except OSError:
                pass
        return gone

    def is_deleted(self, song_id: str) -> bool:
        try:
            folder = self.song_dir(song_id)
        except SongNotFound:
            return True
        return not folder.exists() or self._is_deleted(folder)
