@echo off
cd /d "%~dp0.."
set REPO=https://github.com/yizhishan-zzz/stellasora-team-cn.git
echo ==================================================
echo   Upload to GitHub  (Cloudflare rebuilds in ~1 min)
echo   Folder: %CD%
echo   Repo  : %REPO%
echo ==================================================
echo.
if not exist ".git" (
  echo [X] .git not found. Put this file inside the project folder.
  pause
  exit /b 1
)
git remote remove origin >nul 2>&1
git remote add origin %REPO%
git branch -M main
echo --- Commits to upload ---
git log --oneline -6
echo.
echo --- Check data files ---
node tools\check-data.js
if errorlevel 1 (
  echo.
  echo     [X] Data file is broken. Upload cancelled so the website stays working.
  pause
  exit /b 1
)
echo.
echo --- Fetch remote ---
git fetch origin main
echo.
echo --- Push (local data overwrites the remote copy) ---
git push --force origin main
if errorlevel 1 (
  echo.
  echo     [!] Push failed. Retrying once ...
  echo     If a login prompt appears:
  echo        Username : yizhishan-zzz
  echo        Password : paste your token  ^(text stays invisible - normal^)
  echo.
  git fetch origin main
  git push --force origin main
)
if errorlevel 1 (
  echo.
  echo [X] Push still failed. Common reasons:
  echo     1. Network problem - just run this file again
  echo     2. Token expired or lacks Contents write permission
  echo     3. Wrong repository name
  pause
  exit /b 1
)
echo.
echo [OK] Uploaded!
echo.
echo --- Verify what is on GitHub now ---
node tools\verify-push.js
echo.
echo ==================================================
echo   Site : https://stellasora-team-cn.pages.dev
echo   Wait about 1 minute, then press Ctrl+Shift+R on the site.
echo ==================================================
pause
