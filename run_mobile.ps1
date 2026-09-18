$ErrorActionPreference = "Stop"
Set-Location "$PSScriptRoot\mobile"
Write-Host "Starting CINTRA Mobile with a clean Expo/Metro cache..." -ForegroundColor Cyan
npx expo start -c
