import { ipcMain } from "electron";
import * as os from "os";
import { mainWindow } from "../main/main";

// node-pty é nativo — importado como require para compatibilidade com asar
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pty = require("node-pty");

interface IPty {
  onData:  (cb: (data: string) => void) => void;
  onExit:  (cb: (e: { exitCode: number }) => void) => void;
  write:   (data: string) => void;
  resize:  (cols: number, rows: number) => void;
  kill:    () => void;
}

const shells = new Map<number, IPty>();
let nextShellId = 1;

export function setupTerminalIPC() {

  ipcMain.handle("terminal:create", (_e, opts?: { cwd?: string; cols?: number; rows?: number }) => {
    const id    = nextShellId++;
    const shell = os.platform() === "win32"
      ? "powershell.exe"
      : (process.env.SHELL ?? "/bin/bash");

    const proc: IPty = pty.spawn(shell, [], {
      name: "xterm-256color",
      cols: opts?.cols ?? 120,
      rows: opts?.rows ?? 35,
      cwd:  opts?.cwd  ?? os.homedir(),
      env:  { ...process.env, TERM: "xterm-256color", COLORTERM: "truecolor" } as Record<string, string>,
    });

    proc.onData((data) => mainWindow?.webContents.send("terminal:data", { id, data }));
    proc.onExit(({ exitCode }) => {
      mainWindow?.webContents.send("terminal:exit", { id, exitCode });
      shells.delete(id);
    });

    shells.set(id, proc);
    return { id, shell };
  });

  ipcMain.handle("terminal:write",  (_e, { id, data }: { id: number; data: string }) => {
    shells.get(id)?.write(data);
  });

  ipcMain.handle("terminal:resize", (_e, { id, cols, rows }: { id: number; cols: number; rows: number }) => {
    shells.get(id)?.resize(cols, rows);
  });

  ipcMain.handle("terminal:kill",   (_e, { id }: { id: number }) => {
    try { shells.get(id)?.kill(); } catch {}
    shells.delete(id);
  });

  // Escreve comando no shell (a IA chama isso)
  ipcMain.handle("terminal:exec",   (_e, { id, cmd }: { id: number; cmd: string }) => {
    shells.get(id)?.write(cmd + "\r");
  });
}
