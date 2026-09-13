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
echo --- Set remote ---
git remote remove origin >nul 2>&1
git remote add origin %REPO%
git branch -M main
git remote -v
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
echo --- Step 1/2: fetch remote changes and merge them in ---
git fetch origin main
git merge origin/main --no-edit -m "merge remote edits"
if errorlevel 1 (
  echo.
  echo [X] Merge hit a CONFLICT - do not panic, nothing is lost.
  echo     Tell the assistant; the conflict is almost always in
  echo     assets/data/preset-teams.json and can be resolved safely.
  pause
  exit /b 1
)
echo.
echo --- Step 2/2: push ---
git push -u origin main
set RC=%ERRORLEVEL%
echo.
if "%RC%"=="0" goto ok
echo [X] Push FAILED, exit code %RC%
echo.
echo   Common reasons:
echo     1. Wrong username or repository name
echo     2. Token lacks Contents write permission
echo     3. Network dropped - run this file again, it resumes
echo.
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
