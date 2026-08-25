@echo off
cd /d "%~dp0"
echo Starting Milliii Backend Server...
echo.
echo Configuration:
echo - Port: 8000
echo - CORS Origins: http://localhost:3000, http://localhost:3001
echo.
python server.py
pause

