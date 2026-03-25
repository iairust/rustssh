@echo off
echo ============================================
echo Testing xshell-tauri.exe
echo ============================================
echo.
echo Please check if the application window opens correctly.
echo If the page is blank, please:
echo 1. Press F12 to open Developer Tools
echo 2. Check the Console tab for errors
echo 3. Check the Network tab for failed requests
echo.
pause
.\target\release\xshell-tauri.exe
