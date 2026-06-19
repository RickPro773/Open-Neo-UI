# Open Neo UI WinUI Shell

Aplicativo desktop principal em WinUI 3 + C#. Esta e a direcao oficial da v0.3.3-beta.

## Responsabilidades

- UI nativa do Windows;
- chat com agentes;
- abas de terminal integrado;
- painel de monitoramento da IA;
- configuracoes de modelos e providers;
- aprovacao de acoes sensiveis;
- integracao com a API FastAPI local.
- chamadas ao backend/core C++/C para processos, watchers e partes criticas.

## Rodar

Criar uma solucao .NET:

```powershell
dotnet build .\OpenNeo.UI.csproj
dotnet run --project .\OpenNeo.UI.csproj
```

Caso o template `winui` nao exista, instale o Windows App SDK e os workloads de
desenvolvimento desktop no Visual Studio.
