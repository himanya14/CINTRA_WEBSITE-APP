param(
    [string]$OriginalEnv = "C:\Users\himan\OneDrive\Desktop\SIH'26\backend\.env"
)

$ErrorActionPreference = "Stop"
$target = Join-Path $PSScriptRoot "backend\.env"

if (!(Test-Path $OriginalEnv)) {
    throw "Original website .env not found: $OriginalEnv"
}

$lines = Get-Content $OriginalEnv
$db = $lines | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
$secret = $lines | Where-Object { $_ -match '^SECRET_KEY=' } | Select-Object -First 1

if (!$db) { throw "DATABASE_URL was not found in the original website .env" }
if (!$secret) { throw "SECRET_KEY was not found in the original website .env" }

$cintraSecret = $secret -replace '^SECRET_KEY=', 'CINTRA_SECRET_KEY='

# Preserve an already-configured AES evidence key so previously encrypted
# evidence never becomes unreadable when this helper is run again.
$existingEvidenceKey = $null
if (Test-Path $target) {
    $existingEvidenceKey = Get-Content $target |
        Where-Object { $_ -match '^CINTRA_EVIDENCE_ENCRYPTION_KEY=.+' } |
        Select-Object -First 1
}

$output = @(
    $db
    $cintraSecret
    'CINTRA_ACCESS_TOKEN_MINUTES=240'
)
if ($existingEvidenceKey) {
    $output += $existingEvidenceKey
}
$output += @(
    ''
    '# Optional real Hyperledger Fabric Gateway. Leave false until the gateway/network is running.'
    'FABRIC_ENABLED=false'
    'FABRIC_GATEWAY_URL=http://127.0.0.1:4100'
    'FABRIC_GATEWAY_TIMEOUT_SECONDS=8'
)
$output | Set-Content $target

Write-Host "backend\.env now uses the SAME website PostgreSQL DB and signing secret." -ForegroundColor Green
Write-Host "No password or MFA secret was printed." -ForegroundColor DarkGray
