@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title Neotek AI Stack — Iniciar

echo.
echo ╔══════════════════════════════════════════════════╗
echo ║         Neotek AI Stack — Iniciar               ║
echo ╚══════════════════════════════════════════════════╝
echo.

REM ── Verificar Docker ──────────────────────────────────────
docker info >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Docker nao esta rodando!
    echo Por favor abra o Docker Desktop e aguarde inicializar.
    echo.
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    echo Aguardando Docker inicializar...
    timeout /t 10 >nul
    docker info >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        echo [ERRO] Docker ainda nao esta pronto. Tente novamente.
        pause
        exit /b 1
    )
)
echo [OK] Docker rodando.

REM ── Verificar Ollama ──────────────────────────────────────
where ollama >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [AVISO] Ollama nao encontrado. Execute 01_install_ollama.bat primeiro.
)

REM Verificar se Ollama serve está rodando
curl -s http://localhost:11434 >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [INFO] Iniciando Ollama em background...
    start /b "" ollama serve
    timeout /t 3 >nul
)
echo [OK] Ollama rodando em localhost:11434

REM ── Criar .env se não existir ─────────────────────────────
set SCRIPT_DIR=%~dp0
set ROOT_DIR=%SCRIPT_DIR%..

if not exist "%ROOT_DIR%\.env" (
    echo [INFO] Criando .env com valores padrao...
    copy "%ROOT_DIR%\.env.example" "%ROOT_DIR%\.env" >nul
    echo [AVISO] Edite %ROOT_DIR%\.env para personalizar as senhas!
)

REM ── Subir containers ──────────────────────────────────────
echo.
echo [INFO] Subindo containers Docker...
cd /d "%ROOT_DIR%"
docker compose up -d --build

if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Falha ao subir containers. Veja o log acima.
    pause
    exit /b 1
)

echo.
echo [INFO] Aguardando servicos ficarem prontos...
timeout /t 8 >nul

REM ── Descobrir IP local ────────────────────────────────────
set LOCAL_IP=
for /f "tokens=2 delims=:" %%i in ('ipconfig ^| findstr /c:"IPv4"') do (
    set IP=%%i
    set IP=!IP: =!
    REM Pegar apenas IP da rede local (192.168.x.x ou 10.x.x.x)
    echo !IP! | findstr /r "^192\.168\." >nul && set LOCAL_IP=!IP!
    echo !IP! | findstr /r "^10\."       >nul && set LOCAL_IP=!IP!
)

echo.
echo ╔══════════════════════════════════════════════════╗
echo ║              Stack rodando!                     ║
echo ╠══════════════════════════════════════════════════╣
echo ║                                                 ║
echo ║  NESTE PC (localhost):                          ║
echo ║    Open WebUI:  http://localhost:3000           ║
echo ║    Gateway:     http://localhost:8080/health    ║
echo ║    MCP Docs:    http://localhost:8000/docs      ║
echo ║    Ollama:      http://localhost:11434          ║
echo ║                                                 ║
if not "!LOCAL_IP!"=="" (
echo ║  OUTROS PCs NA REDE (use este IP no Neo UI):   ║
echo ║    Open WebUI:  http://!LOCAL_IP!:3000         ║
echo ║    Ollama:      http://!LOCAL_IP!:11434        ║
)
echo ║                                                 ║
echo ╚══════════════════════════════════════════════════╝
echo.
echo Pressione qualquer tecla para acompanhar os logs...
echo (feche esta janela para parar de ver logs; containers continuam)
pause >nul
docker compose logs -f
