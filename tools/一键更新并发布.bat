@echo off
cd /d "%~dp0"
echo ==================================================
echo   One step: update data and publish
echo ==================================================
echo.
call "%~dp0更新数据.bat"
echo.
echo ==================================================
echo   Now publishing to GitHub ...
echo ==================================================
call "%~dp0推送到GitHub.bat"
