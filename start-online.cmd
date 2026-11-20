@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22 or newer is required. See docs/PHASE7-RUN.md.
  pause
  exit /b 1
)
if not exist "node_modules\socket.io\package.json" (
  call npm ci
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
echo Open http://127.0.0.1:4174 in your browser. Ctrl+C stops the server.
if exist .env (node --env-file=.env server/index.cjs) else (node server/index.cjs)
pause
