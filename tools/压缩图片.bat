@echo off
cd /d "%~dp0"
echo ==================================================
echo   Compress site images (save bandwidth)
echo ==================================================
echo.
echo   default quality 92; images under 20KB are skipped
echo   run this after downloading new images
echo.
node --use-system-ca compress-images.js
if errorlevel 1 (
  echo     [!] retry without cert flag ...
  node compress-images.js
)
echo.
pause
