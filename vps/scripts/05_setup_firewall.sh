#!/usr/bin/env bash
# ── 05_setup_firewall.sh ─────────────────────────────────────
# Configura UFW e as regras de iptables necessárias no Oracle Cloud
set -euo pipefail

echo "▶ Instalando UFW..."
sudo apt-get install -y -qq ufw

echo "▶ Regras UFW..."
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh        # 22
sudo ufw allow http       # 80
sudo ufw allow https      # 443
sudo ufw allow 3000/tcp   # Open WebUI (remova após configurar Nginx)
sudo ufw --force enable

echo "▶ Regras iptables Oracle (necessário além do UFW)..."
# O Oracle Cloud tem firewall próprio via iptables que bloqueia tudo por padrão
sudo iptables -I INPUT 6 -p tcp --dport 80    -j ACCEPT
sudo iptables -I INPUT 6 -p tcp --dport 443   -j ACCEPT
sudo iptables -I INPUT 6 -p tcp --dport 3000  -j ACCEPT
sudo iptables -I INPUT 6 -p tcp --dport 8080  -j ACCEPT

# Persiste as regras no reboot
sudo apt-get install -y -qq iptables-persistent netfilter-persistent
sudo netfilter-persistent save

echo ""
echo "✅ Firewall configurado!"
echo ""
echo "   Portas abertas: 22 (SSH), 80 (HTTP), 443 (HTTPS), 3000 (WebUI), 8080 (Gateway)"
echo ""
echo "⚠  Lembre-se de abrir as mesmas portas no painel Oracle Cloud:"
echo "   Networking → VCN → Security Lists → Add Ingress Rule"
echo "   Source CIDR: 0.0.0.0/0 | Protocol: TCP | Port Range: 3000"
