@echo off
cd /d "%~dp0"
echo Starting local server at http://localhost:8080
echo Press Ctrl+C to stop.
echo.
node serve.js
pause
