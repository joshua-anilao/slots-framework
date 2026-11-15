@echo off
rem Run once: starts the agent pipeline every time you sign in to Windows.
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
for %%I in ("%~dp0..\..") do set "PROJECT=%%~nxI"
set "TARGET=%STARTUP%\Agent Pipeline - %PROJECT%.cmd"
> "%TARGET%" echo @echo off
>> "%TARGET%" echo call "%~dp0start-pipeline.cmd"
echo Added to Windows startup: "%TARGET%"
echo It will run the next time you sign in. Starting it now as well...
call "%~dp0start-pipeline.cmd"
