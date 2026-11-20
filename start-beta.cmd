@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 24 LTS first. See docs/PHASE9-TESTER-GUIDE.md.
  pause
  exit /b 1
)
node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)"
if errorlevel 1 (
  echo Node.js 22.13 or newer is required. Node.js 24 is recommended.
  pause
  exit /b 1
)
if not exist "node_modules\socket.io\package.json" (
  call npm ci --omit=dev
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
node scripts/start-beta.cjs
pause
