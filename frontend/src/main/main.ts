import {
  app, BrowserWindow, BrowserView, ipcMain,
  shell, Menu, Tray, nativeImage, session, nativeTheme, globalShortcut
} from "electron";
import * as path from "path";
import * as os from "os";
import Store from "electron-store";
import { setupTerminalIPC } from "../ipc/terminal";
import { setupTabIPC }      from "../ipc/tabs";
import { setupSystemIPC }   from "../ipc/system";

// ─── Config persistente ─────────────────────────────────────
const store = new Store<{
  windowBounds: { width: number; height: number; x?: number; y?: number };
  sidebarPinned: boolean;
}>({
  defaults: {
    windowBounds: { width: 1400, height: 860 },
    sidebarPinned: true,
  },
});

const serverCfg = new Store<{ serverHost: string; ollamaHost: string }>({
  name: "server-config",
  defaults: { serverHost: "localhost", ollamaHost: "localhost" },
});

function getServerUrls() {
  const h  = serverCfg.get("serverHost");
  const oh = serverCfg.get("ollamaHost");
  return {
    webui:   `http://${h}:3000`,
    ollama:  `http://${oh}:11434`,
    gateway: `http://${h}:8080/health`,
    mcp:     `http://${h}:8000/docs`,
    go:      `http://${h}:9090/health`,
  };
}

// ─── Layout ──────────────────────────────────────────────────
export const TITLEBAR_H = 40;
export const TABBAR_H   = 42;
export const NAVBAR_H   = 38;
export const SIDEBAR_W  = 56;
export const CHROME_H   = TITLEBAR_H + TABBAR_H + NAVBAR_H;

export let mainWindow: BrowserWindow;
export let tray: Tray | null = null;

export interface Tab {
  id: number; title: string; url: string; icon: string;
  view: BrowserView;
  isLoading: boolean; canGoBack: boolean; canGoForward: boolean;
}

export const tabs = new Map<number, Tab>();
export let activeTabId = 0;
let nextTabId = 1;
export function getNextId() { return nextTabId++; }

function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  let t: ReturnType<typeof setTimeout>;
  return ((...a: unknown[]) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }) as T;
}

// ─── Janela ──────────────────────────────────────────────────
function createWindow() {
  const bounds = store.get("windowBounds");
  mainWindow = new BrowserWindow({
    ...bounds,
    minWidth: 900, minHeight: 600,
    frame: false,
    backgroundColor: "#08080a",
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: false,
      spellcheck: false,
    },
    icon: path.join(__dirname, "../../assets/icons/icon.png"),
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, "../../src/renderer/shell/index.html"));

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    openDefaultTabs();
  });

  mainWindow.on("resize", debounce(() => {
    store.set("windowBounds", mainWindow.getBounds());
    updateActiveBounds();
  }, 120));
  mainWindow.on("move", debounce(() => store.set("windowBounds", mainWindow.getBounds()), 120));
  mainWindow.on("closed", () => {
    tabs.forEach((t) => { try { (t.view.webContents as any).destroy(); } catch {} });
    tabs.clear();
  });
  mainWindow.webContents.on("will-navigate", (e) => e.preventDefault());

  setupTray();
  setupShortcuts();
}

function setupTray() {
  try {
    const img = nativeImage.createFromPath(path.join(__dirname, "../../assets/icons/tray.png"));
    tray = new Tray(img.isEmpty() ? nativeImage.createEmpty() : img);
    tray.setToolTip("Neo UI");
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: "Abrir", click: () => mainWindow.show() },
      { type: "separator" },
      { label: "Sair",  click: () => app.quit() },
    ]));
    tray.on("click", () => mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show());
  } catch {}
}

function setupShortcuts() {
  globalShortcut.register("CommandOrControl+T", () => {
    const urls = getServerUrls();
    createTab("Nova aba", urls.webui, "chat");
  });
  globalShortcut.register("CommandOrControl+W", () => { if (activeTabId) closeTab(activeTabId); });
  globalShortcut.register("CommandOrControl+R", () => tabs.get(activeTabId)?.view.webContents.reload());
  globalShortcut.register("F12", () => tabs.get(activeTabId)?.view.webContents.openDevTools({ mode: "detach" }));
}

// ─── Abas padrão com URLs do config ──────────────────────────
function openDefaultTabs() {
  const urls = getServerUrls();
  createTab("Chat IA",      urls.webui,   "chat");
  createTab("Terminal",     "neo://terminal", "terminal");
  createTab("MCP Tools",    urls.mcp,     "tools");
  createTab("Gateway",      urls.gateway, "shield");
  createTab("Orquestrador", urls.go,      "bolt");
  createTab("Configurações","neo://settings", "settings");
}

