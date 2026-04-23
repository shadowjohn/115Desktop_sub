@echo off
chcp 65001 >nul
echo [INFO] 
echo.
npm run dist
if errorlevel 1 (
    echo.
    echo [ERROR] 
    pause
) else (
    echo.
    echo [SUCCESS] 
    pause
)