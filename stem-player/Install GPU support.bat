@echo off
setlocal EnableExtensions
title Stem Player - GPU support
cd /d "%~dp0" 2>nul || pushd "%~dp0"

set "VENV_PY=.venv\Scripts\python.exe"

echo.
echo  ======================================================================
echo    Stem Player - optional GPU support (NVIDIA graphics cards only)
echo  ======================================================================
echo.
echo  This makes splitting songs several times faster on PCs with an NVIDIA
echo  graphics card (GeForce, RTX, Quadro). It downloads about 3 GB.
echo  No NVIDIA card? Just close this window - Stem Player works without it.
echo.

where nvidia-smi >nul 2>&1
if errorlevel 1 goto :no_nvidia
echo  NVIDIA graphics card found:
nvidia-smi --query-gpu=name,driver_version,memory.total --format=csv,noheader
echo.

if not exist "%VENV_PY%" goto :no_venv

echo  Please CLOSE Stem Player (its black window) before continuing.
echo.
pause

echo.
echo  Installing PyTorch for NVIDIA cards (CUDA 12.8). This takes a while...
"%VENV_PY%" -m pip install --disable-pip-version-check --upgrade --force-reinstall --no-deps torch --index-url https://download.pytorch.org/whl/cu128
if errorlevel 1 goto :try_cu126
call :deps
call :verify
if not errorlevel 1 goto :success

:try_cu126
echo.
echo  Trying the CUDA 12.6 version instead (for older cards and drivers)...
"%VENV_PY%" -m pip install --disable-pip-version-check --upgrade --force-reinstall --no-deps torch --index-url https://download.pytorch.org/whl/cu126
if errorlevel 1 goto :install_failed
call :deps
call :verify
if errorlevel 1 goto :not_working
goto :success

:deps
rem Only torch itself is swapped (--no-deps), so the PyTorch download site can't
rem replace packages the rest of Stem Player needs with its own older copies.
rem Anything new the GPU version of torch needs comes from the normal index here.
echo.
echo  Checking the other components...
"%VENV_PY%" -m pip install --disable-pip-version-check -r requirements.txt
exit /b 0

:verify
echo.
echo  Checking that PyTorch can use the graphics card...
"%VENV_PY%" -c "import torch; print(torch.cuda.is_available())"
"%VENV_PY%" -c "import sys, torch; ok = torch.cuda.is_available() and float((torch.zeros(8, device='cuda') + 1).sum()) == 8.0; print('GPU ready:', torch.cuda.get_device_name(0) if ok else 'no'); sys.exit(0 if ok else 1)"
exit /b %errorlevel%

:success
echo.
echo  Done! GPU support is installed. Start Stem Player as usual; when a song is
echo  being split, the window shows "on cuda".
echo.
pause
exit /b 0

:not_working
echo.
echo  PyTorch for NVIDIA cards is installed, but it cannot use your graphics card.
echo  Updating your NVIDIA driver (from nvidia.com or the NVIDIA app) usually fixes
echo  this - then run this file again. Stem Player keeps working on the CPU.
echo.
pause
exit /b 1

:install_failed
echo.
echo  The download or install did not finish (internet connection, firewall,
echo  disk space, or no GPU version of PyTorch for this Python version yet).
echo  Your existing setup was not changed unless noted below.
"%VENV_PY%" -c "import torch" >nul 2>&1
if errorlevel 1 (
    echo  Restoring the normal CPU version of PyTorch...
    "%VENV_PY%" -m pip install --disable-pip-version-check --upgrade torch
)
echo  You can run this file again later.
echo.
pause
exit /b 1

:no_nvidia
echo  No NVIDIA graphics card (or driver) was found on this PC, so there is
echo  nothing to install. Stem Player works fine on the CPU, just slower.
echo.
pause
exit /b 1

:no_venv
echo  Stem Player has not been set up yet. Double-click "Start Stem Player.bat"
echo  first, wait until it opens in your browser, close it, then run this file again.
echo.
pause
exit /b 1
