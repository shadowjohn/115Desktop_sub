@echo off
chcp 65001 >nul
set "ELECTRON_RUN_AS_NODE="
echo [INFO] ...
echo.
npm start
if errorlevel 1 (
    echo.
    echo [ERROR] 
    pause
)
