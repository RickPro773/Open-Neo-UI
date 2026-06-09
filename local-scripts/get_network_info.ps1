# get_network_info.ps1
# Exibe informacoes de rede para configurar o Neo UI em outros PCs
# Execute: powershell -ExecutionPolicy Bypass -File get_network_info.ps1

$banner = @"
╔══════════════════════════════════════════════════════╗
║       Neotek AI — Informacoes de Rede               ║
╚══════════════════════════════════════════════════════╝
"@
Write-Host $banner -ForegroundColor Cyan

# IP local
$ips = Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -match "^(192\.168\.|10\.|172\.1[6-9]\.|172\.2[0-9]\.|172\.3[0-1]\.)" } |
    Select-Object -ExpandProperty IPAddress

if ($ips.Count -eq 0) {
    Write-Host "[AVISO] Nenhum IP de rede local encontrado." -ForegroundColor Yellow
    $ips = @("localhost")
}

$primaryIP = $ips[0]

Write-Host ""
Write-Host "IP deste PC na rede local: " -NoNewline
Write-Host $primaryIP -ForegroundColor Green
Write-Host ""

# Status dos servicos
Write-Host "── Status dos servicos ──────────────────────────────" -ForegroundColor Gray

$services = @(
    @{ Name = "Open WebUI";   Port = 3000; Path = "" },
    @{ Name = "Ollama";       Port = 11434; Path = "" },
    @{ Name = "Gateway Rust"; Port = 8080;  Path = "/health" },
    @{ Name = "Go MCP";       Port = 9090;  Path = "/health" },
    @{ Name = "Python MCP";   Port = 8000;  Path = "/health" }
)

foreach ($svc in $services) {
    $url = "http://localhost:$($svc.Port)$($svc.Path)"
    try {
        $resp = Invoke-WebRequest -Uri $url -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
        Write-Host "  [OK]     $($svc.Name.PadRight(15)) http://${primaryIP}:$($svc.Port)" -ForegroundColor Green
    } catch {
        Write-Host "  [OFFLINE] $($svc.Name.PadRight(15)) porta $($svc.Port)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "── Configuracao do Neo UI (outro PC) ────────────────" -ForegroundColor Gray
Write-Host ""
Write-Host "  No Neo UI de outro PC, configure o servidor como:" -ForegroundColor White
Write-Host "    URL do servidor: http://$primaryIP" -ForegroundColor Yellow
Write-Host "    Porta WebUI:     3000" -ForegroundColor Yellow
Write-Host "    Porta Ollama:    11434" -ForegroundColor Yellow
Write-Host ""

# Modelos Ollama instalados
Write-Host "── Modelos Ollama instalados ────────────────────────" -ForegroundColor Gray
try {
    $models = ollama list 2>$null
    if ($models) {
        Write-Host $models -ForegroundColor Cyan
    } else {
        Write-Host "  (nenhum modelo instalado ainda)" -ForegroundColor DarkGray
    }
} catch {
    Write-Host "  (Ollama nao encontrado ou nao rodando)" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "Pressione Enter para sair..."
Read-Host
