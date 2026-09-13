@echo off
cd /d "%~dp0"
echo ========================================
echo   Stella Sora - Full data update
echo   1/4  fetch ss-data (characters / discs / potentials)
echo   2/4  rebuild assets/data/*.json
echo   3/4  download HD icons (potential / disc skill / disc buff)
echo   4/4  download HD images (portraits / outfits)
echo ========================================
echo.
echo --- Step 1/4: fetch ss-data ---
node --use-system-ca fetch-data.js
if errorlevel 1 (
  echo     [!] retry without the cert flag ...
  node fetch-data.js
)
echo.
echo --- Step 2/4: rebuild JSON ---
node build-data.js
echo.
echo --- Step 3/4: HD icons ---
node --use-system-ca download-icons.js
if errorlevel 1 (
  echo     [!] retry without the cert flag ...
  node download-icons.js
)
echo.
echo --- Step 4/4: HD images ---
node --use-system-ca download-hd.js
echo.
echo --- Check data files ---
node check-data.js
echo.
echo ========================================
echo   ALL DONE.
echo   Next: run  push to GitHub  to publish.
echo ========================================
pause
