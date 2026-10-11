Write-Host "Starting Nerve Backend & Frontend..." -ForegroundColor Cyan

# Start backend in a new process
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; .\.venv\Scripts\activate; uvicorn app.main:app --port 8000"

# Start frontend in current process
Set-Location nerve_client
npm run dev
