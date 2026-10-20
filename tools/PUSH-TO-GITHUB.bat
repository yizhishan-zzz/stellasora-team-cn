@echo off
setlocal
cd /d "%~dp0.."
set "NOPAUSE=%~1"
if defined SS_NOPAUSE set "NOPAUSE=nopause"
set REPO=https://github.com/yizhishan-zzz/stellasora-team-cn.git
echo ==================================================
echo   Upload to GitHub  ^(Cloudflare rebuilds in ~1 min^)
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
echo --- Step 1/7: merge cloud teams back into the local file ---
node --use-system-ca tools\sync-teams-from-cloud.js
if errorlevel 1 node tools\sync-teams-from-cloud.js
echo.
echo --- Step 2/7: pull web-edited data back before pushing ---
git fetch origin main
if errorlevel 1 (
  echo     [!] Cannot reach GitHub. Skipping this step.
) else (
  git show origin/main:assets/data/updates.json > "tools\_cloud_updates.json" 2>nul
  git show origin/main:assets/data/char-meta.json > "tools\_cloud_charmeta.json" 2>nul
  node tools\merge-cloud-data.js
)
echo.
echo --- Step 3/7: check data files and bat scripts ---
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
echo --- Step 4/7: commit local changes ---
git add -A
git -c user.name="yizhishan_zzz" -c user.email="3910443008@qq.com" commit -q -m "update site" >nul 2>&1
echo.
echo --- Step 5/7: merge remote commits, keep both sides ---
git merge --no-edit -X ours origin/main >nul 2>&1
if errorlevel 1 (
  git merge --abort >nul 2>&1
  echo.
  echo     [X] Merge conflict with the remote repository.
  echo         Nothing was uploaded, the site is unchanged.
  echo         Run this file again; if it keeps failing, tell the assistant.
  if /i not "%NOPAUSE%"=="nopause" pause
  exit /b 1
)
echo.
echo --- Step 6/7: push  ^(normal push, never force^) ---
git push origin main
if errorlevel 1 (
  echo.
  echo     [!] Push failed. Pulling once more and retrying ...
  echo     If a login prompt appears:
  echo        Username : yizhishan-zzz
  echo        Password : paste your token
  echo.
  git fetch origin main
  git show origin/main:assets/data/updates.json > "tools\_cloud_updates.json" 2>nul
  git show origin/main:assets/data/char-meta.json > "tools\_cloud_charmeta.json" 2>nul
  node tools\merge-cloud-data.js
  git add -A
  git -c user.name="yizhishan_zzz" -c user.email="3910443008@qq.com" commit -q -m "update site" >nul 2>&1
  git merge --no-edit -X ours origin/main >nul 2>&1
  git push origin main
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
echo --- Step 7/7: verify + notify Bing ---
node tools\verify-push.js
node --use-system-ca tools\submit-indexnow.js
echo.
echo ==================================================
echo   Site : https://stellasora-team-cn.pages.dev
echo   Wait about 1 minute, then Ctrl+Shift+R on the site.
echo ==================================================
if /i not "%NOPAUSE%"=="nopause" pause
exit /b 0
