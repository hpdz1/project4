"""Stem Player: a personal, local song-splitter and stem player.

The backend is a small FastAPI app (see ``app.main.create_app``) that stores songs in
``library/`` and splits them with Demucs in a single background worker thread.
"""

__version__ = "1.0.0"
