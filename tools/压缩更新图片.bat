@echo off
setlocal
cd /d "%~dp0"
if "%~1"=="" goto :noargs
echo ==================================================
echo   Compressing dropped images ...
echo ==================================================
node compress-updates.js %*
echo.
pause
exit /b 0

:noargs
echo ==================================================
echo   Drop image files onto this .bat to compress them
echo.
echo   Output folder is OUTSIDE this project, as a sibling:
echo     [project-folder]-past-assets\UpdateImages\
echo     on this PC: stella_sora_network + chinese suffix + UpdateImages-like folder
echo.
echo   File name: xtlr_update_YYYY_MM_DD.png
echo   Quality  : about 95 percent, PNG format
echo ==================================================
echo.
pause
exit /b 1
