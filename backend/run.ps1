# Aurel Home — Start Backend Development Server with isolated virtual environment
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

$venvUvicorn = Join-Path $scriptDir ".venv\Scripts\uvicorn.exe"
if (Test-Path $venvUvicorn) {
    Write-Host "Starting Uvicorn using backend virtual environment (.venv)..." -ForegroundColor Cyan
    & $venvUvicorn app.main:app --reload --port 8000
} else {
    Write-Host "Warning: .venv not found. Falling back to system python -m uvicorn..." -ForegroundColor Yellow
    python -m uvicorn app.main:app --reload --port 8000
}
