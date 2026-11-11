@echo off
REM Aurel Home — Start Backend Development Server with isolated virtual environment
cd /d "%~dp0"

if exist ".venv\Scripts\uvicorn.exe" (
    echo Starting Uvicorn using backend virtual environment (.venv)...
    ".venv\Scripts\uvicorn.exe" app.main:app --reload --port 8000
) else (
    echo Warning: .venv not found. Falling back to system python -m uvicorn...
    python -m uvicorn app.main:app --reload --port 8000
)
