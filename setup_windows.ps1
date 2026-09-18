$ErrorActionPreference = "Stop"
Write-Host "=== CINTRA Unified Setup ===" -ForegroundColor Cyan

function Resolve-PythonExe {
    $pythonCmd = Get-Command python -ErrorAction SilentlyContinue
    if ($pythonCmd) { return $pythonCmd.Source }

    $root = "$env:LOCALAPPDATA\Programs\Python"
    if (Test-Path $root) {
        $candidate = Get-ChildItem $root -Filter python.exe -Recurse -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -notmatch '\\Scripts\\' } |
            Sort-Object FullName -Descending |
            Select-Object -First 1
        if ($candidate) { return $candidate.FullName }
    }

    throw "Python executable not found. Install Python 3.12 or provide it on PATH."
}

Write-Host "[1/3] Backend" -ForegroundColor Yellow
Set-Location "$PSScriptRoot\backend"
$pythonExe = Resolve-PythonExe
Write-Host "Using Python: $pythonExe" -ForegroundColor DarkGray

if (!(Test-Path "venv")) {
    & $pythonExe -m venv venv
}

& ".\venv\Scripts\python.exe" -m pip install --upgrade pip
& ".\venv\Scripts\python.exe" -m pip install -r requirements.txt

if (!(Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "IMPORTANT: edit backend\.env and paste the SAME PostgreSQL DATABASE_URL used by the website." -ForegroundColor Magenta
}

Write-Host "[2/3] Website" -ForegroundColor Yellow
Set-Location "$PSScriptRoot\frontend"
npm install
if (!(Test-Path ".env")) { Copy-Item ".env.example" ".env" }

Write-Host "[3/3] Mobile" -ForegroundColor Yellow
Set-Location "$PSScriptRoot\mobile"
npm install
if (!(Test-Path ".env")) { Copy-Item ".env.example" ".env" }

Set-Location $PSScriptRoot
Write-Host "Setup complete." -ForegroundColor Green
Write-Host "1) Put the website PostgreSQL DATABASE_URL in backend\.env" -ForegroundColor Yellow
Write-Host "2) Put your PC IPv4 in mobile\.env" -ForegroundColor Yellow
Write-Host "3) Run backend, frontend and mobile in separate terminals" -ForegroundColor Yellow
