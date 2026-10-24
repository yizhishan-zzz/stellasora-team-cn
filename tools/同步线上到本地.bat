@echo off
setlocal
cd /d "%~dp0.."
set "NOPAUSE=%~1"
if defined SS_NOPAUSE set "NOPAUSE=nopause"
echo ==================================================
echo   Sync from GitHub down to this computer
echo   Folder: %CD%
echo ==================================================
echo.
if not exist ".git" (
  echo [X] .git not found. Put this file inside the project folder.
  if /i not "%NOPAUSE%"=="nopause" pause
  exit /b 1
)
git remote get-url origin >nul 2>&1
if errorlevel 1 git remote add origin https://github.com/yizhishan-zzz/stellasora-team-cn.git
echo --- Step 1/3: fetch from GitHub ---
git fetch origin main
if errorlevel 1 (
  echo.
  echo [X] Cannot reach GitHub. Check network, then run this file again.
  if /i not "%NOPAUSE%"=="nopause" pause
  exit /b 1
)
echo.
echo --- Step 2/3: merge into local ---
git merge --ff-only origin/main
if not errorlevel 1 goto summary
echo.
echo     Local has its own commits, switching to safe merge ...
git show origin/main:assets/data/updates.json > "tools\_cloud_updates.json" 2>nul
git show origin/main:assets/data/char-meta.json > "tools\_cloud_charmeta.json" 2>nul
node tools\merge-cloud-data.js
git add -A
git -c user.name="yizhishan_zzz" -c user.email="3910443008@qq.com" commit -q -m "sync cloud data" >nul 2>&1
git merge --no-edit -X ours origin/main
if errorlevel 1 (
  git merge --abort >nul 2>&1
  echo.
  echo [X] Merge conflict. Nothing was changed on the website.
  echo     Run this file again; if it keeps failing, tell the assistant.
  if /i not "%NOPAUSE%"=="nopause" pause
  exit /b 1
)
:summary
echo.
echo --- Step 3/3: check + summary ---
node tools\check-data.js
if errorlevel 1 (
  echo.
  echo     [!] A data file looks broken. Please tell the assistant.
)
echo.
echo ==================================================
echo   Sync done. Now at:
git log --oneline -1
echo ==================================================
node -e "const u=require('./assets/data/updates.json');const c=require('./assets/data/char-meta.json');const t=require('./assets/data/preset-teams.json');console.log('  update logs : '+u.entries.length+' entries');console.log('  strengthened: '+Object.keys(c.chars||{}).length+' characters');console.log('  teams       : '+t.teams.length);"
echo ==================================================
if /i not "%NOPAUSE%"=="nopause" pause
exit /b 0
