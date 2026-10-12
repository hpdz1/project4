# Stem Player — design

A personal, local "stem player" for Windows: drop in a song, it is split into its parts
(vocals, drums, bass, guitar, piano, other) on your own PC, and a browser-based player
lets you listen to each part on its own, mute/solo/mix them, and download single parts
or a custom mix. Personal use only; nothing leaves the PC.

## How it runs

- A small Python web server (FastAPI + uvicorn) on `http://127.0.0.1:8765` (localhost
  only — never `0.0.0.0`). `Start Stem Player.bat` sets everything up on first run and
  opens the browser.
- Separation: Meta's open-source **Demucs 4.1.0** via its Python API
  (`demucs.api.Separator`), default model **`htdemucs_6s`** (6 stems:
  `drums, bass, other, vocals, guitar, piano`). Optional: `htdemucs_ft` (4 stems, best
  quality, ~4x slower) and `htdemucs` (4 stems, fast). Runs on CPU, or on an NVIDIA GPU
  when CUDA PyTorch is installed (`Install GPU support.bat`). Model weights download from
  Hugging Face on first use and are cached.
- "As many parts as it can identify": always run the 6-stem model, then measure each
  stem; parts that are essentially silent in this song (e.g. no piano) are marked
  `detected: false` and hidden by default ("Show 2 empty parts").
- Audio decoding of any input format (mp3, wav, flac, m4a/aac, ogg, opus, wma, video
  files with audio) uses the ffmpeg binary bundled by the `imageio-ffmpeg` pip package,
  so no separate ffmpeg install is needed. MP3 export uses `lameenc` (already a Demucs
  dependency).
- Frontend: plain HTML/CSS/JS ES modules in `static/`, served by the same server. No
  Node.js, no build step. Playback uses the Web Audio API with one `AudioBuffer` per
  stem, all started at the same `AudioContext` time for sample-accurate sync.

## Layout

```
stem-player/
  Start Stem Player.bat      first run: create .venv + install; every run: start + open browser
  Install GPU support.bat    optional: swap in CUDA PyTorch for NVIDIA cards
  requirements.txt           runtime deps (pinned minimums)
  requirements-dev.txt       pytest, httpx
  run.py                     entry point: picks a free port from 8765, starts uvicorn, opens browser
  app/
    __init__.py
    main.py                  FastAPI app + routes + static mount
    config.py                paths/settings (env: STEM_PLAYER_LIBRARY, STEM_PLAYER_SEPARATOR=demucs|fake, STEM_PLAYER_PORT)
    library.py               song folders, meta.json, list/get/delete/rename (atomic writes)
    audio_io.py              ffmpeg decode -> float32 (2, n) @44.1k; WAV write (16-bit); MP3 encode; peaks
    separator.py             Separator protocol; DemucsSeparator; FakeSeparator (tests/dev)
    analysis.py              per-stem RMS dBFS + energy share -> detected flag
    mixdown.py               mix selected stems with gains -> WAV/MP3 bytes/file
    jobs.py                  single background worker thread, queue, progress, cancel
  static/
    index.html  styles.css  app.js  api.js  player.js  waveform.js
  tests/                     pytest (uses FakeSeparator; no torch needed)
  library/                   (git-ignored) one folder per song
  docs/DESIGN.md             this file
  README.md                  plain-English Windows setup + usage
```

## Data on disk

`library/<song_id>/`:
- `original.<ext>` — the uploaded file, untouched
- `stems/<name>.wav` — 16-bit PCM, 44.1 kHz, stereo
- `peaks.json` — `{ "<stem>": [float, ...] }` 1600 buckets per stem, values 0..1 (max |sample|)
- `meta.json`:

```json
{
  "id": "20261012-153012-my-song-3f9a",
  "title": "My Song",
  "original_filename": "My Song.mp3",
  "created_at": "2026-10-12T15:30:12Z",
  "model": "htdemucs_6s",
  "quality": "normal",
  "status": "queued | processing | done | error | cancelled",
  "stage": "queued | loading_model | decoding | separating | saving | done",
  "progress": 0.0,
  "error": null,
  "device": "cpu | cuda",
  "duration": 213.4,
  "samplerate": 44100,
  "stems": [
    { "name": "vocals", "label": "Vocals", "detected": true, "rms_db": -18.2, "energy_share": 0.31 }
  ]
}
```

