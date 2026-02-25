param(
  [int]$Port = 55432
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$pgBin = "C:\Program Files\PostgreSQL\17\bin"
$pgCtl = Join-Path $pgBin "pg_ctl.exe"
$initdb = Join-Path $pgBin "initdb.exe"
$createdb = Join-Path $pgBin "createdb.exe"
$psql = Join-Path $pgBin "psql.exe"

if (-not (Test-Path $pgCtl)) {
  throw "PostgreSQL 17 binaries not found at '$pgBin'. Install PostgreSQL 17 or update scripts/dev-db-start.ps1."
}

$clusterRoot = Join-Path $repoRoot ".local\pg17-dev"
$dataDir = Join-Path $clusterRoot "data"
$logFile = Join-Path $clusterRoot "server.log"

New-Item -ItemType Directory -Force -Path $clusterRoot | Out-Null

if (-not (Test-Path $dataDir)) {
  Write-Host "Initializing local PostgreSQL dev cluster..."
  & $initdb -D $dataDir -U postgres -A trust -E UTF8 | Out-Host
}

$isListening = $false
try {
  $isListening = Test-NetConnection -ComputerName 127.0.0.1 -Port $Port -InformationLevel Quiet
} catch {
  $isListening = $false
}

if (-not $isListening) {
  Write-Host "Starting local PostgreSQL dev server on port $Port..."
  & $pgCtl -D $dataDir -l $logFile -o " -p $Port -c listen_addresses=127.0.0.1 " start -w | Out-Host
} else {
  Write-Host "PostgreSQL dev server already listening on port $Port"
}

# Create application database if missing
$dbExists = (& $psql -h 127.0.0.1 -p $Port -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = 'community_dashboard';" 2>$null)
if (($dbExists | Out-String).Trim() -ne "1") {
  & $createdb -h 127.0.0.1 -p $Port -U postgres community_dashboard | Out-Host
}

Write-Host ""
Write-Host "Local DB is ready:" -ForegroundColor Green
Write-Host "  Host: 127.0.0.1"
Write-Host "  Port: $Port"
Write-Host "  DB  : community_dashboard"
Write-Host "  User: postgres (trust auth / no password)"
Write-Host ""
Write-Host "Quick check:"
& $psql -h 127.0.0.1 -p $Port -U postgres -d postgres -c "SELECT current_database(), current_user;" | Out-Host
