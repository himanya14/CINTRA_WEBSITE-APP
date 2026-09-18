$ErrorActionPreference = "Stop"
Set-Location "$PSScriptRoot\frontend"
npm run dev -- --host 0.0.0.0
