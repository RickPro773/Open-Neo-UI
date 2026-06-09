import { contextBridge, ipcRenderer } from "electron";

type Listener = (...args: any[]) => void;

const VALID_CHANNELS = new Set([
  "tab:created", "tab:updated", "tab:activated", "tab:closed",
  "tab:loading", "tab:nav-state",
  "terminal:data", "terminal:exit",
  "sidebar:state",
]);

contextBridge.exposeInMainWorld("neo", {

  tab: {
    create:    (o: { title?: string; url?: string; icon?: string }) => ipcRenderer.invoke("tab:create", o),
    activate:  (id: number)  => ipcRenderer.invoke("tab:activate",   { id }),
    close:     (id: number)  => ipcRenderer.invoke("tab:close",      { id }),
    reload:    (id: number)  => ipcRenderer.invoke("tab:reload",     { id }),
    stop:      (id: number)  => ipcRenderer.invoke("tab:stop",       { id }),
    goBack:    (id: number)  => ipcRenderer.invoke("tab:go-back",    { id }),
    goForward: (id: number)  => ipcRenderer.invoke("tab:go-forward", { id }),
    list:      ()            => ipcRenderer.invoke("tab:list"),
    devtools:  (id: number)  => ipcRenderer.invoke("tab:devtools",   { id }),
  },

  terminal: {
    create: (opts?: { cwd?: string; cols?: number; rows?: number }) =>
      ipcRenderer.invoke("terminal:create", opts),
    write:  (id: number, data: string)               => ipcRenderer.invoke("terminal:write",  { id, data }),
    resize: (id: number, cols: number, rows: number) => ipcRenderer.invoke("terminal:resize", { id, cols, rows }),
    kill:   (id: number)                             => ipcRenderer.invoke("terminal:kill",   { id }),
    exec:   (id: number, cmd: string)                => ipcRenderer.invoke("terminal:exec",   { id, cmd }),
  },

  system: {
    info:           () => ipcRenderer.invoke("system:info"),
    servicesHealth: () => ipcRenderer.invoke("system:services-health"),
    memory:         () => ipcRenderer.invoke("system:memory"),
  },

  server: {
    getConfig:   ()       => ipcRenderer.invoke("server:get-config"),
    setConfig:   (c: any) => ipcRenderer.invoke("server:set-config", c),
    getUrls:     ()       => ipcRenderer.invoke("server:get-urls"),
  },

  window: {
    minimize: () => ipcRenderer.invoke("window:minimize"),
    maximize: () => ipcRenderer.invoke("window:maximize"),
    close:    () => ipcRenderer.invoke("window:close"),
    hide:     () => ipcRenderer.invoke("window:hide"),
  },

  sidebar: {
    toggle: () => ipcRenderer.invoke("sidebar:toggle"),
  },

  shell: {
    openExternal: (url: string) => ipcRenderer.invoke("shell:open-external", url),
  },

  on:  (ch: string, fn: Listener) => {
    if (VALID_CHANNELS.has(ch)) ipcRenderer.on(ch, (_e, ...a) => fn(...a));
  },
  off: (ch: string, fn: Listener) => { ipcRenderer.off(ch, fn); },
});
