param(
  [string]$Root = "apps/admin-web/src"
)

$ErrorActionPreference = "Stop"

function Run-Check {
  param(
    [string]$Name,
    [string]$Pattern,
    [string]$Path = $Root,
    [switch]$FailOnMatch
  )

  Write-Host "`n=== $Name ===" -ForegroundColor Cyan
  $results = rg -n --glob '*.ts' --glob '*.tsx' --glob '*.md' $Pattern $Path 2>$null
  if ($LASTEXITCODE -eq 0 -and $results) {
    $results | Write-Host
    if ($FailOnMatch) {
      $script:HasFailures = $true
    }
  } elseif ($LASTEXITCODE -eq 1) {
    Write-Host "No matches" -ForegroundColor Green
  } else {
    Write-Host "Check failed to run (pattern/path issue)." -ForegroundColor Yellow
    $script:HasFailures = $true
  }
}

$script:HasFailures = $false

Write-Host "Admin UI audit scan" -ForegroundColor Cyan
Write-Host "Root: $Root"

Run-Check -Name "mock-data imports" -Pattern 'mock-data' -FailOnMatch
Run-Check -Name "placeholder copy (Coming Soon / Not implemented)" -Pattern 'Coming Soon|coming soon|not implemented|Not implemented' -FailOnMatch
Run-Check -Name "setTimeout usage in pages" -Pattern 'setTimeout\(' -Path 'apps/admin-web/src/components/pages' -FailOnMatch
Run-Check -Name "informational toasts (manual review)" -Pattern 'toast\.(info|warning|message)\(' -Path 'apps/admin-web/src'
Run-Check -Name "href=# (manual review)" -Pattern 'href=\"#\"' -Path 'apps/admin-web/src'

Write-Host "`n=== Summary ===" -ForegroundColor Cyan
if ($script:HasFailures) {
  Write-Host "Audit FAILED: blocking matches found." -ForegroundColor Red
  exit 1
}

Write-Host "Audit PASSED: no blocking matches found." -ForegroundColor Green
exit 0

