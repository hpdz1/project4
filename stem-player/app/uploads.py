"""Streaming multipart upload: the ``file`` part goes straight to disk while it arrives,
and the request is rejected as soon as it exceeds the size limit (never buffered in RAM).
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional

import anyio
from starlette.requests import ClientDisconnect, Request

try:
    from python_multipart.multipart import MultipartParser, parse_options_header
except ModuleNotFoundError:  # python-multipart < 0.0.13
    from multipart.multipart import MultipartParser, parse_options_header  # type: ignore

from .fsutil import unlink_quiet

log = logging.getLogger("stem_player.uploads")

FILE_FIELD = "file"
MAX_FIELD_BYTES = 4096
MAX_PARTS = 20
_SLACK = 1024 * 1024  # room for multipart boundaries/headers on top of the file itself


class UploadTooLarge(Exception):
    pass


class BadUpload(Exception):
    """The request isn't a usable upload. ``str(exc)`` is a short human message."""


class UploadAborted(Exception):
    """The browser went away mid-upload (e.g. the user clicked Cancel). Not an error."""


@dataclass
class ReceivedUpload:
    fields: Dict[str, str] = field(default_factory=dict)
    filename: Optional[str] = None
    path: Optional[Path] = None
    size: int = 0

    def discard(self) -> None:
        if self.path is not None:
            unlink_quiet(self.path)
            self.path = None


def _decode(raw: bytes) -> str:
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError:
        return raw.decode("latin-1")


class _State:
    def __init__(self, dest: Path, max_bytes: int) -> None:
        self.dest = dest
        self.max_bytes = max_bytes
        self.result = ReceivedUpload()
        self.header_name = b""
        self.header_value = b""
        self.disposition: Optional[bytes] = None
        self.mode = "skip"  # file | field | skip
        self.field_name = ""
        self.field_data = bytearray()
        self.pending: List[bytes] = []
        self.parts = 0
        self.file_done = False

    # python-multipart callbacks ---------------------------------------------------
    def on_part_begin(self) -> None:
        self.parts += 1
        if self.parts > MAX_PARTS:
            raise BadUpload("Too many form fields in the upload.")
        self.disposition = None
        self.mode = "skip"
        self.field_name = ""
        self.field_data = bytearray()

    def on_header_field(self, data: bytes, start: int, end: int) -> None:
        self.header_name += data[start:end]

    def on_header_value(self, data: bytes, start: int, end: int) -> None:
        self.header_value += data[start:end]

    def on_header_end(self) -> None:
        if self.header_name.strip().lower() == b"content-disposition":
            self.disposition = self.header_value
        self.header_name = b""
        self.header_value = b""

    def on_headers_finished(self) -> None:
        _kind, options = parse_options_header(self.disposition or b"")
        name = _decode(options.get(b"name", b""))
        if b"filename" in options:
            filename = _decode(options[b"filename"])
            if name == FILE_FIELD and not self.file_done and self.result.path is None and filename:
                self.mode = "file"
                self.result.filename = filename
                self.result.path = self.dest
            else:
                self.mode = "skip"  # extra/empty file inputs are ignored
        else:
            self.mode = "field"
            self.field_name = name

    def on_part_data(self, data: bytes, start: int, end: int) -> None:
        if self.mode == "file":
            self.result.size += end - start
            if self.result.size > self.max_bytes:
                raise UploadTooLarge()
            self.pending.append(bytes(data[start:end]))
        elif self.mode == "field":
            if len(self.field_data) + (end - start) > MAX_FIELD_BYTES:
                raise BadUpload("A form field in the upload is too long.")
            self.field_data += data[start:end]

    def on_part_end(self) -> None:
        if self.mode == "field" and self.field_name:
            self.result.fields[self.field_name] = _decode(bytes(self.field_data)).strip()
        elif self.mode == "file":
            self.file_done = True
        self.mode = "skip"

    def callbacks(self) -> dict:
        return {
            "on_part_begin": self.on_part_begin,
            "on_part_data": self.on_part_data,
            "on_part_end": self.on_part_end,
            "on_header_field": self.on_header_field,
            "on_header_value": self.on_header_value,
            "on_header_end": self.on_header_end,
            "on_headers_finished": self.on_headers_finished,
        }


async def receive_upload(request: Request, incoming_dir: Path, max_bytes: int) -> ReceivedUpload:
    """Parse a multipart/form-data request, streaming the ``file`` part to a temp file
    in ``incoming_dir``. Raises ``UploadTooLarge``, ``BadUpload`` or ``UploadAborted``."""
    content_type = request.headers.get("content-type", "")
    kind, params = parse_options_header(content_type)
    boundary = params.get(b"boundary")
    if kind.strip().lower() != b"multipart/form-data" or not boundary:
        raise BadUpload("Send the song as a file upload (multipart/form-data with a 'file' field).")

    length = request.headers.get("content-length")
    if length and length.strip().isdigit() and int(length) > max_bytes + _SLACK:
        raise UploadTooLarge()

    dest = Path(incoming_dir) / f"{uuid.uuid4().hex}.part"
    state = _State(dest, max_bytes)
    parser = MultipartParser(boundary, state.callbacks())
    handle = None
    try:
        handle = open(dest, "wb")
        async for chunk in request.stream():
            if not chunk:
                continue
            parser.write(chunk)
            if state.pending:
                data = b"".join(state.pending)
                state.pending.clear()
                await anyio.to_thread.run_sync(handle.write, data)
        parser.finalize()
        handle.close()
        handle = None
    except BaseException as exc:
        if handle is not None:
            handle.close()
        unlink_quiet(dest)
        state.result.path = None
        if isinstance(exc, (UploadTooLarge, BadUpload)):
            raise
        if isinstance(exc, ClientDisconnect):
            raise UploadAborted() from None
        if isinstance(exc, Exception) and type(exc).__module__.startswith(("python_multipart", "multipart")):
            raise BadUpload("The upload was malformed. Please try again.") from exc
        raise

    if state.result.path is None:
        unlink_quiet(dest)
    return state.result
