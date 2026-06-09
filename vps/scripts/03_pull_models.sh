#!/usr/bin/env bash
# ── 03_pull_models.sh ────────────────────────────────────────
# Baixa modelos no Ollama de acordo com a RAM disponível
set -euo pipefail

echo "▶ Detectando RAM total..."
TOTAL_RAM_GB=$(awk '/MemTotal/ { printf "%.0f", $2/1024/1024 }' /proc/meminfo)
echo "   RAM total: ${TOTAL_RAM_GB}GB"

# Aguarda Ollama estar de pé
echo "▶ Aguardando Ollama..."
for i in $(seq 1 20); do
  if docker exec ollama ollama list &>/dev/null; then break; fi
  echo "   Tentativa $i/20..."
  sleep 3
done

pull_model() {
  local MODEL="$1"
  echo "▶ Baixando $MODEL..."
  docker exec ollama ollama pull "$MODEL"
  echo "   ✅ $MODEL pronto!"
}

echo ""
echo "RAM disponível: ${TOTAL_RAM_GB}GB"

if   [ "$TOTAL_RAM_GB" -ge 20 ]; then
  echo "▶ Modo: HIGH — baixando qwen3:14b (recomendado)"
  pull_model "qwen3:14b"
  pull_model "qwen3:8b"        # modelo rápido secundário
elif [ "$TOTAL_RAM_GB" -ge 12 ]; then
  echo "▶ Modo: MEDIUM — baixando qwen3:8b"
  pull_model "qwen3:8b"
  pull_model "gemma3:4b"
elif [ "$TOTAL_RAM_GB" -ge 6 ]; then
  echo "▶ Modo: LOW — baixando gemma3:4b"
  pull_model "gemma3:4b"
else
  echo "▶ Modo: MINIMAL — baixando qwen3:1.7b"
  pull_model "qwen3:1.7b"
fi

echo ""
echo "✅ Modelos instalados:"
docker exec ollama ollama list
