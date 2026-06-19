# Open Neo UI v0.3.3-beta

## Major update

Esta release limpa a direcao do projeto:

- concentra o projeto em execucao local;
- remove a arquitetura antiga da rota principal;
- define o app nativo como desktop ativo;
- define WinUI 3 + C# como app principal;
- define Python/FastAPI como API local;
- define C++/C como backend core nativo;
- mantem Go apenas como opcional.

## O que foi preparado

- README refeito.
- Docker Compose local simplificado.
- API FastAPI com workspace, Git, terminal e scan de Unity.
- WinUI Shell com layout inicial moderno.
- Core C/C++ com CMake.
- Documentacao de icones por plataforma.

## Comandos de release

```powershell
git add .
git commit -m "Release v0.3.3-beta native WinUI update"
git tag v0.3.3-beta
git push origin main
git push origin v0.3.3-beta
```
