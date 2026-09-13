@echo off
chcp 65001 >nul
cd /d "%~dp0"
set PSEXE=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe
echo ========================================
echo   Stella Sora - Full data update
echo   1/4  fetch ss-data (characters/discs/potentials)
echo   2/4  rebuild assets/data/*.json
echo   3/4  download HD icons (potential / disc skill / disc buff)
echo   4/4  download HD images (portraits / outfits)
echo ========================================
echo.
echo --- Step 1/4: fetch data ---
if exist "%PSEXE%" ( "%PSEXE%" -NoProfile -ExecutionPolicy Bypass -File "fetch-data.ps1" ) else ( powershell -NoProfile -ExecutionPolicy Bypass -File "fetch-data.ps1" )
echo.
echo --- Step 2/4: rebuild JSON ---
node build-data.js
echo.
echo --- Step 3/4: HD icons ---
node --use-system-ca download-icons.js
if errorlevel 1 (
  echo     [!] retry in compatible cert mode ...
  node download-icons.js
)
echo.
echo --- Step 4/4: HD images ---
if exist "%PSEXE%" ( "%PSEXE%" -NoProfile -ExecutionPolicy Bypass -File "download-hd.ps1" ) else ( powershell -NoProfile -ExecutionPolicy Bypass -File "download-hd.ps1" )
echo.
echo ========================================
echo   ALL DONE. Refresh the site (Ctrl+F5).
echo ========================================
pause
