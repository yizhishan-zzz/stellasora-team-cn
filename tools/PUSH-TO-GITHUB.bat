@echo off
setlocal
cd /d "%~dp0.."
set "NOPAUSE=%~1"
if defined SS_NOPAUSE set "NOPAUSE=nopause"
set REPO=https://github.com/yizhishan-zzz/stellasora-team-cn.git
echo ==================================================
echo   Upload to GitHub  (Cloudflare rebuilds in ~1 min)
echo   Folder: %CD%
echo ==================================================
echo.
if not exist ".git" (
  echo [X] .git not found. Put this file inside the project folder.
  if /i not "%NOPAUSE%"=="nopause" pause
  exit /b 1
)
git remote remove origin >nul 2>&1
git remote add origin %REPO%
git branch -M main
echo.
echo --- Step 1/5: merge cloud teams back into the local file ---
node --use-system-ca tools\sync-teams-from-cloud.js
if errorlevel 1 node tools\sync-teams-from-cloud.js
echo.
echo --- Step 2/5: check data files and bat scripts ---
node tools\check-data.js
if errorlevel 1 (
  echo.
  echo     [X] Data file is broken. Upload cancelled so the website stays working.
  if /i not "%NOPAUSE%"=="nopause" pause
  exit /b 1
)
node tools\bat-lint.js
if errorlevel 1 (
  echo.
  echo     [X] Some .bat script is broken. Upload cancelled.
  if /i not "%NOPAUSE%"=="nopause" pause
  exit /b 1
)
echo.
echo --- Step 3/5: commit merged data ---
git add -A
git -c user.name="site" -c user.email="site@local" commit -q -m "update site" >nul 2>&1
echo.
echo --- Step 4/5: push ---
git fetch origin main
git push --force origin main
if errorlevel 1 (
  echo.
  echo     [!] Push failed. Retrying once ...
  echo     If a login prompt appears:
  echo        Username : yizhishan-zzz
  echo        Password : paste your token
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
  if /i not "%NOPAUSE%"=="nopause" pause
  exit /b 1
)
echo.
echo [OK] Uploaded!
echo.
echo --- Step 5/5: verify + notify Bing ---
node tools\verify-push.js
node --use-system-ca tools\submit-indexnow.js
echo.
echo ==================================================
echo   Site : https://stellasora-team-cn.pages.dev
echo   Wait about 1 minute, then Ctrl+Shift+R on the site.
echo ==================================================
if /i not "%NOPAUSE%"=="nopause" pause
exit /b 0
