## 检查数据文件是否健康（JSON 能否解析、有没有合并冲突标记残留）
$ErrorActionPreference = "Continue"
cd /d "%~dp0.."
echo ==========================================
echo   Check data files
echo ==========================================
echo.
node tools/check-data.js
echo.
pause
