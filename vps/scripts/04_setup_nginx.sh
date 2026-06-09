#!/usr/bin/env bash
# ── 04_setup_nginx.sh ────────────────────────────────────────
# Instala Nginx e configura HTTPS com Let's Encrypt (Certbot)
# Uso: bash 04_setup_nginx.sh SEU_DOMINIO seu@email.com
set -euo pipefail

DOMAIN="${1:-}"
EMAIL="${2:-admin@example.com}"

if [ -z "$DOMAIN" ]; then
  echo "Uso: bash 04_setup_nginx.sh SEU_DOMINIO [email]"
  echo "Exemplo: bash 04_setup_nginx.sh ai.meusite.com admin@meusite.com"
  exit 1
fi

echo "▶ Instalando Nginx e Certbot..."
sudo apt-get update -qq
sudo apt-get install -y -qq nginx certbot python3-certbot-nginx

CONF="/etc/nginx/sites-available/neotek"

echo "▶ Criando config Nginx para $DOMAIN..."
sudo tee "$CONF" > /dev/null << NGINX
server {
    listen 80;
    server_name ${DOMAIN};

    # Redireciona HTTP → HTTPS (preenchido pelo certbot depois)
    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name ${DOMAIN};

    # Certbot preenche os caminhos de cert abaixo
    ssl_certificate     /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Headers de segurança
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
    add_header X-Frame-Options SAMEORIGIN always;
    add_header X-Content-Type-Options nosniff always;

    # ── Open WebUI (interface principal) ──────────────────
    location / {
        proxy_pass         http://localhost:3000;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade \$http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_read_timeout 3600s;
    }

    # ── Gateway Rust (API autenticada) ─────────────────────
    location /api/ {
        proxy_pass       http://localhost:8080/api/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
NGINX

sudo ln -sf "$CONF" /etc/nginx/sites-enabled/neotek
sudo nginx -t

echo "▶ Obtendo certificado SSL para $DOMAIN..."
sudo certbot --nginx -d "$DOMAIN" --email "$EMAIL" --agree-tos --non-interactive

echo "▶ Reiniciando Nginx..."
sudo systemctl reload nginx

echo ""
echo "✅ HTTPS configurado!"
echo "   Acesse: https://${DOMAIN}"

# Auto-renovação
echo "▶ Configurando renovação automática..."
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet && systemctl reload nginx") | crontab -
echo "   Renovação: diariamente às 3h"
