@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title Neotek — Instalar Ollama + Modelos

echo.
echo ╔══════════════════════════════════════════════════╗
echo ║     Neotek AI — Instalador de Modelos Locais    ║
echo ╚══════════════════════════════════════════════════╝
echo.

REM ── Verificar se Ollama já está instalado ─────────────────
where ollama >nul 2>&1
if %ERRORLEVEL% == 0 (
    echo [OK] Ollama já instalado: 
    ollama --version
    goto :PULL_MODELS
)

echo [INFO] Ollama não encontrado. Baixando instalador...
echo.

REM ── Baixar e instalar Ollama ──────────────────────────────
set OLLAMA_URL=https://ollama.com/download/OllamaSetup.exe
set OLLAMA_INSTALLER=%TEMP%\OllamaSetup.exe

echo Baixando de: %OLLAMA_URL%
powershell -Command "& {Invoke-WebRequest -Uri '%OLLAMA_URL%' -OutFile '%OLLAMA_INSTALLER%' -UseBasicParsing}"

if not exist "%OLLAMA_INSTALLER%" (
    echo [ERRO] Falha ao baixar Ollama.
    echo Acesse manualmente: https://ollama.com/download
    pause
    exit /b 1
)

echo [INFO] Instalando Ollama...
"%OLLAMA_INSTALLER%" /S
timeout /t 5 >nul

REM Recarrega PATH
call RefreshEnv.cmd >nul 2>&1 || (
    set "PATH=%PATH%;%LOCALAPPDATA%\Programs\Ollama"
)

echo [OK] Ollama instalado!
echo.

:PULL_MODELS
echo ── Detectando VRAM / RAM ─────────────────────────────────
echo.

REM Detecta VRAM via NVIDIA (opcional)
set VRAM_GB=0
for /f "tokens=*" %%i in ('nvidia-smi --query-gpu^=memory.total --format^=csv^,noheader^,nounits 2^>nul') do (
    set /a VRAM_MB=%%i
    set /a VRAM_GB=VRAM_MB / 1024
)

REM RAM total
for /f "tokens=2" %%i in ('wmic ComputerSystem get TotalPhysicalMemory /value ^| find "="') do set RAM_BYTES=%%i
set /a RAM_GB=RAM_BYTES / 1073741824

echo RAM total: !RAM_GB! GB
if !VRAM_GB! GTR 0 (
    echo VRAM NVIDIA: !VRAM_GB! GB
) else (
    echo GPU NVIDIA: nao detectada ^(usara CPU/RAM^)
)
echo.

echo Qual modelo deseja instalar?
echo.
echo  [1] qwen3:1.7b   ~1GB   — muito rapido, qualidade basica    (2GB+ RAM)
echo  [2] qwen3:8b     ~5GB   — boa qualidade, rapido             (8GB+ RAM)
echo  [3] qwen3:14b    ~9GB   — alta qualidade                    (16GB+ RAM)
echo  [4] gemma3:4b    ~3GB   — Google, bom para codigo           (6GB+ RAM)
echo  [5] llama3.1:8b  ~5GB   — Meta, versatil                   (8GB+ RAM)
echo  [6] Todos (qwen3:8b + gemma3:4b)
echo  [7] Personalizado — digitar nome do modelo
echo.

set /p CHOICE="Escolha [1-7]: "

if "%CHOICE%"=="1" set MODEL=qwen3:1.7b
if "%CHOICE%"=="2" set MODEL=qwen3:8b
if "%CHOICE%"=="3" set MODEL=qwen3:14b
if "%CHOICE%"=="4" set MODEL=gemma3:4b
if "%CHOICE%"=="5" set MODEL=llama3.1:8b
if "%CHOICE%"=="6" goto :PULL_MULTI
if "%CHOICE%"=="7" (
    set /p MODEL="Nome do modelo (ex: mistral:7b): "
)

echo.
echo [INFO] Baixando %MODEL%... (pode demorar dependendo da velocidade)
ollama pull %MODEL%
if %ERRORLEVEL% == 0 (
    echo [OK] %MODEL% instalado com sucesso!
) else (
    echo [ERRO] Falha ao baixar %MODEL%
)
goto :END

:PULL_MULTI
echo [INFO] Baixando qwen3:8b...
ollama pull qwen3:8b
echo [INFO] Baixando gemma3:4b...
ollama pull gemma3:4b

:END
echo.
echo ── Modelos instalados ────────────────────────────────────
ollama list
echo.
echo [OK] Pronto! Execute 02_start_stack.bat para subir os servicos.
echo.
pause
