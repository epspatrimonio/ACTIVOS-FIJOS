@echo off
title Respaldo de Base de Datos - Activos Fijos
color 0B
echo ======================================================================
echo          GENERADOR DE COPIAS DE RESPALDO (BACKUP) - ACTIVOS FIJOS
echo ======================================================================
echo.

:: Crear carpeta de backups si no existe en el directorio actual
if not exist "%~dp0backups" (
    mkdir "%~dp0backups"
    echo [+] Carpeta 'backups' creada con exito.
)

:: Obtener fecha y hora de manera robusta sin depender de la configuracion regional
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value 2^>nul') do set datetime=%%I
if "%datetime%"=="" (
    :: Fallback por si wmic no esta disponible
    set mydate=%date:/=-%
    set mytime=%time::=-%
    set mytime=%mytime: =0%
) else (
    set mydate=%datetime:~0,8%
    set mytime=%datetime:~8,6%
)

set FILENAME=backup_activos_fijos_%mydate%_%mytime%.sql
set FILEPATH=%~dp0backups\%FILENAME%

echo [*] Verificando conexion con el contenedor de base de datos 'activos-db'...
docker ps --filter "name=activos-db" --format "{{.Names}}" | findstr /i "activos-db" >nul
if %errorlevel% neq 0 (
    echo [!] ERROR: El contenedor de base de datos 'activos-db' no esta ejecutandose.
    echo Por favor, asegurese de iniciar el sistema antes de generar un respaldo.
    echo.
    pause
    exit /b 1
)

echo [*] Generando copia de seguridad de la base de datos 'activos_fijos'...
:: Ejecutar pg_dump dentro del contenedor de docker y guardar el resultado
docker exec -t activos-db pg_dump -U postgres -d activos_fijos > "%FILEPATH%"

if %errorlevel% equ 0 (
    echo.
    echo ======================================================================
    echo [OK] RESPALDO COMPLETADO CON EXITO
    echo ======================================================================
    echo Archivo generado: %FILENAME%
    echo Ubicacion: %~dp0backups\
    echo.
) else (
    echo.
    echo [!] Ocurrio un error al intentar generar el archivo de copia de seguridad.
    echo.
)

pause
