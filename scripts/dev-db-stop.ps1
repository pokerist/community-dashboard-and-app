$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$pgCtl = "C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe"
$dataDir = Join-Path $repoRoot ".local\pg17-dev\data"

if (-not (Test-Path $pgCtl)) {
  throw "PostgreSQL 17 pg_ctl.exe not found."
}

if (-not (Test-Path $dataDir)) {
  Write-Host "Local dev DB cluster not found at $dataDir"
  exit 0
}

& $pgCtl -D $dataDir stop -m fast | Out-Host
Write-Host "Local PostgreSQL dev server stopped." -ForegroundColor Yellow