// ─── Criar aba ───────────────────────────────────────────────
export function createTab(title: string, url: string, icon: string): number {
  const id = getNextId();
  const isTerminal = url === "neo://terminal";
  const isSettings = url === "neo://settings";
  const isSpecial  = isTerminal || isSettings;

  const view = new BrowserView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: isSpecial ? path.join(__dirname, "../preload/preload.js") : undefined,
      webviewTag: false,
    },
  });

  mainWindow.addBrowserView(view);

  if (isTerminal) {
    view.webContents.loadFile(
      path.join(__dirname, "../../src/renderer/terminal/index.html")
    ).catch(() => {});
  } else if (isSettings) {
    view.webContents.loadFile(
      path.join(__dirname, "../../src/renderer/settings/index.html")
    ).catch(() => {});
  } else {
    view.webContents.loadURL(url).catch(() => {
      view.webContents.loadFile(
        path.join(__dirname, "../../src/renderer/error/index.html")
      ).catch(() => {});
    });
  }

  view.webContents.on("page-title-updated", (_, t) => {
    const tab = tabs.get(id);
    if (!tab) return;
    tab.title = t;
    mainWindow.webContents.send("tab:updated", { id, title: t });
  });

  view.webContents.on("did-start-loading", () => {
    const tab = tabs.get(id);
    if (!tab) return;
    tab.isLoading = true;
    mainWindow.webContents.send("tab:loading", { id, loading: true });
  });

  view.webContents.on("did-stop-loading", () => {
    const tab = tabs.get(id);
    if (!tab) return;
    tab.isLoading = false;
    tab.canGoBack    = view.webContents.canGoBack();
    tab.canGoForward = view.webContents.canGoForward();
    mainWindow.webContents.send("tab:loading",   { id, loading: false });
    mainWindow.webContents.send("tab:nav-state", { id, canGoBack: tab.canGoBack, canGoForward: tab.canGoForward });
  });

  view.webContents.setWindowOpenHandler(({ url: u }) => {
    shell.openExternal(u);
    return { action: "deny" };
  });

  const tab: Tab = { id, title, url, icon, view, isLoading: false, canGoBack: false, canGoForward: false };
  tabs.set(id, tab);
  setActiveTab(id);
  mainWindow.webContents.send("tab:created", { id, title, url, icon });
  return id;
}

// ─── Ativar / fechar ─────────────────────────────────────────
export function setActiveTab(id: number) {
  const tab = tabs.get(id);
  if (!tab) return;
  activeTabId = id;
  tabs.forEach((t, tid) => {
    if (tid === id) updateActiveBounds();
    else t.view.setBounds({ x: 0, y: -9999, width: 1, height: 1 });
  });
  mainWindow.webContents.send("tab:activated", {
    id, canGoBack: tab.canGoBack, canGoForward: tab.canGoForward, isLoading: tab.isLoading,
  });
}

export function updateActiveBounds() {
  const tab = tabs.get(activeTabId);
  if (!tab) return;
  const [w, h]   = mainWindow.getContentSize();
  const sidebarW = store.get("sidebarPinned") ? SIDEBAR_W : 0;
  tab.view.setBounds({
    x: sidebarW, y: CHROME_H,
    width:  Math.max(1, w - sidebarW),
    height: Math.max(1, h - CHROME_H),
  });
}

export function closeTab(id: number) {
  const tab = tabs.get(id);
  if (!tab) return;
  try { mainWindow.removeBrowserView(tab.view); } catch {}
  try { (tab.view.webContents as any).destroy(); } catch {}
  tabs.delete(id);
  if (activeTabId === id && tabs.size > 0) {
    const ids = [...tabs.keys()];
    setActiveTab(ids[ids.length - 1]);
  }
  mainWindow.webContents.send("tab:closed", { id });
}

// ─── Boot ────────────────────────────────────────────────────
app.whenReady().then(() => {
  session.defaultSession.webRequest.onBeforeSendHeaders((details, cb) => {
    cb({ requestHeaders: { ...details.requestHeaders, "User-Agent": "NeoUI/0.3.1" } });
  });
  nativeTheme.themeSource = "dark";
  Menu.setApplicationMenu(null);

  createWindow();
  setupTerminalIPC();
  setupTabIPC();
  setupSystemIPC();
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate",          () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
app.on("will-quit",         () => globalShortcut.unregisterAll());
