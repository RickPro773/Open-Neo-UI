# WinUI Shell Notes

Primeira versao v0.3.3-beta:

- `MainWindow`: layout com NavigationView lateral.
- `ChatPage`: conversa com IA.
- `TerminalPage`: terminal integrado e monitor da IA.
- `SettingsPage`: providers, Ollama, Docker e permissoes.
- `EnginePage`: projetos Unity detectados e scripts gerados.

Contrato inicial:

- WinUI consome `GET /health` para detectar a API local.
- WinUI consome `GET /tools` para listar ferramentas disponiveis.
- WinUI conecta em `WS /events/ws` para receber eventos em tempo real.
