# Neotek AI Stack — Setup no VPS Oracle

## Requisitos
- VPS Oracle Free Tier (4 OCPUs ARM / 24GB RAM)
- Ubuntu 22.04
- Docker + Docker Compose instalados

## 1. Instalar Docker no Ubuntu

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
```

## 2. Subir a stack

```bash
git clone <seu-repo> neotek-ai-stack
cd neotek-ai-stack

# Editar variáveis de ambiente antes de subir:
# - WEBUI_SECRET_KEY no docker-compose.yml
# - API_KEY no docker-compose.yml

docker compose up -d --build
```

## 3. Baixar modelos no Ollama

```bash
# Modelo leve (4GB RAM):
docker exec ollama ollama pull gemma3:4b

# Modelo médio (8GB RAM):
docker exec ollama ollama pull qwen3:8b

# Modelo maior (16GB RAM):
docker exec ollama ollama pull qwen3:14b
```

## 4. Acessar

- Open WebUI: http://SEU_IP:3000
- Gateway Rust: http://SEU_IP:8080/health
- Orquestrador Go: http://SEU_IP:9090/health
- MCP Python: http://SEU_IP:8000/docs
- MCP Tools list: http://SEU_IP:8000/tools

## 5. Abrir portas no Oracle (Firewall)

No painel Oracle Cloud → VCN → Security Lists → adicionar Ingress Rules:
- Porta 3000 (Open WebUI)
- Porta 8080 (Gateway)

Também no Ubuntu:
```bash
sudo iptables -I INPUT -p tcp --dport 3000 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 8080 -j ACCEPT
sudo netfilter-persistent save
```

## Serviços

| Serviço         | Porta | Tecnologia     | Função                        |
|-----------------|-------|----------------|-------------------------------|
| Open WebUI      | 3000  | Docker image   | Interface do usuário          |
| Ollama          | 11434 | Docker image   | Modelos de IA locais          |
| Gateway Rust    | 8080  | Rust / Axum    | Proxy, auth, rate limit       |
| Orquestrador Go | 9090  | Go             | Roteamento de tools MCP       |
| MCP Python      | 8000  | FastAPI        | Tools reais (arquivos, shell) |
| PostgreSQL      | 5432  | Postgres 16    | Banco de dados                |

## Próximos passos (futuras versões)

- [ ] Nginx como reverse proxy com HTTPS (Let's Encrypt)
- [ ] Autenticação JWT no gateway Rust
- [ ] gRPC real entre Go e Python
- [ ] Mais tools MCP (GitHub, busca avançada, geração de código)
- [ ] Dashboard de monitoramento (Grafana + Prometheus)
