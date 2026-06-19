$ErrorActionPreference = "Stop"

$repo = Resolve-Path (Join-Path $PSScriptRoot "..")
$native = Join-Path $repo "core\native"

cmake -S $native -B (Join-Path $native "build")
cmake --build (Join-Path $native "build") --config Release
