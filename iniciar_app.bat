@echo off
title Control Patrimonial - Iniciador

:: 1. Limpieza de puertos previos para evitar conflictos
for /f "tokens=5" %%a in ('netstat -ano ^| findstr /c:":8000" ^| findstr LISTENING') do (
    taskkill /f /pid %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr /c:":5173" ^| findstr LISTENING') do (
    taskkill /f /pid %%a >nul 2>&1
)

:: 2. Crear script VBScript temporal para lanzar servidores ocultos
echo Set WshShell = CreateObject("WScript.Shell") > "%temp%\launch_cp.vbs"
echo WshShell.Run "cmd /c cd /d ""%~dp0backend"" && .venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000", 0, false >> "%temp%\launch_cp.vbs"
echo WshShell.Run "cmd /c cd /d ""%~dp0frontend"" && npm run dev", 0, false >> "%temp%\launch_cp.vbs"
wscript "%temp%\launch_cp.vbs"
ping 127.0.0.1 -n 2 >nul
del "%temp%\launch_cp.vbs"

:: 3. Esperar inicializacion de servicios (3s)
ping 127.0.0.1 -n 4 >nul

:: 4. Abrir el navegador
start http://localhost:5173/
exit
