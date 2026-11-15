@echo off
rem Starts the agent pipeline for this project:
rem   1. copies agents, commands and hooks into .claude (only what changed)
rem   2. starts the dashboard server in a minimised window
rem   3. opens the dashboard in your default browser
cd /d "%~dp0..\.."

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed, so the agent pipeline can't start.
  echo Install it with:  winget install OpenJS.NodeJS.LTS
  echo then sign out and back in.
  pause
  exit /b 1
)

node .pipeline\setup\install-claude-files.mjs --quiet
start "Agent Pipeline dashboard (close to stop)" /min node .pipeline\dashboard\server.mjs --port 4701 --open
