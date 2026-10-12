"""FastAPI app: JSON API under /api, the player UI (static/) at /.

Run via ``run.py`` (picks a port, opens the browser). For development:
``python -m uvicorn app.main:app --host 127.0.0.1 --port 8765``.
"""

from __future__ import annotations

import logging
import mimetypes
import re
import threading
import unicodedata
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Optional
from urllib.parse import quote, urlsplit

from fastapi import Body, FastAPI, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from starlette.concurrency import run_in_threadpool
from starlette.datastructures import Headers, MutableHeaders

from . import __version__, mixdown
from .config import Settings
from .jobs import JobConflict, JobManager
from .library import Library, SongNotFound, clean_title
from .mixdown import MixSpecError
from .separator import (DEFAULT_MODEL, MODEL_IDS, QUALITIES, Separator, make_separator,
                        public_models, stem_label)
from .uploads import BadUpload, UploadAborted, UploadTooLarge, receive_upload

log = logging.getLogger("stem_player")

LOCAL_HOSTNAMES = {"127.0.0.1", "localhost", "::1"}
UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
_WINDOWS_RESERVED = re.compile(r"^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$", re.IGNORECASE)


# ---------------------------------------------------------------------------
# MIME types
# ---------------------------------------------------------------------------

WEB_MIME_TYPES = {
    ".js": "text/javascript",
    ".mjs": "text/javascript",
    ".css": "text/css",
    ".html": "text/html",
    ".json": "application/json",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".webmanifest": "application/manifest+json",
    ".woff2": "font/woff2",
    ".wav": "audio/wav",
    ".mp3": "audio/mpeg",
}


def fix_mimetypes() -> None:
    """Python's ``mimetypes`` reads the Windows registry, which on many PCs maps ``.js``
    to ``text/plain``; browsers then refuse to run the player's JavaScript modules.
    Pin the types the UI needs (``add_type`` initialises the registry data first, so
    these win)."""
    for ext, mime in WEB_MIME_TYPES.items():
        mimetypes.add_type(mime, ext)


# ---------------------------------------------------------------------------
# Download file names
# ---------------------------------------------------------------------------

def safe_filename(name: str, max_length: int = 150) -> str:
    """A file name that is valid on Windows (no <>:"/\\|?* or control chars)."""
    name = "".join("_" if (unicodedata.category(ch) == "Cc" or ch in '<>:"/\\|?*') else ch
                   for ch in str(name))
    name = re.sub(r"\s+", " ", name).strip().rstrip(". ")
    if len(name) > max_length:
        name = name[:max_length].rstrip(". ")
    if not name or _WINDOWS_RESERVED.match(name):
        name = f"_{name}" if name else "Stem Player"
    return name


def content_disposition(filename: str) -> str:
    """``attachment; filename="..."`` plus RFC 5987 ``filename*`` for non-ASCII names."""
    try:
        filename.encode("ascii")
        return f'attachment; filename="{filename}"'
    except UnicodeEncodeError:
        pass
    stem, dot, ext = filename.rpartition(".")
    if not dot:
        stem, ext = filename, ""
    fallback = unicodedata.normalize("NFKD", stem).encode("ascii", "ignore").decode("ascii")
    fallback = re.sub(r"\s+", " ", fallback).strip() or "download"
    if ext:
        fallback = f"{fallback}.{ext.encode('ascii', 'ignore').decode('ascii') or 'bin'}"
    return f"attachment; filename=\"{fallback}\"; filename*=UTF-8''{quote(filename, safe='')}"


# ---------------------------------------------------------------------------
# Middleware: localhost-only guard + no-cache headers
# ---------------------------------------------------------------------------

def _hostname(netloc: str) -> str:
    try:
        return (urlsplit(f"//{netloc}").hostname or "").lower()
    except ValueError:
        return ""


