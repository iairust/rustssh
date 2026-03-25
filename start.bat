@echo off
echo Starting WebSSH Manager...
echo.
echo Backend: http://localhost:3001
echo Frontend: http://localhost:5173
echo.
start "WebSSH Backend" cmd /k "cd /d %~dp0backend && node server.js"
timeout /t 2 /nobreak > nul
start "WebSSH Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"
echo.
echo Servers started! Opening browser...
timeout /t 3 /nobreak > nul
start http://localhost:5173
