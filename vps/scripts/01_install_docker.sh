#!/usr/bin/env bash
# ── 01_install_docker.sh ─────────────────────────────────────
# Instala Docker Engine + Docker Compose no Ubuntu 22.04 (ARM ou x64)
# Execute como: bash 01_install_docker.sh
set -euo pipefail

echo "▶ Atualizando pacotes..."
sudo apt-get update -qq
sudo apt-get install -y -qq ca-certificates curl gnupg lsb-release

echo "▶ Adicionando repositório Docker..."
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

echo "▶ Instalando Docker..."
sudo apt-get update -qq
sudo apt-get install -y -qq docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin

echo "▶ Adicionando usuário ao grupo docker..."
sudo usermod -aG docker "${USER}"

echo "▶ Habilitando Docker no boot..."
sudo systemctl enable docker
sudo systemctl start docker

echo ""
echo "✅ Docker instalado com sucesso!"
echo "   Versão: $(docker --version)"
echo "   Compose: $(docker compose version)"
echo ""
echo "⚠  Execute 'newgrp docker' ou faça logout/login para usar sem sudo."
