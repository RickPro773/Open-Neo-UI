import { ipcMain } from "electron";
import {
  createTab, setActiveTab, closeTab,
  tabs, activeTabId, updateActiveBounds, mainWindow
} from "../main/main";
import Store from "electron-store";

const store = new Store<{ sidebarPinned: boolean }>({ defaults: { sidebarPinned: true } });

export function setupTabIPC() {
  ipcMain.handle("tab:create",    (_e, o: { title?: string; url?: string; icon?: string }) =>
    createTab(o.title ?? "Nova aba", o.url ?? "http://localhost:3000", o.icon ?? "globe")
  );
  ipcMain.handle("tab:activate",  (_e, { id }: { id: number }) => setActiveTab(id));
  ipcMain.handle("tab:close",     (_e, { id }: { id: number }) => closeTab(id));
  ipcMain.handle("tab:reload",    (_e, { id }: { id: number }) => tabs.get(id)?.view.webContents.reload());
  ipcMain.handle("tab:stop",      (_e, { id }: { id: number }) => tabs.get(id)?.view.webContents.stop());
  ipcMain.handle("tab:go-back",   (_e, { id }: { id: number }) => {
    const t = tabs.get(id);
    if (t?.view.webContents.canGoBack()) t.view.webContents.goBack();
  });
  ipcMain.handle("tab:go-forward",(_e, { id }: { id: number }) => {
    const t = tabs.get(id);
    if (t?.view.webContents.canGoForward()) t.view.webContents.goForward();
  });
  ipcMain.handle("tab:list",      () =>
    [...tabs.values()].map(({ id, title, url, icon, isLoading, canGoBack, canGoForward }) =>
      ({ id, title, url, icon, isLoading, canGoBack, canGoForward })
    )
  );
  ipcMain.handle("tab:devtools",  (_e, { id }: { id: number }) =>
    tabs.get(id)?.view.webContents.openDevTools({ mode: "detach" })
  );
  ipcMain.handle("sidebar:toggle", () => {
    const v = !store.get("sidebarPinned");
    store.set("sidebarPinned", v);
    updateActiveBounds();
    mainWindow.webContents.send("sidebar:state", { pinned: v });
  });
  ipcMain.handle("window:minimize", () => mainWindow.minimize());
  ipcMain.handle("window:maximize", () =>
    mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize()
  );
  ipcMain.handle("window:close",    () => mainWindow.close());
  ipcMain.handle("window:hide",     () => mainWindow.hide());
}
