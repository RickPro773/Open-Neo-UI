# Open Neo UI Native Core

Core em C++/C para funcoes criticas.

Versao: `0.3.3-beta`

## Responsabilidades

- processos e terminal;
- watchers de arquivos;
- integracao nativa com Windows;
- funcoes de alta performance;
- API estavel para C# e Python.

## Regra de design

Manter o core pequeno. A logica de produto deve ficar no app C# e na API Python.
O core deve expor primitivas confiaveis, testaveis e com ABI simples.

## Build

```powershell
cd E:\Open-Neo-UI-Workspace\Open-Neo-UI\core\native
cmake -S . -B build
cmake --build build --config Release
```
