# Arquitetura Open Neo UI v0.3.3-beta

## Visao

Open Neo UI agora e um aplicativo desktop nativo com backend local.

```text
apps/winui-shell
  WinUI 3 + C#
  UI, abas, terminal integrado, monitor da IA

services/api-python
  Python + FastAPI
  tools locais, Git, arquivos, Unity, eventos WebSocket

core/native
  C++/C
  processos, watchers, funcoes criticas e ABI simples

orchestrator-go
  Go opcional
  workers futuros, tarefas longas e orquestracao auxiliar
```

## Fluxo principal

```text
Usuario
  -> WinUI 3 shell
  -> FastAPI local
  -> C++/C native core
  -> filesystem / Git / terminal / Unity / Ollama
```

## Desktop WinUI 3

Responsavel por:

- chat;
- abas;
- terminal integrado;
- monitor de eventos da IA;
- painel de runtime;
- configuracoes;
- aprovacoes antes de a IA executar acoes sensiveis.

## API Python/FastAPI

Endpoints iniciais:

- `GET /health`
- `GET /tools`
- `POST /workspace/list`
- `POST /workspace/read`
- `POST /workspace/write`
- `POST /git/status`
- `POST /terminal/run`
- `POST /engines/scan`
- `WS /events/ws`

## C++/C native core

Responsavel por:

- controle de processos;
- ponte de terminal;
- watchers de arquivos;
- funcoes criticas de performance;
- API C estavel para C#, Python e futuros workers.

## Docker

Docker e apenas para desenvolvimento local e servicos auxiliares:

- `api-python`;
- `ollama`.

Sem infraestrutura remota obrigatoria.

## Politicas

- A IA nao deve escrever fora do workspace sem permissao.
- Comandos precisam ser aprovados pelo usuario.
- Unity e outras engines devem receber patches revisaveis.
- Tokens ficam fora do repo.
