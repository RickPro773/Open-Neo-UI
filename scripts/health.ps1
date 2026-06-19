$ErrorActionPreference = "Stop"

Invoke-RestMethod http://localhost:8000/health
Invoke-RestMethod http://localhost:8000/tools
