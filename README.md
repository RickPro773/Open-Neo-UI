# Open Neo UI

**Versao:** `v0.3.3-beta`

Open Neo UI e um desktop agent workspace para Windows, feito para usar IA local
ou remota com uma interface nativa, terminal integrado, monitor de execucao,
tools locais e integracao com engines como Unity.

A partir da `v0.3.3-beta`, o projeto fica concentrado no app nativo local.
A arquitetura principal passa a ser:

```text
WinUI 3 + C# desktop
        |
        | HTTP + WebSocket
        v
Python + FastAPI local tools API
        |
        | FFI / subprocess / IPC
        v
C++/C native backend core
```

Go pode ser usado depois como worker/orquestrador opcional, mas nao e necessario
para o primeiro app funcional.

## O que o app deve fazer

- Chat com IA local/remota.
- Terminal integrado em abas.
- Aba especial para monitorar o que a IA esta fazendo.
- Execucao de tools locais com aprovacao.
- Leitura e escrita de arquivos do workspace.
- Integracao com Git.
- Deteccao de projetos Unity.
- Criacao e edicao de scripts C# para Unity.
- Uso de C++/C no backend para processos, watchers e partes criticas.

## Stack oficial

| Camada | Tecnologia | Status |
| --- | --- | --- |
| Desktop | WinUI 3 + C#/.NET 8 | Principal |
| API local | Python + FastAPI | Principal |
| Core nativo | C++/C | Principal |
| Containers | Docker Compose | Local/dev |
| Worker opcional | Go | Opcional |

## Estrutura

```text
apps/
  winui-shell/          # Desktop WinUI 3 + C#
core/
  native/               # Backend core C/C++
services/
  api-python/           # FastAPI local
  agent-runtime/        # Contratos e politicas do agente
infra/
  docker/               # Docker local
orchestrator-go/        # Worker opcional em Go
docs/
  ARCHITECTURE.md
  ICONS.md
  RELEASE_V0.3.3-beta.md
```

## Rodar API local

```powershell
cd E:\Open-Neo-UI-Workspace\Open-Neo-UI\services\api-python
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Teste:

```powershell
curl http://localhost:8000/health
```

## Rodar desktop WinUI

Requer Visual Studio com:

- .NET desktop development
- Windows App SDK
- Windows 10/11 SDK

Depois:

```powershell
cd E:\Open-Neo-UI-Workspace\Open-Neo-UI
dotnet build apps\winui-shell\OpenNeo.UI.csproj
dotnet run --project apps\winui-shell\OpenNeo.UI.csproj
```

## Rodar com Docker

```powershell
docker compose up --build
```

O Compose atual sobe apenas servicos locais essenciais.

## Icones

- Windows: `assets/icons/logo.ico`
- Linux: `assets/icons/logo.svg`
- macOS: `assets/icons/logo.icns`

Detalhes em [docs/ICONS.md](docs/ICONS.md).

## Commit sugerido

```powershell
git add .
git commit -m "Release v0.3.3-beta WinUI native architecture"
git tag v0.3.3-beta
git push origin main
git push origin v0.3.3-beta
```
