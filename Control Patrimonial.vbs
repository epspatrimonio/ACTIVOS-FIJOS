Set FSO = CreateObject("Scripting.FileSystemObject")
Set WshShell = CreateObject("WScript.Shell")
currentDir = FSO.GetParentFolderName(WScript.ScriptFullName)
q = Chr(34)

' 1. Verificar si el backend ya está activo en el puerto 8000
commandCheck = "cmd.exe /c netstat -ano | findstr :8000 | findstr LISTENING"
isBackendRunning = (WshShell.Run(commandCheck, 0, True) = 0)

If isBackendRunning Then
    ' El sistema ya está en ejecución. Mostrar cuadro de diálogo interactivo.
    res = MsgBox("El Sistema de Control Patrimonial ya se encuentra en ejecución." & vbCrLf & vbCrLf & _
                 "¿Qué desea hacer?" & vbCrLf & vbCrLf & _
                 "[Sí] - Abrir el Sistema en el Navegador" & vbCrLf & _
                 "[No] - Apagar/Detener el Sistema" & vbCrLf & _
                 "[Cancelar] - Salir sin hacer nada", _
                 3 + 32 + 256, _
                 "Control Patrimonial - Gestión")
    
    If res = 6 Then ' Sí (vbYes)
        WshShell.Run "cmd /c start http://localhost:5173/", 0, False
    ElseIf res = 7 Then ' No (vbNo)
        WshShell.Run "cmd /c call " & q & currentDir & "\detener_app.bat" & q, 0, True
        MsgBox "El Sistema de Control Patrimonial se ha detenido con éxito.", 64, "Control Patrimonial"
    End If
Else
    ' El sistema no está corriendo. Primero, limpiar posibles puertos colgados para evitar conflictos.
    WshShell.Run "cmd /c call " & q & currentDir & "\detener_app.bat" & q, 0, True

    ' Iniciar FastAPI Backend en segundo plano (puerto 8000)
    WshShell.CurrentDirectory = currentDir & "\backend"
    WshShell.Run "cmd.exe /c .venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000", 0, False

    ' Iniciar Vite Frontend en segundo plano (puerto 5173)
    WshShell.CurrentDirectory = currentDir & "\frontend"
    WshShell.Run "cmd.exe /c npm run dev", 0, False

    ' Esperar 4 segundos para que carguen los servidores antes de abrir el navegador
    WScript.Sleep 4000

    ' Abrir el navegador en el puerto del frontend local
    WshShell.Run "cmd /c start http://localhost:5173/", 0, False
End If
