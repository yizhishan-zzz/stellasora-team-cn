@echo off
cd /d "%~dp0.."
set PSEXE=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe
echo ========================================
echo   Stella Sora - Download HD assets
echo   source: github.com/AutumnVN/ssassets
echo ========================================
echo.
if exist "%PSEXE%" goto usePS
echo [!] PowerShell not found at expected path, trying PATH ...
powershell -NoProfile -ExecutionPolicy Bypass -File "download-hd.ps1"
goto done
:usePS
"%PSEXE%" -NoProfile -ExecutionPolicy Bypass -File "download-hd.ps1"
:done
echo.
pause
