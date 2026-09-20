@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ==================================================
echo   Rebuild translation dictionary (EN -^> CN)
echo ==================================================
echo.
node build-dict.js
echo.
echo ==================================================
echo   Done. To add new words, edit MANUAL in build-dict.js
echo ==================================================
pause
