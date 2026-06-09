@echo off
chcp 65001 >nul
title Neotek AI Stack — Parar

echo.
echo [INFO] Parando todos os containers Neotek...
cd /d "%~dp0.."
docker compose down

echo [INFO] Parando Ollama...
taskkill /f /im "ollama.exe" >nul 2>&1

echo.
echo [OK] Stack parada. Dados persistidos em volumes Docker.
echo.
pause