Song ids are generated server-side (`YYYYMMDD-HHMMSS-<slug>-<4 hex>`), validated with
`^[a-z0-9-]{1,80}$` on every request; stem names validated against the song's
`meta.stems`. Never build paths from unvalidated input.

## Detection rule

For each stem: `rms_db = 20*log10(rms + 1e-12)` over the whole stem (both channels), and
`energy_share = sum(stem^2) / sum over all stems(stem^2)`.
`detected = rms_db > -50 and energy_share >= 0.015`. `other` is always detected if any
audio exists. Thresholds live in `analysis.py` as constants.

## HTTP API (JSON unless noted; errors: `{"detail": "..."}` with 4xx/5xx)

| Method & path | Purpose |
|---|---|
| `GET /api/health` | `{ ok, separator: "demucs"\|"fake", device, demucs_version, models: [{id, label, stems, note}] }` |
| `GET /api/songs` | `{ songs: [meta, ...] }` newest first |
| `POST /api/songs` | multipart: `file` (required, ≤ 500 MB), `model` (default `htdemucs_6s`), `quality` (`normal`\|`high`; high = shifts 2) → `201 { song: meta }` (status `queued`) |
| `GET /api/songs/{id}` | `{ song: meta }` (poll every 1 s while queued/processing) |
| `PATCH /api/songs/{id}` | `{ title }` → `{ song }` |
| `DELETE /api/songs/{id}` | delete folder (cancels first if running) → `{ ok: true }` |
| `POST /api/songs/{id}/cancel` | cancel queued/processing → `{ song }` |
| `POST /api/songs/{id}/retry` | re-queue an errored/cancelled song → `{ song }` |
| `GET /api/songs/{id}/original` | original file (`FileResponse`) |
| `GET /api/songs/{id}/stems/{stem}.wav` | stem WAV (`FileResponse`, supports Range) ; `?download=1` adds `Content-Disposition: attachment; filename="<title> - <Label>.wav"` |
| `GET /api/songs/{id}/peaks` | peaks.json |
| `GET /api/songs/{id}/mix?stems=vocals:1,drums:0.6&format=wav\|mp3` | custom mix download (`attachment; filename="<title> - custom mix.<ext>"`). Gains 0..2. Mix = sum(stem*gain); if peak > 0.999 scale the whole mix down to 0.999 (no clipping). MP3 320 kbps via lameenc. |

## Player behaviour (static/)

- Library screen: drag-and-drop zone + "Choose file" (accept audio/* and video/*),
  model/quality choice (default "6 parts"), list of songs with status, progress bar,
  stage text, cancel/retry/delete, click a finished song to open it.
- Player screen: title (editable), transport (play/pause, back to start, seek bar,
  current/total time, loop toggle), master volume; one row per detected stem: colour,
  label, waveform canvas (from peaks, playhead, click-to-seek), **M**ute, **S**olo,
  volume slider (0–200%), download button. "Show N empty parts" reveals undetected stems
  (loaded on demand). "Download mix" panel: checkboxes + current gains, WAV/MP3.
- Audio: one `AudioContext`; per stem `AudioBufferSourceNode → GainNode → master GainNode
  → destination`. Play/seek = stop all sources, create new ones, `start(t0, offset)` with
  the same `t0 = ctx.currentTime + 0.05`. Gains change with `setTargetAtTime(…, 0.01)` (no
  clicks). Solo logic: if any stem is soloed, only soloed stems are audible; mute wins over
  solo for the same stem.
- Keyboard: Space play/pause, ←/→ seek ±5 s, Home to start, 1–6 mute stem n, Shift+1–6 solo.
- Memory: decoding 6 stems of a 4-minute song uses ~500 MB of RAM in the browser; load
  detected stems first, show a note for songs over 10 minutes.
- Accessible: real buttons with `aria-pressed`, labels on sliders, visible focus, works
  at 1280px and down to ~900px wide (desktop use).
