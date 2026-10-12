"""Start Stem Player: find a free port, start the local server, open the browser.

Double-click "Start Stem Player.bat" instead of running this directly; the .bat file
sets up Python and the required packages the first time.

Environment (optional): STEM_PLAYER_PORT, STEM_PLAYER_LIBRARY, STEM_PLAYER_SEPARATOR,
STEM_PLAYER_NO_BROWSER=1 (don't open a browser window).
"""

from __future__ import annotations

import json
import logging
import logging.handlers
import os
import socket
import sys
import threading
import time
import urllib.request
import webbrowser
from dataclasses import replace
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PORT_TRIES = 20
_lock_handle = None  # keeps the single-instance lock alive for the whole process


def _setup_console() -> None:
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(errors="replace")
        except Exception:
            pass
    if os.name != "nt":
        return
    # Clicking inside a Windows console window starts "QuickEdit" selection, which
    # freezes every program writing to it - the server would hang until a key is
    # pressed. Turn QuickEdit off for this window.
    try:
        import ctypes

        kernel32 = ctypes.windll.kernel32
        handle = kernel32.GetStdHandle(-10)  # STD_INPUT_HANDLE
        mode = ctypes.c_uint32()
        if kernel32.GetConsoleMode(handle, ctypes.byref(mode)):
            ENABLE_QUICK_EDIT_MODE = 0x0040
            ENABLE_EXTENDED_FLAGS = 0x0080
            kernel32.SetConsoleMode(handle, (mode.value & ~ENABLE_QUICK_EDIT_MODE) | ENABLE_EXTENDED_FLAGS)
        kernel32.SetConsoleTitleW("Stem Player")
    except Exception:
        pass


def _setup_logging(library_dir: Path) -> None:
    root = logging.getLogger()
    root.setLevel(logging.INFO)
    console = logging.StreamHandler(sys.stdout)
    console.setFormatter(logging.Formatter("%(asctime)s  %(message)s", "%H:%M:%S"))
    root.addHandler(console)
    try:
        library_dir.mkdir(parents=True, exist_ok=True)
        logfile = logging.handlers.RotatingFileHandler(
            library_dir / "stem-player.log", maxBytes=2_000_000, backupCount=2, encoding="utf-8")
        logfile.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s"))
        root.addHandler(logfile)
    except OSError:
        pass
    for noisy in ("uvicorn.access", "httpx", "huggingface_hub", "urllib3"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


def _acquire_instance_lock(library_dir: Path) -> bool:
    """Only one Stem Player may use a library folder at a time."""
    global _lock_handle
    library_dir.mkdir(parents=True, exist_ok=True)
    path = library_dir / ".stem-player.lock"
    try:
        handle = open(path, "a+b")
    except OSError:
        return True  # can't create a lock file: don't block the user over it
    try:
        if os.name == "nt":
            import msvcrt

            handle.seek(0)
            msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl

            fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        handle.close()
        return False
    _lock_handle = handle
    return True


def _fetch_health(url: str, timeout: float = 1.5):
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))  # never via a proxy
    with opener.open(f"{url}/api/health", timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _find_running_instance(host: str, first_port: int):
    for port in range(first_port, first_port + PORT_TRIES):
        url = f"http://{host}:{port}"
        try:
            if _fetch_health(url, timeout=1.0).get("app") == "stem-player":
                return url
        except Exception:
            continue
    return None


def _port_answers(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.3)
        return sock.connect_ex((host, port)) == 0


def find_free_port(host: str, first_port: int, tries: int = PORT_TRIES):
    """First port from ``first_port`` that nothing listens on and that we can bind.

    On Linux/macOS the probe uses SO_REUSEADDR like uvicorn does, so connections left
    in TIME_WAIT by a previous run don't push us to another port (which would change
    the page's address and reset the player's saved settings). On Windows SO_REUSEADDR
    would let us bind over a running server, so a plain bind is used there.
    """
    for port in range(first_port, min(first_port + tries, 65536)):
        if _port_answers(host, port):
            continue
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            if os.name != "nt":
                sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                sock.bind((host, port))
            except OSError:
                continue
            return port
    return None


def _banner(url: str) -> None:
    line = "=" * 78
    print()
    print(line)
    print(f"  Stem Player is running at {url} — keep this window open; close it to quit")
    print("  (If the browser didn't open, copy that address into your browser.)")
    print(line)
    print(flush=True)


def _open_browser_when_ready(server, url: str, open_browser: bool) -> None:
    deadline = time.monotonic() + 120
    while not getattr(server, "started", False):
        if time.monotonic() > deadline or getattr(server, "should_exit", False):
            return
        time.sleep(0.1)
    _banner(url)
    if open_browser:
        try:
            webbrowser.open(url)
        except Exception:
            pass


def main() -> int:
    _setup_console()
    if sys.version_info < (3, 10):
        print("Stem Player needs Python 3.10 or newer. Please install Python 3.12 from python.org.")
        return 1

    # Keep the AI model downloads inside this folder (unless configured otherwise).
    sys.path.insert(0, str(ROOT))
    try:
        from app.config import ConfigError, Settings, model_cache_env

        for key, value in model_cache_env(ROOT).items():
            os.environ.setdefault(key, value)
        import uvicorn

        from app.main import create_app
    except ImportError as exc:
        print()
        print("Stem Player's setup looks incomplete (%s)." % exc)
        print("Fix: close this window, delete the '.venv' folder inside the Stem Player folder,")
        print("then double-click 'Start Stem Player.bat' again.")
        return 1

    try:
        settings = Settings.from_env()
    except ConfigError as exc:
        print(f"Configuration problem: {exc}")
        return 1

    _setup_logging(settings.library_dir)
    open_browser = os.environ.get("STEM_PLAYER_NO_BROWSER", "").strip() not in ("1", "true", "yes")

    if not _acquire_instance_lock(settings.library_dir):
        url = _find_running_instance(settings.host, settings.port)
        if url:
            print(f"Stem Player is already running at {url} — opening it in your browser.")
            if open_browser:
                webbrowser.open(url)
            time.sleep(2)
            return 0
        print("Another copy of Stem Player is using the library folder. Close it and try again.")
        return 1

    port = find_free_port(settings.host, settings.port)
    if port is None:
        print(f"Couldn't find a free port between {settings.port} and {settings.port + PORT_TRIES - 1}.")
        print("Close other programs that might be using them, or set STEM_PLAYER_PORT.")
        return 1
    settings = replace(settings, port=port)
    url = f"http://{settings.host}:{port}"

    app = create_app(settings)
    config = uvicorn.Config(app, host=settings.host, port=port, log_level="warning",
                            access_log=False, lifespan="on")
    server = uvicorn.Server(config)
    print(f"Starting Stem Player ({'splitting engine: ' + settings.separator}) ...", flush=True)
    threading.Thread(target=_open_browser_when_ready, args=(server, url, open_browser),
                     daemon=True).start()
    try:
        server.run()
    except KeyboardInterrupt:
        pass
    if not getattr(server, "started", False):
        print("Stem Player could not start - see the messages above.")
        return 1
    print("Stem Player has stopped.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
