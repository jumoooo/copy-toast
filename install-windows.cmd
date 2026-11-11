:; echo "This file is for Windows. On Mac / Linux / WSL run:  sh install-mac-linux.sh  (nothing was changed)"; exit 3 #
@echo off
rem copy-toast installer for Windows. On Mac / Linux / WSL run:  sh install-mac-linux.sh
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0copy-toast\scripts\install.ps1"
echo.
pause
