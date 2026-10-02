@echo off
setlocal EnableExtensions

rem Start both parts of VoxNova from any working directory.
set "ROOT=%~dp0"
set "SERVER=%ROOT%server"
set "PYTHON_EXE="
set "PYTHON_ARGS="

rem Prefer the Windows Python launcher, then common per-user installs, then PATH.
where py >nul 2>nul
if not errorlevel 1 (
  set "PYTHON_EXE=py"
  set "PYTHON_ARGS=-3"
)
if not defined PYTHON_EXE if exist "%LocalAppData%\Programs\Python\Python312\python.exe" set "PYTHON_EXE=%LocalAppData%\Programs\Python\Python312\python.exe"
if not defined PYTHON_EXE if exist "%LocalAppData%\Programs\Python\Python311\python.exe" set "PYTHON_EXE=%LocalAppData%\Programs\Python\Python311\python.exe"
if not defined PYTHON_EXE (
  for /f "delims=" %%P in ('where python 2^>nul') do if not defined PYTHON_EXE set "PYTHON_EXE=%%P"
)

if not defined PYTHON_EXE (
  echo [ERROR] Python was not found.
  echo Install Python 3.9+ and enable the "Add Python to PATH" option.
  pause
  exit /b 1
)

if not exist "%SERVER%\vosk_server.py" (
  echo [ERROR] Could not find server\vosk_server.py
  pause
  exit /b 1
)

echo Starting VoxNova Vosk server...
netstat -ano | findstr /R /C:":2700 .*LISTENING" >nul
if errorlevel 1 (
  start "VoxNova Vosk Server" /D "%SERVER%" cmd /k ""%PYTHON_EXE%" %PYTHON_ARGS% vosk_server.py"
) else (
  echo Vosk server is already listening on port 2700; leaving it running.
)

echo Starting VoxNova frontend...
start "VoxNova Frontend" /D "%ROOT%" cmd /k "npm run dev -- --host 127.0.0.1"

echo.
echo Vosk server: ws://127.0.0.1:2700
echo Frontend:    http://127.0.0.1:5173 (or the URL shown by Vite)
echo Keep both new command windows open while using VoxNova.
endlocal
