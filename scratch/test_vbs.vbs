Set FSO = CreateObject("Scripting.FileSystemObject")
Set WshShell = CreateObject("WScript.Shell")
currentDir = FSO.GetParentFolderName(FSO.GetParentFolderName(WScript.ScriptFullName))

WshShell.CurrentDirectory = currentDir & "\backend"
WScript.Echo "Current directory: " & WshShell.CurrentDirectory

cmdBackend = "cmd.exe /c .venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000"
WScript.Echo "Running command: " & cmdBackend

errNum = WshShell.Run(cmdBackend, 0, True)
WScript.Echo "Exit code: " & errNum
