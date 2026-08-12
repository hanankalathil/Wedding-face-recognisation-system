@echo off
echo Starting Face Recognition System...

rem Set PYTHONPATH to include the backend folder so 'app' is always importable
set PYTHONPATH=%CD%\backend

echo Starting Unified Server (Backend API + Frontend UI) on port 8000...
start "Face Recognition Server" cmd /k "venv\Scripts\python backend\run.py"

echo Waiting for server to initialize...
timeout /t 4 /nobreak > nul

echo Opening browser...
start http://localhost:8000/index.html
