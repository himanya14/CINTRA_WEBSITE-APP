$ErrorActionPreference = "Stop"
Set-Location "$PSScriptRoot\backend"

if (!(Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    throw "backend\.env was created. Edit DATABASE_URL to the SAME PostgreSQL database used by the website, then run this script again."
}

$envText = Get-Content ".env" -Raw
if ($envText -match "YOUR_PASSWORD|YOUR_CINTRA_DATABASE") {
    throw "Edit backend\.env first. DATABASE_URL still contains placeholder values."
}

& ".\venv\Scripts\python.exe" -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
