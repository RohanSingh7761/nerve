Write-Host "=== Setting up Nerve (Windows PowerShell) ===" -ForegroundColor Cyan

if (-not (Test-Path .env)) {
    Write-Host "Creating .env from .env.example..."
    Copy-Item .env.example .env
}

Write-Host "Setting up Python virtual environment..."
Set-Location backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e .

Write-Host "Setting up Frontend..."
Set-Location ..\nerve_client
npm install

Set-Location ..
Write-Host "=== Setup complete! Run .\scripts\dev.ps1 to start Nerve ===" -ForegroundColor Green
