# Open Neo UI

Proxy local de IA · OpenAI-compatible · Tool calling · Multi-provider · ISC License

## Estrutura

```
src/
├── index.ts              # Entry point + servidor Hono + todos os middlewares
├── login.ts              # Auth: Discord, GitHub, Google OAuth2 + JWT
├── db.ts                 # SQLite via bun:sqlite (built-in, sem pacote extra)
├── ollama.ts             # Wrapper Ollama (pull, list, delete, chat)
├── gpu.ts                # Monitor GPU/RAM/CPU (nvidia-smi)
├── remote.ts             # Tokens de acesso remoto (bcrypt via Bun.password)
├── routes/
│   └── chat.ts           # POST /v1/chat/completions + /api/chat
├── services/
│   ├── deepseek.ts       # Cliente multi-provider (DeepSeek, OpenAI, Anthropic...)
│   └── playwright.ts     # Browser headless para busca web
├── tools/
│   ├── types.ts          # Tipos do sistema de tools
│   ├── schema.ts         # Validação JSON Schema (sem deps)
│   ├── registry.ts       # Registro de tools + tools built-in
│   └── executor.ts       # Execução com timeout + traces
├── runtime/
│   ├── types.ts          # Tipos do runtime
│   └── engine.ts         # Loop agêntico (tool_calls → execute → repeat)
├── types/
│   └── openai.ts         # Tipos OpenAI API completos
├── utils/
│   └── types.ts          # Result<T>, helpers, maskKey, fmtBytes...
├── ui/views/
│   ├── login.html        # Tela de login (Discord + GitHub + Google)
│   └── app.html          # UI principal (chat, modelos, GPU, settings)
├── index.test.ts         # Testes unitários
└── advanced.test.ts      # Testes de integração

py/
├── bridge.py             # Microserviço Python: OpenAI avançado + Gemini
└── requirements.txt      # Sem deps externas (usa stdlib)
```

## Setup

```bash
# 1. Copie o .env
cp .env.example .env

# 2. Instale dependências
bun install

# 3. Instale Playwright
npx playwright install chromium

# 4. Rode
bun dev
```

## Auth — configure pelo menos um provider

### Discord
1. https://discord.com/developers/applications → New Application
2. OAuth2 → Redirects → `http://localhost:3000/auth/discord/callback`
3. Copie Client ID e Secret para `.env`

### GitHub
1. https://github.com/settings/developers → New OAuth App
2. Callback URL: `http://localhost:3000/auth/github/callback`

### Google
1. https://console.cloud.google.com → APIs & Services → Credentials
2. OAuth 2.0 Client → Authorized redirect: `http://localhost:3000/auth/google/callback`

## Python bridge (opcional)

```bash
cd py && python bridge.py
```

Habilita: análise de imagem, DALL-E, embeddings, Gemini.

## Testes

```bash
bun test
```

## Docker

```bash
docker compose up --build
```