class LocalOnlyMiddleware:
    """Defence in depth for a server that listens on 127.0.0.1:

    - rejects requests whose Host header isn't localhost (blocks DNS-rebinding),
    - rejects state-changing requests sent by other web sites (Origin mismatch),
    - adds ``Cache-Control`` so the browser never shows stale songs or an old UI.
    """

    def __init__(self, app: Any) -> None:
        self.app = app

    async def __call__(self, scope, receive, send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        headers = Headers(scope=scope)
        host = headers.get("host", "")
        if host and _hostname(host) not in LOCAL_HOSTNAMES:
            await JSONResponse({"detail": "Stem Player only accepts requests from this PC."},
                               status_code=400)(scope, receive, send)
            return
        origin = headers.get("origin")
        if scope.get("method", "GET").upper() in UNSAFE_METHODS and origin is not None:
            parts = urlsplit(origin) if origin != "null" else None
            same = parts is not None and parts.netloc.lower() == host.lower()
            if not same:
                await JSONResponse({"detail": "Blocked a request from another web site."},
                                   status_code=403)(scope, receive, send)
                return

        is_api = scope.get("path", "").startswith("/api/")

        async def send_with_headers(message) -> None:
            if message["type"] == "http.response.start":
                h = MutableHeaders(scope=message)
                if "cache-control" not in h:
                    h["Cache-Control"] = "no-store" if is_api else "no-cache"
                h.setdefault("X-Content-Type-Options", "nosniff")
            await send(message)

        await self.app(scope, receive, send_with_headers)


class PlayerFiles:
    """Serves ``static/`` (index.html at /). If the folder is missing, explains that
    instead of failing with a server error."""

    def __init__(self, directory: Path) -> None:
        self.directory = Path(directory)
        self.static = StaticFiles(directory=str(self.directory), html=True, check_dir=False)

    async def __call__(self, scope, receive, send) -> None:
        if scope["type"] == "http" and not (self.directory / "index.html").is_file():
            page = ("<!doctype html><meta charset='utf-8'><title>Stem Player</title>"
                    "<p style='font:16px system-ui;margin:2em'>The player files are missing "
                    "(the <code>static</code> folder next to run.py). Please download Stem "
                    "Player again.</p>")
            await HTMLResponse(page, status_code=503)(scope, receive, send)
            return
        await self.static(scope, receive, send)


# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------

def create_app(settings: Optional[Settings] = None, separator: Optional[Separator] = None) -> FastAPI:
    settings = settings or Settings.from_env()
    fix_mimetypes()
    library = Library(settings.library_dir)
    separator = separator or make_separator(settings.separator)
    jobs = JobManager(library, separator)
    limit_mb = settings.max_upload_bytes // (1024 * 1024)

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        library.ensure()
        library.cleanup()
        jobs.start()
        # Import torch/demucs in the background so the first health check and the first
        # song don't wait for it.
        threading.Thread(target=separator.info, name="stem-player-warmup", daemon=True).start()
        log.info("Library folder: %s", library.root)
        try:
            yield
        finally:
            jobs.stop()

    app = FastAPI(title="Stem Player", version=__version__, lifespan=lifespan,
                  docs_url=None, redoc_url=None, openapi_url=None)
    app.state.settings = settings
    app.state.library = library
    app.state.jobs = jobs
    app.state.separator = separator
    app.add_middleware(LocalOnlyMiddleware)

    # -- errors ------------------------------------------------------------------
    @app.exception_handler(RequestValidationError)
    async def _validation_error(_request: Request, exc: RequestValidationError):
        errors = exc.errors()
        message = "Invalid request."
        if errors:
            first = errors[0]
            where = ".".join(str(p) for p in first.get("loc", ()) if p not in ("body", "query", "path"))
            message = f"Invalid request: {where + ': ' if where else ''}{first.get('msg', '')}".strip()
        return JSONResponse({"detail": message}, status_code=400)

    @app.exception_handler(SongNotFound)
    async def _not_found(_request: Request, _exc: SongNotFound):
        return JSONResponse({"detail": "Song not found."}, status_code=404)

    @app.exception_handler(JobConflict)
    async def _conflict(_request: Request, exc: JobConflict):
        return JSONResponse({"detail": str(exc)}, status_code=409)

    # -- helpers -----------------------------------------------------------------
    def get_song(song_id: str) -> dict:
        return library.require(song_id)  # validates the id; SongNotFound -> 404

    def stem_names(meta: dict) -> list:
        return [s.get("name") for s in meta.get("stems") or [] if isinstance(s, dict)]

    # -- routes ------------------------------------------------------------------
    @app.get("/api/health")
    def health() -> dict:
        # Don't block while torch is still being imported in the background at start-up.
        info = separator.info(wait=False)
        status = info.get("status") or ("ready" if info.get("available") else "unavailable")
        return {
            "ok": True,
            "app": "stem-player",
            "version": __version__,
            "separator": separator.name,
            "separator_status": status,  # ready | loading | unavailable
            "separator_available": status != "unavailable",
            "separator_error": info.get("error"),
            "device": info.get("device"),
            "demucs_version": info.get("demucs_version"),
            "torch_version": info.get("torch_version"),
            "max_upload_mb": limit_mb,
            "default_model": DEFAULT_MODEL,
            "models": public_models(),
        }

    @app.get("/api/songs")
    def list_songs() -> dict:
        return {"songs": library.list()}

    @app.post("/api/songs", status_code=201)
    async def upload_song(request: Request):
        try:
            upload = await receive_upload(request, library.incoming_dir(), settings.max_upload_bytes)
        except UploadTooLarge:
            raise HTTPException(413, f"That file is too big. The limit is {limit_mb} MB.") from None
        except BadUpload as exc:
            raise HTTPException(400, str(exc)) from None
        except UploadAborted:
            # The user cancelled the upload (or closed the tab): nothing to report, and no
            # traceback in the console window. The half-received file is already deleted.
            log.info("An upload was cancelled.")
            return JSONResponse({"detail": "Upload cancelled."}, status_code=400)
        try:
            model = upload.fields.get("model") or DEFAULT_MODEL
            quality = upload.fields.get("quality") or "normal"
            if model not in MODEL_IDS:
                raise HTTPException(400, f"Unknown model {model[:40]!r}. Choose one of: {', '.join(MODEL_IDS)}.")
            if quality not in QUALITIES:
                raise HTTPException(400, "Quality must be 'normal' or 'high'.")
            if upload.path is None or not upload.filename:
                raise HTTPException(400, "No file was uploaded. Choose a song file and try again.")
            if upload.size == 0:
                raise HTTPException(400, "That file is empty.")
            meta = await run_in_threadpool(
                library.create, upload_path=upload.path, original_filename=upload.filename,
                model=model, quality=quality,
            )
        finally:
            upload.discard()  # no-op once the file was moved into the song folder
        jobs.enqueue(meta["id"])
        log.info("Added %r (%.1f MB).", meta["title"], upload.size / 1e6)
        return JSONResponse({"song": meta}, status_code=201)

    @app.get("/api/songs/{song_id}")
    def song(song_id: str) -> dict:
        return {"song": get_song(song_id)}

    @app.patch("/api/songs/{song_id}")
    def rename_song(song_id: str, payload: Any = Body(...)) -> dict:
        get_song(song_id)
        title = payload.get("title") if isinstance(payload, dict) else None
        if not isinstance(title, str):
            raise HTTPException(400, "Send JSON like {\"title\": \"New name\"}.")
        title = clean_title(title)
        if not title:
            raise HTTPException(400, "The title can't be empty.")
        meta = library.set_title(song_id, title)
        if meta is None:
            raise SongNotFound(song_id)
        return {"song": meta}

    @app.delete("/api/songs/{song_id}")
    def delete_song(song_id: str) -> dict:
        jobs.delete(song_id)
        return {"ok": True}

    @app.post("/api/songs/{song_id}/cancel")
    def cancel_song(song_id: str) -> dict:
        return {"song": jobs.cancel(song_id)}

    @app.post("/api/songs/{song_id}/retry")
    def retry_song(song_id: str) -> dict:
        return {"song": jobs.retry(song_id)}

    @app.get("/api/songs/{song_id}/original")
    def original(song_id: str, download: bool = False):
        meta = get_song(song_id)
        path = library.original_path(song_id)
        if path is None:
            raise HTTPException(404, "The original file is missing.")
        media_type = mimetypes.guess_type(meta.get("original_filename") or path.name)[0] or ""
        if not media_type.startswith(("audio/", "video/")):
            # Never serve an uploaded file as HTML/JS/SVG on the player's own origin.
            media_type = "application/octet-stream"
        headers = {}
        if download:
            ext = path.suffix if path.suffix != ".bin" else ""
            headers["Content-Disposition"] = content_disposition(safe_filename(meta["title"]) + ext)
        return FileResponse(path, media_type=media_type, headers=headers)

    @app.get("/api/songs/{song_id}/stems/{stem}.wav")
    def stem_wav(song_id: str, stem: str, download: bool = False):
        meta = get_song(song_id)
        if stem not in stem_names(meta):
            raise HTTPException(404, "That part doesn't exist for this song.")
        path = library.stem_path(song_id, stem)
        if not path.is_file():
            raise HTTPException(404, "That part isn't ready yet.")
        headers = {}
        if download:
            label = next((s.get("label") for s in meta["stems"] if s.get("name") == stem), None)
            name = f"{safe_filename(meta['title'])} - {safe_filename(label or stem_label(stem))}.wav"
            headers["Content-Disposition"] = content_disposition(name)
        return FileResponse(path, media_type="audio/wav", headers=headers)

    @app.get("/api/songs/{song_id}/peaks")
    def peaks(song_id: str):
        get_song(song_id)
        path = library.peaks_path(song_id)
        if not path.is_file():
            raise HTTPException(404, "The waveforms aren't ready yet.")
        return FileResponse(path, media_type="application/json")

    @app.get("/api/songs/{song_id}/mix")
    def mix(song_id: str, stems: Optional[str] = Query(None),
            fmt: str = Query("wav", alias="format")):
        meta = get_song(song_id)
        if meta.get("status") != "done":
            raise HTTPException(409, "This song isn't finished yet.")
        fmt = (fmt or "wav").lower()
        if fmt not in mixdown.FORMATS:
            raise HTTPException(400, "Format must be wav or mp3.")
        try:
            chosen = mixdown.parse_mix_spec(stems, stem_names(meta))
        except MixSpecError as exc:
            raise HTTPException(400, str(exc)) from None
        paths = []
        for name, gain in chosen:
            path = library.stem_path(song_id, name)
            if not path.is_file():
                raise HTTPException(404, "A part of this song is missing. Try Retry or add it again.")
            paths.append((path, gain))
        audio = mixdown.mix_files(paths)
        data = mixdown.render(audio, fmt)
        filename = f"{safe_filename(meta['title'])} - custom mix.{fmt}"
        return Response(content=data, media_type=mixdown.FORMATS[fmt],
                        headers={"Content-Disposition": content_disposition(filename)})

    @app.api_route("/api/{rest:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
                   include_in_schema=False)
    def api_not_found(rest: str):
        raise HTTPException(404, "Not found.")

    # -- the player UI -------------------------------------------------------------
    app.mount("/", PlayerFiles(settings.static_dir), name="static")
    return app


def __getattr__(name: str):
    """``app.main:app`` for ``uvicorn app.main:app`` (created on first access)."""
    if name == "app":
        value = create_app()
        globals()["app"] = value
        return value
    raise AttributeError(name)
