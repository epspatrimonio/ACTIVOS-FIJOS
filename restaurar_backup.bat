@echo off
title Restaurar Base de Datos - Activos Fijos
color 0C
echo ======================================================================
echo          RESTAURADOR DE COPIAS DE RESPALDO - ACTIVOS FIJOS
echo ======================================================================
echo.

if not exist "%~dp0backups" (
    echo [!] No existe la carpeta 'backups' o no se han generado respaldos aun.
    echo.
    pause
    exit /b 1
)

echo [*] Respaldos disponibles en 'backups/':
echo.
dir "%~dp0backups\*.sql" /B
echo.

set /p BACKUP_NAME="Ingrese el nombre exacto del archivo a restaurar (ej. backup_activos_fijos_20260630_155755.sql): "

if not exist "%~dp0backups\%BACKUP_NAME%" (
    echo [!] ERROR: El archivo "%BACKUP_NAME%" no existe en la carpeta 'backups'.
    echo.
    pause
    exit /b 1
)

echo.
echo ======================================================================
echo [CUIDADO] SE REEMPLAZARA LA INFORMACION DE LA BASE DE DATOS ACTUAL.
echo ======================================================================
set /p CONFIRM="¿Esta seguro de proceder con la restauracion? (S/N): "
if /i "%CONFIRM%" neq "S" (
    echo [-] Restauracion cancelada.
    echo.
    pause
    exit /b 0
)

echo.
echo [*] Verificando conexion con el contenedor de base de datos 'activos-db'...
docker ps --filter "name=activos-db" --format "{{.Names}}" | findstr /i "activos-db" >nul
if %errorlevel% neq 0 (
    echo [!] ERROR: El contenedor de base de datos 'activos-db' no esta ejecutandose.
    echo Por favor, asegurese de iniciar la aplicacion antes de restaurar.
    echo.
    pause
    exit /b 1
)

echo [*] Restaurando base de datos...
docker exec -i activos-db psql -U postgres -d activos_fijos < "%~dp0backups\%BACKUP_NAME%"

if %errorlevel% equ 0 (
    echo.
    echo ======================================================================
    echo [OK] RESTAURACION COMPLETADA CON EXITO
    echo ======================================================================
    echo Se ha restaurado la informacion del archivo: %BACKUP_NAME%
    echo.
) else (
    echo.
    echo [!] Ocurrio un error al intentar restaurar el archivo de copia de seguridad.
    echo.
)

pause
