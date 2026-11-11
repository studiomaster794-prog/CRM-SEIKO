@echo off
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Instale o Node.js em https://nodejs.org e tente de novo.
  pause
  exit /b 1
)
if not exist "node_modules\" (
  echo Instalando dependencias...
  call npm install
  if errorlevel 1 (
    echo Falhou ao instalar. Rode npm install nesta pasta.
    pause
    exit /b 1
  )
)
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri http://127.0.0.1:5173 -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -ge 200) { exit 0 } } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 (
  start "" "http://127.0.0.1:5173"
  echo CRM ja estava ligado. Abri no navegador.
  timeout /t 4 >nul
  exit /b 0
)
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://127.0.0.1:5173"
echo Abrindo o CRM Studio Seiko...
echo Nao feche esta janela enquanto usar o CRM.
node server.mjs
if errorlevel 1 pause
