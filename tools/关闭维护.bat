@echo off
setlocal
cd /d "%~dp0.."
echo ==================================================
echo   Turn OFF the maintenance page
echo ==================================================
echo.
node tools\maintenance-toggle.js off
if errorlevel 1 goto fail
echo.
if /i "%~1"=="publish" goto publish
echo   Local files are ready, but the site is NOT updated yet.
echo.
echo   To make it live, run PUSH-TO-LIVE.bat in the tools folder.
echo   Or run this file again with the extra word:  publish
echo.
if /i not "%~1"=="nopause" pause
exit /b 0
:publish
echo --- publishing ---
call "%~dp0PUSH-TO-LIVE.bat" nopause
if errorlevel 1 goto fail
if /i not "%~1"=="nopause" pause
exit /b 0
:fail
echo.
echo [X] Failed. Read the message above.
if /i not "%~1"=="nopause" pause
exit /b 1
