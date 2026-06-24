@echo off
title Control Patrimonial - Detenedor

:: Liberar puertos y terminar procesos
for /f "tokens=5" %%a in ('netstat -ano ^| findstr /c:":8000" ^| findstr LISTENING') do (
    taskkill /f /pid %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr /c:":5173" ^| findstr LISTENING') do (
    taskkill /f /pid %%a >nul 2>&1
)
exit
