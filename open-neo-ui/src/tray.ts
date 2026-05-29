/**
 * System tray integration for Windows.
 * Uses PowerShell's NotifyIcon (no external dep).
 * Spawned as a background child process from index.ts.
 */

import { exec, spawn } from "child_process"
import { writeFileSync, existsSync } from "fs"
import { join } from "path"

const PORT = process.env["PORT"] ?? "3000"
const URL  = `http://localhost:${PORT}`

// ── PowerShell script for system tray ────────────────────────────────────────
const PS_SCRIPT = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$icon = [System.Drawing.SystemIcons]::Application
$tray = New-Object System.Windows.Forms.NotifyIcon
$tray.Icon = $icon
$tray.Text = "Open Neo UI"
$tray.Visible = $true

$menu = New-Object System.Windows.Forms.ContextMenuStrip

$openItem = New-Object System.Windows.Forms.ToolStripMenuItem
$openItem.Text = "Abrir Interface"
$openItem.Add_Click({ Start-Process "${URL}" })

$sep = New-Object System.Windows.Forms.ToolStripSeparator

$quitItem = New-Object System.Windows.Forms.ToolStripMenuItem
$quitItem.Text = "Fechar Open Neo UI"
$quitItem.Add_Click({
  $tray.Visible = $false
  $tray.Dispose()
  [System.Windows.Forms.Application]::Exit()
  Stop-Process -Id $PID
})

$menu.Items.Add($openItem) | Out-Null
$menu.Items.Add($sep)      | Out-Null
$menu.Items.Add($quitItem) | Out-Null
$tray.ContextMenuStrip = $menu

$tray.Add_MouseDoubleClick({ Start-Process "${URL}" })

$tray.ShowBalloonTip(3000, "Open Neo UI", "Rodando em ${URL}", [System.Windows.Forms.ToolTipIcon]::Info)

[System.Windows.Forms.Application]::Run()
`

export function startTray(): void {
  if (process.platform !== "win32") return

  try {
    const tmpPath = join(process.env["TEMP"] ?? "C:\\Temp", "neo-tray.ps1")
    writeFileSync(tmpPath, PS_SCRIPT, "utf8")

    const child = spawn("powershell.exe", [
      "-WindowStyle", "Hidden",
      "-NonInteractive",
      "-ExecutionPolicy", "Bypass",
      "-File", tmpPath,
    ], {
      detached: true,
      stdio:    "ignore",
    })

    child.unref()
    console.log("[tray] System tray started")
  } catch (e) {
    console.warn("[tray] Could not start tray icon:", e)
  }
}
