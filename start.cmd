@echo off
setlocal
cd /d "%~dp0"
set "DAILY_OPS_NODE=node"
where node >nul 2>nul
if errorlevel 1 set "DAILY_OPS_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not exist "node_modules\vite\bin\vite.js" (
  echo Dependencies are missing. Install Node.js and pnpm, then run pnpm install --frozen-lockfile.
  exit /b 1
)
if /I "%~1"=="--production" (
  if not exist "dist\index.html" (
    echo The production build is missing. Run pnpm build first.
    exit /b 1
  )
  "%DAILY_OPS_NODE%" node_modules\vite\bin\vite.js preview --host 0.0.0.0 --port 4173 --strictPort
) else (
  "%DAILY_OPS_NODE%" node_modules\vite\bin\vite.js --host 0.0.0.0 --port 5173 --strictPort
)
exit /b %ERRORLEVEL%
