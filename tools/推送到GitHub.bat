@echo off
cd /d "%~dp0.."
set REPO=https://github.com/yizhishan-zzz/stellasora-team-cn.git
echo ==================================================
echo   Upload project to GitHub (Cloudflare will rebuild)
echo   Folder: %CD%
echo   Repo  : %REPO%
echo ==================================================
echo.
if not exist ".git" (
  echo [X] .git not found in %CD%
  pause
  exit /b 1
)
echo --- Commits waiting to be uploaded ---
git log --oneline -5
echo.
echo --- Set remote ---
git remote remove origin >nul 2>&1
git remote add origin %REPO%
git remote -v
echo.
echo --- Branch: main ---
git branch -M main
git branch --show-current
echo.
echo ==================================================
echo   Login prompt:
echo     Username : yizhishan-zzz
echo     Password : paste your access token
echo                (nothing shows while typing - normal)
echo ==================================================
echo.
pause
git push -u origin main
set RC=%ERRORLEVEL%
echo.
if "%RC%"=="0" goto ok
echo [X] Push FAILED, exit code %RC%
echo.
echo   Common reasons:
echo     1. Wrong username or repository name
echo     2. Token lacks Contents write permission
echo     3. Extra spaces pasted with the token
echo     4. Network dropped - run this file again, it resumes
echo.
pause
exit /b 1
:ok
echo [OK] Uploaded!
echo      Repo   : https://github.com/yizhishan-zzz/stellasora-team-cn
echo      Site   : https://stellasora-team-cn.pages.dev  (Cloudflare rebuilds in ~1 min)
echo.
echo [IMPORTANT] Remove the token from local git config:
echo   git remote set-url origin %REPO%
echo.
pause
