@echo off
setlocal
cd /d "%~dp0"
set "NOPAUSE=%~1"
if defined SS_NOPAUSE set "NOPAUSE=nopause"
set "T0=%TIME%"
echo ==================================================
echo   Stella Sora - update game data and assets
echo ==================================================
echo.
echo   [1/10] fetch ss-data ........ characters / discs / potentials
echo   [2/10] rebuild JSON ........ auto-add new characters / discs
echo   [3/10] extract skills ...... skills / base stats / potential levels
echo   [4/10] build translation ... EN to CN dictionary
echo   [5/10] download icons ....... potential / disc / char skill / buff
echo   [6/10] download images ...... portraits / outfits
echo   [7/10] compress images ...... skip already processed
echo   [8/10] build thumbnails ..... small images for lists
echo   [9/10] data check + prerender + verify
echo.
echo ==================================================
echo.
echo --- [1/10] fetch ss-data ---
node --use-system-ca fetch-data.js
if errorlevel 1 node fetch-data.js
echo.
echo --- [2/10] rebuild JSON ---
node build-data.js
if errorlevel 1 goto fail
echo.
echo --- [3/10] extract skills and stats ---
node build-skills.js
if errorlevel 1 goto fail
echo.
echo --- [4/10] build translation dictionary ---
node build-dict.js
echo.
echo --- [5/10] download icons ---
node --use-system-ca download-icons.js
if errorlevel 1 node download-icons.js
echo.
echo --- [6/10] download images ---
node --use-system-ca download-hd.js
if errorlevel 1 node download-hd.js
echo.
echo --- [7/10] compress images (skips already done) ---
node --use-system-ca compress-images.js
echo.
echo --- [8/10] build thumbnails ---
node build-thumbs.js
echo.
echo --- [9/10] check data + prerender ---
node check-data.js
if errorlevel 1 goto fail
node prerender.js
if errorlevel 1 goto fail
echo.
echo --- [10/10] verify ---
node verify-push.js
echo.
echo ==================================================
echo   ALL DONE.
echo ==================================================
if /i not "%NOPAUSE%"=="nopause" pause
exit /b 0
:fail
echo.
echo [X] Something failed. Read the messages above.
if /i not "%NOPAUSE%"=="nopause" pause
exit /b 1
