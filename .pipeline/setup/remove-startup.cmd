@echo off
rem Stops the agent pipeline from starting when you sign in.
for %%I in ("%~dp0..\..") do set "PROJECT=%%~nxI"
set "TARGET=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Agent Pipeline - %PROJECT%.cmd"
if exist "%TARGET%" (del "%TARGET%" & echo Removed from Windows startup.) else (echo It was not set to start with Windows.)
pause
