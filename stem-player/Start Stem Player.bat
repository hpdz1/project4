@echo off
setlocal EnableExtensions
title Stem Player
rem Always work from the folder this file is in (works with spaces in the path).
cd /d "%~dp0" 2>nul || pushd "%~dp0"

set "VENV_PY=.venv\Scripts\python.exe"
rem Copy of the requirements.txt that was installed: if requirements.txt changes
rem (a newer Stem Player), the components are updated automatically.
set "MARKER=.venv\stem-player-requirements.txt"

if not exist "%VENV_PY%" goto :setup
rem The Python that .venv was made from may have been uninstalled or replaced.
"%VENV_PY%" -c "import sys" <nul >nul 2>&1
if errorlevel 1 goto :broken_venv
if not exist "%MARKER%" goto :setup
fc /b "requirements.txt" "%MARKER%" >nul 2>&1
if not errorlevel 1 goto :start

:setup

echo.
echo  ======================================================================
echo    Stem Player - setup
echo  ======================================================================
echo.
echo  First-time setup: downloading about 1 GB, this can take 5-15 minutes.
echo  Please keep this window open. Stem Player opens in your browser when done.
echo.
echo "%CD%" | findstr /i "OneDrive" >nul && echo  Note: this folder is inside OneDrive, which will try to sync about 1 GB of program files. A folder like C:\StemPlayer is a better place. && echo.

rem A half-finished setup from last time: keep it if Python is there, otherwise start over.
if exist ".venv\" if not exist "%VENV_PY%" (
    echo  Removing an incomplete setup from last time...
    rmdir /s /q ".venv"
)
if exist "%VENV_PY%" goto :install

rem ---- Find Python 3.10+ (64-bit) ------------------------------------------
set "PY="
call :try_python py -3.12
if not defined PY call :try_python py -3.13
if not defined PY call :try_python py -3.11
if not defined PY call :try_python py -3
if not defined PY call :try_python python
if not defined PY goto :no_python

echo  Using this Python:
%PY% --version
echo.

echo  [1/3] Creating a private Python environment in the ".venv" folder...
%PY% -m venv .venv
if errorlevel 1 goto :venv_failed
if not exist "%VENV_PY%" goto :venv_failed

:install
echo  [2/3] Updating the installer (pip)...
"%VENV_PY%" -m pip install --disable-pip-version-check --upgrade pip
if errorlevel 1 goto :pip_failed

echo.
echo  [3/3] Downloading and installing the components (about 1 GB)...
echo        Progress bars will appear below. This is the slow part.
echo.
"%VENV_PY%" -m pip install --disable-pip-version-check -r requirements.txt
if errorlevel 1 goto :pip_failed
copy /y "requirements.txt" "%MARKER%" >nul
echo.
echo  Setup finished.

:start
echo.
echo  Starting Stem Player...
echo  (The first song you add also downloads the AI model once, about 80 MB.)
echo.
"%VENV_PY%" run.py
if errorlevel 1 goto :run_failed
exit /b 0

rem ---- helpers and error messages -----------------------------------------
:try_python
rem Input comes from NUL: if a launcher asks a question (for example whether to
rem install a Python version), the hidden prompt ends at once instead of waiting.
%* -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) and sys.maxsize > 2**32 else 1)" <nul >nul 2>&1
if not errorlevel 1 set "PY=%*"
exit /b 0

:broken_venv
echo.
echo  The Python that Stem Player was set up with has been removed or changed.
echo  Setting Stem Player up again (this downloads the components once more)...
echo.
rmdir /s /q ".venv" 2>nul
goto :setup

:no_python
echo.
echo  Python 3.10 or newer (64-bit) was not found on this PC.
echo.
echo  How to fix it:
echo    1. Go to https://www.python.org/downloads/windows/ and download
echo       Python 3.12, "Windows installer (64-bit)".
echo    2. Run the installer and TICK the box "Add python.exe to PATH"
echo       at the bottom of the first screen, then click "Install Now".
echo    3. When it has finished, double-click "Start Stem Player.bat" again.
echo.
echo  Opening the Python download page for you now...
start "" "https://www.python.org/downloads/windows/"
echo.
pause
exit /b 1

:venv_failed
echo.
echo  Could not create the Python environment in the ".venv" folder.
echo  Make sure this folder is not read-only and that there is free disk space,
echo  then double-click "Start Stem Player.bat" again.
echo  If it keeps failing, reinstall Python 3.12 from https://www.python.org
echo  and tick "Add python.exe to PATH".
echo.
pause
exit /b 1

:pip_failed
echo.
echo  Setup could not finish installing the components.
echo.
echo  Common causes:
echo    - No internet connection, or a firewall/antivirus blocked the download.
echo    - Not enough free disk space - about 3 GB is needed.
echo    - The folder path is too long. Move the Stem Player folder somewhere
echo      short, like C:\StemPlayer, and try again.
echo.
echo  Then double-click "Start Stem Player.bat" again - it continues where it stopped.
echo.
pause
exit /b 1

:run_failed
echo.
echo  Stem Player stopped because of a problem - see the messages above.
echo  If it keeps happening: close this window, delete the ".venv" folder in the
echo  Stem Player folder, and double-click "Start Stem Player.bat" again.
echo.
pause
exit /b 1
