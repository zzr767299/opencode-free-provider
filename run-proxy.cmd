@echo off
setlocal
cd /d "%~dp0opencode-free-provider"

where node >nul 2>nul
if errorlevel 1 goto nonode

node -e "fetch('http://127.0.0.1:8791/v1/models').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >nul 2>nul
if not errorlevel 1 goto running

echo Starting OpenCode free-model proxy...
node run.mjs
echo.
echo Proxy exited. See the message above.
pause
exit /b 0

:running
echo Proxy is already running at http://127.0.0.1:8791/v1
pause
exit /b 0

:nonode
echo [ERROR] Node.js not found in PATH. Install Node.js first: https://nodejs.org
pause
exit /b 1
