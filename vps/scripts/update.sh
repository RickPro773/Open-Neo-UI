#!/usr/bin/env bash
# ── update.sh ────────────────────────────────────────────────
# Atualiza a stack: puxa imagens novas, rebuild dos serviços custom,
# reinicia tudo com mínimo downtime
set -euo pipefail

STACK_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$STACK_DIR"

echo "[$(date)] ▶ Iniciando atualização da stack..."

echo "▶ Puxando imagens base mais recentes..."
docker compose pull --ignore-pull-failures

echo "▶ Rebuild dos serviços custom (Rust, Go, Python)..."
docker compose build --no-cache gateway-rust orchestrator-go mcp-python

echo "▶ Reiniciando serviços com rolling update..."
docker compose up -d --remove-orphans

echo "▶ Limpando imagens antigas não utilizadas..."
docker image prune -f

echo ""
echo "[$(date)] ✅ Stack atualizada!"
docker compose ps
