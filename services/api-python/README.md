# Open Neo UI API Python

Servico FastAPI para tools, automacoes, Git, engines e eventos do terminal.

Versao: `0.3.3-beta`

## Responsabilidades

- endpoints locais para o WinUI Shell;
- WebSocket de eventos;
- tools de arquivo, terminal e Git;
- descoberta de projetos Unity;
- criacao e edicao de scripts com aprovacao;
- integracao com modelos e providers.

## Proximo passo

Criar o app FastAPI base:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install fastapi uvicorn pydantic
uvicorn app.main:app --reload --port 8000
```

Endpoints principais:

- `GET /health`
- `GET /tools`
- `POST /workspace/list`
- `POST /workspace/read`
- `POST /workspace/write`
- `POST /git/status`
- `POST /terminal/run`
- `POST /engines/scan`
- `WS /events/ws`
