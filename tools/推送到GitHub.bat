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
echo --- Step 1/3: fetch remote changes ---
git fetch origin main
echo.
echo --- Step 2/3: merge remote changes (auto-resolve data file if needed) ---
git merge origin/main --no-edit -m "merge remote edits"
if errorlevel 1 (
  echo.
  echo     [!] Conflict detected. Auto-resolving the data file by keeping the newest version...
  git checkout --theirs -- assets/data/preset-teams.json
  git add assets/data/preset-teams.json
  git commit --no-edit -m "auto-merge: keep newest team data"
  if errorlevel 1 (
    echo     [X] Auto-resolve FAILED. Tell the assistant.
    pause
    exit /b 1
  )
  echo     [OK] Resolved.
)
echo.
echo --- Check data files ---
node tools\check-data.js
if errorlevel 1 (
  echo.
  echo     [X] Data file is broken - aborting upload so the site stays working.
  pause
  exit /b 1
)
echo.
echo --- Step 3/3: push ---
git push -u origin main
set RC=%ERRORLEVEL%
echo.
if "%RC%"=="0" goto ok
echo [X] Push FAILED, exit code %RC%
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
