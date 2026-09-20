@echo off
cd /d "%~dp0"
echo ==================================================
echo   Stella Sora - update game data and assets
echo ==================================================
echo.
echo   [1/11] fetch ss-data ........ characters / discs / potentials
echo   [2/11] rebuild JSON ........ auto-add new characters / discs
echo   [3/11] extract skills ...... skills / base stats / potential levels
echo   [4/11] build translation ... EN to CN dictionary
echo   [5/11] download HD icons ... potential / disc / char skills / buff
echo   [6/11] download HD images .. portraits / outfits
echo   [7/11] compress images ..... save about 70 percent bandwidth
echo   [8/11] build thumbnails .... small images for lists (save 76 percent)
echo   [9/11] subset fonts ........ include new glyphs
echo   [10/11] check data files .... validate JSON
echo.
echo ==================================================
echo   No login needed. Safe to run again.
echo ==================================================
echo.
echo --- [1/10] fetch ss-data ---
node --use-system-ca fetch-data.js
if errorlevel 1 (
  echo     [!] retry without cert flag ...
  node fetch-data.js
)
echo.
echo --- [2/10] rebuild JSON ---
node build-data.js
if errorlevel 1 goto fail
echo.
echo --- [3/10] extract skills and stats ---
node build-skills.js
if errorlevel 1 goto fail
echo.
echo --- [4/11] build translation dict ---
node build-dict.js
echo.
echo --- [4/10] download HD icons ---
node --use-system-ca download-icons.js
if errorlevel 1 node download-icons.js
echo.
echo --- [5/10] download HD images ---
node --use-system-ca download-hd.js
if errorlevel 1 node download-hd.js
echo.
echo --- [6/10] compress images ---
node --use-system-ca compress-images.js
echo.
echo --- [7/10] build thumbnails ---
node build-thumbs.js
echo.
echo --- [8/10] subset fonts ---
node subset-fonts.js
echo.
echo --- [9/10] check data files ---
node check-data.js
if errorlevel 1 goto fail
echo.
echo --- [10/10] prerender pages ---
node prerender.js
if errorlevel 1 goto fail
echo.
echo ==================================================
echo   ALL DONE. Now run   push to GitHub   to publish.
echo ==================================================
pause
exit /b 0
:fail
echo.
echo [X] Something failed. Read the messages above.
pause
exit /b 1
