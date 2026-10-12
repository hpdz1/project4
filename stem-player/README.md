# Stem Player

Stem Player splits a song into its parts: **vocals, drums, bass, guitar, piano and
"other"**. You can then hear one part on its own, mute the drums, turn the vocals down,
and save single parts or your own mix.

It all runs on your own PC, and nothing is sent anywhere. It's meant for personal use
(see [Privacy and copyright](#privacy-and-copyright)).

**You need:** a Windows 10 or 11 PC, about 3 GB of free disk space, an internet
connection for the first start, and Microsoft Edge or Google Chrome. Firefox works too.

---

## One-time setup

1. **Install Python 3.12**. Stem Player is built with it.
   1. Go to <https://www.python.org/downloads/windows/>.
   2. Find a **Python 3.12** release that has a **"Windows installer (64-bit)"** link
      (for example 3.12.10), then download and run it.
   3. **Important:** on the installer's first screen, tick the box
      **"Add python.exe to PATH"**, then click **Install Now**.

   *Python 3.10 to 3.14 also work. If you already have one of those, skip this step.*
2. **Put the Stem Player folder somewhere simple**, like `C:\StemPlayer`. Avoid OneDrive
   folders, because OneDrive would try to sync about 1 GB of program files.
3. **Double-click `Start Stem Player.bat`.**
   - If Windows says *"Windows protected your PC"*, click **More info**, then **Run anyway**.
   - The first start downloads about **1 GB** of components, which takes 5–15 minutes.
     Leave the black window open while it works.
4. When setup is done, Stem Player opens in your browser. That's it!

The first song you split also downloads the AI model once (about 80 MB, or about
300 MB for the "best quality" option). That first song takes a little longer.

---

## Everyday use

1. **Double-click `Start Stem Player.bat`.** A black window opens: that's Stem Player
   running. Keep it open (minimising it is fine). Your browser opens the player.
   If the browser doesn't open, copy the address shown in the black window
   (such as `http://127.0.0.1:8765`) into your browser.
2. **Drop a song** onto the page, or click **Choose file…**. You can use MP3, WAV, FLAC,
   M4A, OGG, WMA or a video file, up to 500 MB and 30 minutes long. Leave **Split into** on
   **6 parts (recommended)**.
3. **Wait while it's split.** A progress bar shows how far along it is. Rough times for a
   4-minute song:
   - on a typical PC (processor only): **about 1–3 minutes**; older laptops take longer
   - with an NVIDIA graphics card (see the [optional step](#optional-faster-splitting-with-an-nvidia-graphics-card)):
     usually **well under a minute**
   - **High** quality is about 2× slower, and **4 parts — best quality** is about 4× slower.

   You can add more songs while you wait; they are split one after another.
4. **Click Open**, then press **Play** (or the Space bar).
   - **M** mutes a part. **S** solos it, so only the soloed parts play. The slider sets
     that part's volume (0–200%), and double-clicking it resets it to 100%.
   - Click a waveform to jump to that spot.
   - Parts that are (almost) silent in this song, such as piano in a song without
     piano, are hidden. Click **Show … empty parts** to see them anyway.
   - To rename the song, click its title.
   - Keyboard: **Space** plays/pauses, **←/→** skip 5 s, **Home** goes back to the start,
     **1–6** mute a part and **Shift+1–6** solo it.
5. **Save what you like.** Files go to your browser's normal **Downloads** folder.
   - The **download arrow** next to a part saves that part as a WAV file.
   - **Download mix** saves your own mix as WAV or MP3. The parts you're hearing right
     now are ticked, at their current volumes.
6. **Finished?** Close the black window. Closing only the browser tab leaves Stem Player
   running in the background.

---

## Optional: faster splitting with an NVIDIA graphics card

This step only works with NVIDIA cards (GeForce, RTX, Quadro). Other PCs use the
processor, which works fine, just more slowly.

1. Update your NVIDIA driver, using the NVIDIA app or <https://www.nvidia.com/drivers>.
2. Close Stem Player (its black window).
3. Double-click **`Install GPU support.bat`** and follow the window. It downloads about
   3 GB.
4. Start Stem Player as usual. The top-right corner should now say
   **Graphics card (fast)**.

If the window says it can't use your card, update the driver and run the file again.
Stem Player keeps working on the processor in the meantime.

---

## Where your files are

- **Songs:** in the **`library`** folder inside the Stem Player folder. Each song has its
  own folder, holding the original file and its parts as WAV files in `stems`. A split
  song takes about **60 MB per minute of music**, so a 4-minute song is about 250 MB.
- **To delete a song**, click the bin icon next to it in Stem Player. That removes its
  folder. To delete *all* songs, close Stem Player and delete the `library` folder.
- **Other folders:** `.venv` holds the installed components (1–3 GB) and `models` holds
  the AI model. Both are safe to delete; they are downloaded again on the next start.
- **To remove Stem Player completely**, close it and delete its whole folder. Python can
  be uninstalled from Windows **Settings → Apps**.

---

## Troubleshooting

| What you see | What to do |
|---|---|
| *"Python 3.10 or newer (64-bit) was not found"* | Install Python as in [setup step 1](#one-time-setup), with **"Add python.exe to PATH"** ticked. If you forgot to tick it, uninstall Python (Settings → Apps) and install it again. Then double-click `Start Stem Player.bat` again. |
| *"Setup could not finish installing the components"* | Check your internet connection, let your firewall or antivirus allow the download, make sure about 3 GB is free, and use a short folder path such as `C:\StemPlayer`. Double-click `Start Stem Player.bat` again and it carries on where it stopped. If it still fails, delete the `.venv` folder and try once more. |
| The browser says *"can't reach this page"* | Look in the black window for the address. If port 8765 is busy, Stem Player picks the next free one (8766, 8767…), so use exactly the address shown there. If the black window is gone, start Stem Player again. |
| A red bar: *"Stem Player isn't running"* | The black window was closed. Double-click `Start Stem Player.bat`; the page reconnects by itself. |
| *"Couldn't download the AI model"* | The internet connection, a firewall or a proxy blocked the download (from huggingface.co). Fix the connection, then click **Retry** on the song. This download only happens once. |
| *"Couldn't read this file as audio"* | The file is damaged or copy-protected. Songs from Apple Music, iTunes `.m4p` files or streaming apps can't be read. Try another copy or format. |
| *"Your PC ran out of memory"* | Close other programs and click **Retry**, or try a shorter song. |
| *"This file is longer than 30 minutes"* | Stem Player splits up to 30 minutes at a time (longer files need more memory than most PCs have). Cut the recording into shorter pieces, or use a single song from it. |
| *"A Windows component that the splitting engine needs is missing"* | Install the **Microsoft Visual C++ Redistributable (x64)** from <https://aka.ms/vs/17/release/vc_redist.x64.exe>, restart the PC and start Stem Player again. |
| The player is slow or the browser struggles with a very long song | Playing all the parts of a 4-minute song uses about 500 MB of browser memory, and longer songs use more. Close other tabs, or cut long recordings into shorter pieces. |
| A song says *"Interrupted — click Retry"* | Stem Player was closed while that song was being split. Click **Retry**. |
| *"Splitting engine missing"* at the top | The setup is broken. Close Stem Player, delete the `.venv` folder and double-click `Start Stem Player.bat` again. |
| Something else | The log file `library\stem-player.log` has the details. |

---

## Privacy and copyright

- **Everything stays on your PC.** "Uploading" a song only hands the file to the Stem
  Player program on this same computer. It isn't sent anywhere, and Stem Player only
  accepts connections from this PC.
- The internet is used only to download the components and the AI model the first time
  (and when updating).
- **Personal use.** Use Stem Player to practise, learn, sing along or make mixes for
  yourself. The parts of commercial songs are still the artists' copyrighted work, so
  don't share, upload or publish them, or your mixes of them, without permission.

---

## Updating to a newer version

1. Close Stem Player.
2. Copy the new Stem Player files into your Stem Player folder, replacing the old ones.
   **Keep** the `library` folder (your songs); keeping `.venv` and `models` saves
   re-downloading.
3. Double-click `Start Stem Player.bat`. If the components changed, it updates them
   automatically, which can take a few minutes.
4. If you use the NVIDIA option and splitting is slow again after an update, run
   `Install GPU support.bat` once more.

---

## For tinkerers (optional)

- **Settings** (environment variables; set them in a Command Prompt before running the
  `.bat`, e.g. `set STEM_PLAYER_LIBRARY=D:\Songs`):
  - `STEM_PLAYER_LIBRARY` sets the song folder (default: `library` here).
  - `STEM_PLAYER_PORT` sets the first port to try (default 8765).
  - `STEM_PLAYER_NO_BROWSER=1` stops a browser window from opening on start.
  - `STEM_PLAYER_SEPARATOR=fake` uses a quick fake splitter for testing (no AI).
    `STEM_PLAYER_FAKE_DELAY` sets its speed in seconds per step.
- **Tests:** `.venv\Scripts\python -m pip install -r requirements-dev.txt`, then
  `.venv\Scripts\python -m pytest tests -q`.
- **How it works:** see `docs/DESIGN.md`.
- **Credits:** splitting by [Demucs](https://github.com/adefossez/demucs) (Meta AI, MIT
  licence). Audio decoding by FFmpeg (via `imageio-ffmpeg`). MP3 encoding by LAME
  (via `lameenc`).
