@echo off
echo ============================================
echo Building Tauri Application...
echo ============================================
echo.

cd /d "%~dp0src-tauri"

echo Current directory: %CD%
echo.
echo Running: cargo tauri build
echo.

cargo tauri build

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ============================================
    echo Error occurred!
    echo ============================================
    echo.
    pause
) else (
    echo.
    echo ============================================
    echo Build successful!
    echo ============================================
    echo.
    echo Executable location: target\release\xshell-tauri.exe
    echo.
    pause
)
