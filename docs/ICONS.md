# Icones do Open Neo UI

O projeto usa tres formatos de icone para cobrir os principais sistemas:

| Plataforma | Arquivo | Uso |
| --- | --- | --- |
| Windows | `assets/icons/logo.ico` | Instalador, executavel e atalhos |
| Linux | `assets/icons/logo.svg` | AppImage, deb e launchers |
| macOS | `assets/icons/logo.icns` | DMG e app bundle |

Na migracao WinUI 3, o icone do Windows deve ser copiado para:

```text
apps/winui-shell/Assets/AppIcon.ico
```

O SVG continua sendo a fonte mais facil de editar. Quando o logo mudar, gere de
novo os formatos `.ico` e `.icns` para manter as tres plataformas alinhadas.
