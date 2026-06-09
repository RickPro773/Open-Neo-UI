#!/usr/bin/env bash
# ── 02_setup_stack.sh ────────────────────────────────────────
# Configura variáveis de ambiente e sobe a stack completa
# Execute DENTRO da pasta neotek-ai-stack: bash vps/scripts/02_setup_stack.sh
set -euo pipefail

STACK_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="$STACK_DIR/.env"

echo "▶ Diretório da stack: $STACK_DIR"

# ── Gerar .env se não existir ────────────────────────────────
if [ ! -f "$ENV_FILE" ]; then
  echo "▶ Criando .env com valores padrão..."

  API_KEY="neo-$(openssl rand -hex 16)"
  SECRET="$(openssl rand -hex 32)"

  cat > "$ENV_FILE" << EOF
# ── Gerado automaticamente por 02_setup_stack.sh ──
# Edite esses valores antes de subir em produção!

# Gateway Rust — API key para autenticar clientes
API_KEY=${API_KEY}

# Open WebUI
WEBUI_SECRET_KEY=${SECRET}

# Postgres
POSTGRES_USER=neotek
POSTGRES_PASSWORD=$(openssl rand -hex 12)
POSTGRES_DB=neotekdb
EOF

  echo "   .env criado em: $ENV_FILE"
  echo "   ⚠  Guarde a API_KEY: ${API_KEY}"
else
  echo "   .env já existe, pulando."
fi

# ── Atualizar docker-compose para usar .env ──────────────────
echo "▶ Buildando e subindo containers..."
cd "$STACK_DIR"
docker compose --env-file .env up -d --build

echo ""
echo "✅ Stack rodando!"
docker compose ps
echo ""
echo "   Open WebUI:  http://localhost:3000"
echo "   Gateway:     http://localhost:8080/health"
echo "   MCP Docs:    http://localhost:8000/docs"
echo "   Go:          http://localhost:9090/health"
