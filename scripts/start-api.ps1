$ErrorActionPreference = "Stop"

$repo = Resolve-Path (Join-Path $PSScriptRoot "..")
$api = Join-Path $repo "services\api-python"
$venv = Join-Path $api ".venv"

if (-not (Test-Path $venv)) {
  python -m venv $venv
}

& (Join-Path $venv "Scripts\Activate.ps1")
pip install -r (Join-Path $api "requirements.txt")

$env:OPEN_NEO_WORKSPACE = $repo
uvicorn app.main:app --app-dir $api --reload --port 8000
