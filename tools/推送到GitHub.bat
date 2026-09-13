@echo off
cd /d "%~dp0.."
set REPO=https://github.com/yizhishan-zzz/stellasora-team-cn.git
echo ==================================================
echo   Upload project to GitHub (Cloudflare rebuilds)
echo   Folder: %CD%
echo ==================================================
echo.
if not exist ".git" (
  echo [X] .git not found in %CD%
  pause
  exit /b 1
)
git remote remove origin >nul 2>&1
git remote add origin %REPO%
git branch -M main
echo.
echo ==================================================
echo   Login prompt:
echo     Username : yizhishan-zzz
echo     Password : paste your access token
echo                (nothing shows while typing - normal)
echo ==================================================
echo.
pause
echo.
echo --- Step 1/3: check local data files ---
node tools\check-data.js
if errorlevel 1 (
  echo.
  echo     [X] Data file is broken - aborting upload so the site stays working.
  pause
  exit /b 1
)
echo.
echo --- Step 2/3: fetch remote ---
git fetch origin main
echo.
echo --- Step 3/3: force push local data over remote ---
echo     (local file is the source of truth; remote edits will be overwritten)
git push --force-with-lease origin main
set RC=%ERRORLEVEL%
echo.
if "%RC%"=="0" goto ok
echo [X] Push FAILED, exit code %RC%
echo.
echo   If it complains about stale info, run again - it usually works the second time.
pause
exit /b 1
:ok
echo [OK] Uploaded!
echo      Repo: https://github.com/yizhishan-zzz/stellasora-team-cn
echo      Site: https://stellasora-team-cn.pages.dev   (rebuilds in ~1 min)
echo.
echo [IMPORTANT] Remove the token from local git config:
echo   git remote set-url origin %REPO%
echo.
pause
