# Como atualizar o repositorio no GitHub

Repositorio: `RickPro773/Open-Neo-UI`

## 1. Entre na pasta do projeto

```powershell
cd E:\Open-Neo-UI-Workspace\Open-Neo-UI
```

## 2. Veja o que mudou

```powershell
git status
```

## 3. Baixe atualizacoes antes de enviar

```powershell
git pull origin main
```

Se aparecer conflito, resolva os arquivos marcados, teste de novo e depois rode:

```powershell
git add .
git commit
```

## 4. Adicione suas alteracoes

```powershell
git add README.md docs apps core services infra
```

## 5. Crie um commit

```powershell
git commit -m "Release v0.3.3-beta native WinUI update"
```

## 6. Envie para o GitHub

```powershell
git push origin main
```

## Se o Git pedir login

Use o login do GitHub pelo navegador quando o Git Credential Manager abrir.
Se ele pedir senha no terminal, use um Personal Access Token do GitHub em vez da
senha da conta.

## Comandos uteis

Ver branch atual:

```powershell
git branch
```

Ver historico:

```powershell
git log --oneline -5
```

Ver arquivos alterados:

```powershell
git diff --stat
```

Desfazer um arquivo antes do commit:

```powershell
git restore caminho\do\arquivo
```

## Fluxo recomendado

```powershell
cd E:\Open-Neo-UI-Workspace\Open-Neo-UI
git status
git pull origin main
git add .
git commit -m "Descreva sua alteracao"
git push origin main
```
