@echo off
chcp 65001 >nul
cd /d "%~dp0.."
echo ========================================
echo   Sync latest code to dist/
echo   (optional: only needed when packaging
echo    a folder to upload to your host)
echo ========================================
echo.
robocopy . dist *.html /NJH /NJS /NDL /NP /NFL >nul
robocopy assets dist\assets /E /NJH /NJS /NDL /NP /NFL >nul
if exist admin ( echo skip admin\  ^(密码明文，不要打包^) )
echo.
echo   dist/ updated!
echo   Upload dist\ (or the project root) to your static host.
echo ========================================
pause
