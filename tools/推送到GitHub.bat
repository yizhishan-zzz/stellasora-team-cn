@echo off
cd /d "%~dp0.."
set REPO=https://github.com/yizhishan-zzz/stellasora-team-cn.git
echo ==================================================
echo   Upload to GitHub  (Cloudflare rebuilds in ~1 min)
echo   Folder: %CD%
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
echo.
echo --- Step 1/4: merge cloud teams back into the local file ---
echo     (so online edits are never overwritten)
node --use-system-ca tools\sync-teams-from-cloud.js
if errorlevel 1 node tools\sync-teams-from-cloud.js
echo.
echo --- Step 2/4: check data files ---
node tools\check-data.js
if errorlevel 1 (
  echo.
  echo     [X] Data file is broken. Upload cancelled so the website stays working.
  pause
  exit /b 1
)
echo.
echo --- Step 3/4: commit merged data and fetch remote ---
git add -A
git -c user.name="site" -c user.email="site@local" commit -q -m "merge cloud teams before push" >nul 2>&1
git fetch origin main
echo.
echo --- Step 4/4: push ---
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
