@echo off
echo Starting WebSSH Manager...
echo.
echo Step 1: Starting Backend...
cd backend
start "Backend Server" cmd /k "node server.js"
cd ..

echo Step 2: Starting Frontend...
cd frontend
start "Frontend Server" cmd /k "npm run dev"
cd ..

echo Step 3: Starting Tauri...
cd src-tauri
cargo tauri dev

pause
