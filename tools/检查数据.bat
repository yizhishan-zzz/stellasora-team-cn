@echo off
cd /d "%~dp0.."
echo ==========================================
echo   Check data files
echo ==========================================
echo.
node tools/check-data.js
echo.
pause
