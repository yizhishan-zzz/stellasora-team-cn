@echo off
setlocal
cd /d "%~dp0.."
set "NOPAUSE=%~1"
if defined SS_NOPAUSE set "NOPAUSE=nopause"
set "T0=%TIME%"
set "LOG=%~dp0_last-publish.log"
> "%LOG%" echo ==== run started %TIME% ====

echo ==================================================
echo   ONE STEP: update data and publish to the live site
echo   Folder : %CD%
echo   Log    : tools\_last-publish.log
echo ==================================================
echo.

echo --- pre-flight checks ---
where node >nul 2>&1
if errorlevel 1 goto noNode
echo   [OK] node.js
if not exist ".git" goto noGit
echo   [OK] git repository
git remote get-url origin >nul 2>&1
if errorlevel 1 git remote add origin https://github.com/yizhishan-zzz/stellasora-team-cn.git
echo   [OK] git remote origin
echo.

if defined SS_SKIP_DATA goto skipData
echo ==================================================
echo   Part 1/2 : updating game data        ^(start %TIME%^)
echo ==================================================
echo.
call "%~dp0UPDATE-DATA.bat" nopause
if errorlevel 1 goto failData
echo.
goto push

:skipData
echo ==================================================
echo   Part 1/2 : data update SKIPPED      ^(SS_SKIP_DATA^)
echo ==================================================
echo.

:push
echo ==================================================
echo   Part 2/2 : publishing to the live site   ^(start %TIME%^)
echo ==================================================
echo.
call "%~dp0PUSH-TO-LIVE.bat" nopause
if errorlevel 1 goto failPush

echo.
echo ==================================================
echo   ALL DONE.
echo   Started %T0%   Finished %TIME%
echo.
echo   Site: https://stellasora-team-cn.pages.dev
echo   If the page looks old, press Ctrl+Shift+R.
echo ==================================================
>> "%LOG%" echo OK finished %TIME%
git log --oneline -1 >> "%LOG%" 2>&1
if /i not "%NOPAUSE%"=="nopause" pause
exit /b 0

:noNode
echo.
echo [X] node.js was not found in PATH.
echo     Install Node.js, then run this file again.
goto fail

:noGit
echo.
echo [X] .git not found. Put this file inside the project folder.
goto fail

:failData
echo.
echo ==================================================
echo [X] STOPPED at Part 1: updating game data.
echo     Nothing was pushed. The website is unchanged.
echo     Fix the error above, then run this file again.
echo ==================================================
>> "%LOG%" echo FAIL at data update %TIME%
if /i not "%NOPAUSE%"=="nopause" pause
exit /b 1

:failPush
echo.
echo ==================================================
echo [X] STOPPED at Part 2: publishing.
echo     Data is updated locally, but the website was not changed.
echo     Run this file again, or run PUSH-TO-LIVE.bat alone.
echo ==================================================
>> "%LOG%" echo FAIL at publish %TIME%
if /i not "%NOPAUSE%"=="nopause" pause
exit /b 1

:fail
echo.
echo ==================================================
echo [X] STOPPED. Read the messages above.
echo ==================================================
>> "%LOG%" echo FAIL at preflight %TIME%
if /i not "%NOPAUSE%"=="nopause" pause
exit /b 1
