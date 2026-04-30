@echo off
setlocal
cd /d "%~dp0"
echo Starting Snake Arena LAN...
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Please install Node.js 18+ and run this file again.
  echo https://nodejs.org/
  pause
  exit /b 1
)
node start-lan.js
pause
