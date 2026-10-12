"""Small file-system helpers that behave well on Windows.

On Windows, ``os.replace`` and deleting files can fail for a moment when another
program (antivirus, search indexer, a media player) has the file open, so these
helpers retry briefly instead of failing the whole operation.
"""

from __future__ import annotations

import json
import logging
import os
import shutil
import time
import uuid
from pathlib import Path
from typing import Any

log = logging.getLogger("stem_player.fs")

_RETRIES = 20
_RETRY_DELAY = 0.05


def replace_with_retry(src: Path, dst: Path) -> None:
    """``os.replace`` with a short retry loop for transient Windows sharing violations."""
    for attempt in range(_RETRIES):
        try:
            os.replace(src, dst)
            return
        except PermissionError:
            if attempt == _RETRIES - 1:
                raise
            time.sleep(_RETRY_DELAY)


def atomic_write_bytes(path: Path, data: bytes, *, fsync: bool = False) -> None:
    """Write ``data`` to ``path`` atomically: write a temp file next to it, then replace."""
    path = Path(path)
    tmp = path.with_name(f".{path.name}.{uuid.uuid4().hex[:8]}.tmp")
    try:
        with open(tmp, "wb") as fh:
            fh.write(data)
            if fsync:
                fh.flush()
                os.fsync(fh.fileno())
        replace_with_retry(tmp, path)
    finally:
        if tmp.exists():
            try:
                tmp.unlink()
            except OSError:
                pass


def atomic_write_json(path: Path, obj: Any, *, fsync: bool = False, indent: int | None = 2) -> None:
    text = json.dumps(obj, ensure_ascii=False, indent=indent, allow_nan=False)
    atomic_write_bytes(path, text.encode("utf-8"), fsync=fsync)


def read_json(path: Path) -> Any:
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


def _remove_tree_once(path: Path, keep_last: str | None) -> None:
    if keep_last is None:
        shutil.rmtree(path, ignore_errors=True)
        return
    try:
        children = list(path.iterdir())
    except OSError:
        return
    for child in children:
        if child.name == keep_last:
            continue
        if child.is_dir() and not child.is_symlink():
            shutil.rmtree(child, ignore_errors=True)
        else:
            try:
                child.unlink()
            except OSError:
                pass
    try:
        if any(child.name != keep_last for child in path.iterdir()):
            return  # something is still in use; keep the marker
        (path / keep_last).unlink(missing_ok=True)
        path.rmdir()
    except OSError:
        pass


def rmtree_quiet(path: Path, *, keep_last: str | None = None, attempts: int = 5) -> bool:
    """Delete a folder tree, retrying a few times. Returns True if it is gone.

    With ``keep_last``, that file (a "being deleted" marker) is removed only after
    everything else, so a folder that can't be fully deleted yet (Windows: a file is
    still open in another program) keeps its marker.
    """
    path = Path(path)
    for attempt in range(max(1, attempts)):
        if not path.exists():
            return True
        _remove_tree_once(path, keep_last)
        if not path.exists():
            return True
        if attempt < attempts - 1:
            time.sleep(0.1 * (attempt + 1))
    if path.exists():
        log.info("Could not fully delete %s yet (a file is in use); will retry.", path)
        return False
    return True


def unlink_quiet(path: Path) -> None:
    try:
        Path(path).unlink()
    except FileNotFoundError:
        pass
    except OSError as exc:
        log.warning("Could not delete %s: %s", path, exc)
