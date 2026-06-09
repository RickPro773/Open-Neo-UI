# Neotek AI — Frontend (Electron)

App desktop com abas tipo Steam. Cada aba é um BrowserView (Chromium real).

## Estrutura

```
frontend/
├── src/
│   ├── main.ts          ← processo principal Electron
│   ├── preload.ts       ← bridge segura (contextBridge)
│   └── ui/
│       ├── index.html   ← shell do chrome UI
│       ├── style.css    ← visual escuro
│       └── renderer.ts  ← lógica das abas no renderer
├── assets/
│   └── logo.svg
├── package.json
└── tsconfig.json
```

## Desenvolvimento

```bash
cd frontend
npm install
npm run dev
```

Isso compila o TypeScript em modo watch e abre o Electron ao mesmo tempo.
Certifique-se que o backend já está rodando (`docker compose up -d`).

## Build / Distribuição

```bash
# Gerar executável para a plataforma atual:
npm run dist

# Windows (.exe via NSIS):
npm run dist -- --win

# Linux (.AppImage):
npm run dist -- --linux

# macOS (.dmg):
npm run dist -- --mac
```

O output fica em `frontend/release/`.

## Abas padrão ao abrir

| Aba         | URL                           |
|-------------|-------------------------------|
| Chat        | http://localhost:3000         |
| MCP Docs    | http://localhost:8000/docs    |
| Gateway     | http://localhost:8080/health  |

## Atalhos

- `+` na barra de abas → nova aba abrindo o Open WebUI
- Quick links na navbar → abrem nova aba direto no serviço
- Botões ←  →  ⟳  → navegar dentro da aba ativa
- ✕ no título da aba → fechar aba
- Botões de janela (—  ▢  ✕) no canto superior direito
