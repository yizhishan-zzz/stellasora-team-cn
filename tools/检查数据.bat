@echo off
setlocal
cd /d "%~dp0.."
set "RC=0"
echo ==========================================
echo   Check data files and bat scripts
echo ==========================================
echo.
node tools/check-data.js
if errorlevel 1 set "RC=1"
echo.
node tools/bat-lint.js
if errorlevel 1 set "RC=1"
echo.
if not "%RC%"=="0" echo [X] Something is wrong. Fix it before using the other scripts.
if "%RC%"=="0" echo Everything looks good.
pause
exit /b %RC%
