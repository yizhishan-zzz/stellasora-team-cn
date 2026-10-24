@echo off
setlocal
cd /d "%~dp0"
set "NOPAUSE="
if defined SS_NOPAUSE set "NOPAUSE=nopause"
set "T0=%TIME%"
echo ==================================================
echo   ONE STEP: update all data and publish to the live site
echo ==================================================
echo.
echo   Part 1/2 : fetch data, rebuild JSON, download assets,
echo              compress, build dictionary, prerender
echo   Part 2/2 : merge cloud data, push to GitHub,
echo              verify the live site is updated
echo.
echo   Takes a few minutes. Do not close this window.
echo ==================================================
echo.
echo --- Part 1/2 : updating data ---
echo.
call "%~dp0UPDATE-DATA.bat" nopause
if errorlevel 1 goto fail
echo.
echo ==================================================
echo   Part 2/2 : publishing to the live site ...
echo ==================================================
echo.
call "%~dp0PUSH-TO-LIVE.bat" nopause
if errorlevel 1 goto fail
echo.
echo ==================================================
echo   ALL DONE.
echo   Started at %T0%   Finished at %TIME%
echo.
echo   Site: https://stellasora-team-cn.pages.dev
echo   If you still see an old page, press Ctrl+Shift+R.
echo ==================================================
if /i not "%NOPAUSE%"=="nopause" pause
exit /b 0
:fail
echo.
echo ==================================================
echo [X] STOPPED. Read the messages above.
echo ==================================================
if /i not "%NOPAUSE%"=="nopause" pause
exit /b 1
