Set FSO = CreateObject("Scripting.FileSystemObject")
Set WshShell = CreateObject("WScript.Shell")
currentDir = FSO.GetParentFolderName(WScript.ScriptFullName)
WshShell.Run "cmd /c call """ & currentDir & "\iniciar_app.bat""", 0, false
