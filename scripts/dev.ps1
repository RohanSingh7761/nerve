$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")

Write-Host "Starting Nerve Backend & Frontend from $ProjectRoot..." -ForegroundColor Cyan

# Start backend in a new process with explicit working directory
$BackendDir = Join-Path $ProjectRoot "backend"
Start-Process powershell -WorkingDirectory $BackendDir -ArgumentList "-NoExit", "-Command", ".\.venv\Scripts\uvicorn.exe app.main:app --port 8000 --reload"

# Start frontend in current process
$FrontendDir = Join-Path $ProjectRoot "nerve_client"
Set-Location $FrontendDir
npm run dev
