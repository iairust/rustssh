@echo off
echo ============================================
echo Starting Tauri Development Mode...
echo ============================================
echo.

cd /d "%~dp0src-tauri"

echo Current directory: %CD%
echo.
echo Running: cargo tauri dev
echo.

cargo tauri dev

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ============================================
    echo Error occurred!
    echo ============================================
    echo.
    pause
)
