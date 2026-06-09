import { ipcMain, shell } from "electron";
import * as os from "os";
import * as http from "http";
import * as https from "https";
import Store from "electron-store";

// ─── Config persistente do servidor ─────────────────────────
// Permite apontar para PC remoto da rede em vez de localhost
const cfg = new Store<{
  serverHost:  string;
  ollamaHost:  string;
  apiKey:      string;
}>({
  name: "server-config",
  defaults: {
    serverHost: "localhost",  // IP do PC com a stack (ex: 192.168.1.100)
    ollamaHost: "localhost",  // pode ser diferente do serverHost
    apiKey:     "neotek-local-dev",
  },
});

function getServices() {
  const h  = cfg.get("serverHost");
  const oh = cfg.get("ollamaHost");
  return [
    { name: "Open WebUI",    url: `http://${h}:3000`,         icon: "chat"    },
    { name: "Ollama",        url: `http://${oh}:11434`,       icon: "brain"   },
    { name: "Gateway Rust",  url: `http://${h}:8080/health`,  icon: "shield"  },
    { name: "Go MCP",        url: `http://${h}:9090/health`,  icon: "bolt"    },
    { name: "Python MCP",    url: `http://${h}:8000/health`,  icon: "python"  },
    { name: "PostgreSQL",    url: `http://${h}:5432`,         icon: "db"      },
  ];
}

function ping(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const mod = url.startsWith("https") ? https : http;
    try {
      const req = mod.get(url, { timeout: 2500 }, () => { req.destroy(); resolve(true); });
      req.on("error",   () => resolve(false));
      req.on("timeout", () => { req.destroy(); resolve(false); });
    } catch { resolve(false); }
  });
}

export function setupSystemIPC() {

  // Info do sistema local
  ipcMain.handle("system:info", () => ({
    platform:        os.platform(),
    arch:            os.arch(),
    cpus:            os.cpus().length,
    totalMem:        os.totalmem(),
    freeMem:         os.freemem(),
    hostname:        os.hostname(),
    uptime:          os.uptime(),
    nodeVersion:     process.versions.node,
    electronVersion: process.versions.electron,
  }));

  // Saúde dos serviços (usando host configurado)
  ipcMain.handle("system:services-health", async () => {
    const results = await Promise.all(
      getServices().map(async (s) => ({ ...s, online: await ping(s.url) }))
    );
    return results;
  });

  // RAM local
  ipcMain.handle("system:memory", () => {
    const total = os.totalmem();
    const free  = os.freemem();
    const used  = total - free;
    return { total, free, used, pct: Math.round((used / total) * 100) };
  });

  // ── Config do servidor remoto ────────────────────────────────
  ipcMain.handle("server:get-config", () => ({
    serverHost: cfg.get("serverHost"),
    ollamaHost: cfg.get("ollamaHost"),
    apiKey:     cfg.get("apiKey"),
  }));

  ipcMain.handle("server:set-config", (_e, config: {
    serverHost?: string;
    ollamaHost?: string;
    apiKey?:     string;
  }) => {
    if (config.serverHost !== undefined) cfg.set("serverHost", config.serverHost.trim());
    if (config.ollamaHost !== undefined) cfg.set("ollamaHost", config.ollamaHost.trim());
    if (config.apiKey     !== undefined) cfg.set("apiKey",     config.apiKey.trim());
    return { ok: true, config: {
      serverHost: cfg.get("serverHost"),
      ollamaHost: cfg.get("ollamaHost"),
      apiKey:     cfg.get("apiKey"),
    }};
  });

  // Retorna URL base do Open WebUI (para abas usarem)
  ipcMain.handle("server:get-urls", () => {
    const h  = cfg.get("serverHost");
    const oh = cfg.get("ollamaHost");
    return {
      webui:    `http://${h}:3000`,
      ollama:   `http://${oh}:11434`,
      gateway:  `http://${h}:8080`,
      mcp:      `http://${h}:8000`,
      go:       `http://${h}:9090`,
    };
  });

  // Abrir link externo no browser
  ipcMain.handle("shell:open-external", (_e, url: string) => shell.openExternal(url));
}
