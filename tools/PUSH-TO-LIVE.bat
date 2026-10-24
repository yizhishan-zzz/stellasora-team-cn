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
if not exist ".git" goto noGit

echo --- Step 1/4: what will be pushed ---
git fetch origin main >nul 2>&1
git log --oneline origin/main..HEAD
if errorlevel 1 echo   (nothing)
echo.
echo   working tree:
git status --short
echo.

echo --- Step 2/4: GitHub reachable? ---
set "GIT_TERMINAL_PROMPT=0"
git ls-remote --heads origin main >nul 2>&1
if errorlevel 1 goto noCred
echo   [OK] GitHub is reachable
goto credDone
:noCred
echo   [!] cannot reach GitHub right now.
echo       Check your network or proxy - the push below will probably fail.
:credDone
set "GIT_TERMINAL_PROMPT="
echo.

echo --- Step 3/4: merge cloud data, commit, push ---
call "%~dp0PUSH-TO-GITHUB.bat" nopause
if errorlevel 1 goto failPush
echo.

echo --- Step 4/4: check the live site really updated ---
node --use-system-ca tools\check-deploy.js 180
if errorlevel 1 goto deployLate
echo.
echo ==================================================
echo   Done. Started %T0%   Finished %TIME%
echo   Site: https://stellasora-team-cn.pages.dev
echo ==================================================
if /i not "%NOPAUSE%"=="nopause" pause
exit /b 0

:deployLate
echo.
echo ==================================================
echo   Pushed to GitHub, but the live site is not updated yet.
echo.
echo   1. Cloudflare usually needs about 1 minute - check again later.
echo   2. If it stays old: cloudflare.com - Pages - your project - Deployments
echo      and look for a failed build.
echo   3. On the site itself press Ctrl+Shift+R ^(hard refresh^).
echo ==================================================
if /i not "%NOPAUSE%"=="nopause" pause
exit /b 1

:failPush
echo.
echo ==================================================
echo [X] Push did not finish. The website is unchanged.
echo     Common reasons:
echo       - no network
echo       - GitHub token expired or lacks write permission
echo       - merge conflict with a web edit
echo ==================================================
if /i not "%NOPAUSE%"=="nopause" pause
exit /b 1

:noGit
echo.
echo [X] .git not found. Put this file inside the project folder.
if /i not "%NOPAUSE%"=="nopause" pause
exit /b 1
