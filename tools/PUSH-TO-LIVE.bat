@echo off
setlocal
cd /d "%~dp0.."
set "NOPAUSE=%~1"
if defined SS_NOPAUSE set "NOPAUSE=nopause"
set "T0=%TIME%"
echo ==================================================
echo   Push local changes to the live site
echo   Folder: %CD%
echo ==================================================
echo.
if not exist ".git" (
  echo [X] .git not found. Put this file inside the project folder.
  if /i not "%NOPAUSE%"=="nopause" pause
  exit /b 1
)
echo --- Step 1/3: pending changes ---
git status --short
echo.
echo --- Step 2/3: merge cloud data, commit, push ---
call "%~dp0PUSH-TO-GITHUB.bat" nopause
if errorlevel 1 (
  echo.
  echo [X] Push did not finish. Nothing was changed on the website.
  if /i not "%NOPAUSE%"=="nopause" pause
  exit /b 1
)
echo.
echo --- Step 3/3: check the live site really updated ---
node --use-system-ca tools\check-deploy.js 180
if errorlevel 1 (
  echo.
  echo     [!] Pushed to GitHub, but the site is not showing it yet.
  echo         Cloudflare usually needs about 1 minute.
  echo         Wait a bit, then press Ctrl+Shift+R on the site.
)
echo.
echo ==================================================
echo   Started at %T0%   Finished at %TIME%
echo   Site: https://stellasora-team-cn.pages.dev
echo ==================================================
if /i not "%NOPAUSE%"=="nopause" pause
exit /b 0
