param(
  [int]$BackendPort = 3001,
  [int]$AdminPort = 4002
)

$ErrorActionPreference = "SilentlyContinue"

function Stop-PortProcesses {
  param([int[]]$Ports)
  foreach ($port in $Ports) {
    $lines = netstat -ano | Select-String ":$port\s"
    foreach ($line in $lines) {
      $parts = ($line.ToString() -replace '\s+', ' ').Trim().Split(' ')
      $procId = $parts[-1]
      if ($procId -match '^[0-9]+$') {
        try { Stop-Process -Id ([int]$procId) -Force } catch {}
      }
    }
  }
}

function Wait-BackendUrl {
  param(
    [int]$Port,
    [int]$TimeoutSeconds = 45
  )

  $candidates = @(
    "http://127.0.0.1:$Port/api",
    "http://localhost:$Port/api",
    "http://[::1]:$Port/api"
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    foreach ($url in $candidates) {
      try {
        $res = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3
        if ($res.StatusCode -ge 200 -and $res.StatusCode -lt 500) {
          return $url -replace '/api$', ''
        }
      } catch {}
    }
    Start-Sleep -Seconds 1
  }

  return $null
}

$root = (Get-Location).Path
$adminDir = Join-Path $root "apps\admin-web"

Stop-PortProcesses -Ports @($BackendPort, $AdminPort, 5173)

Start-Process -FilePath powershell -ArgumentList @(
  "-NoProfile",
  "-Command",
  "Set-Location '$root'; `$env:PORT='$BackendPort'; npm run start *>&1 | Tee-Object -FilePath backend-dev.log"
)

$backendBaseUrl = Wait-BackendUrl -Port $BackendPort
if (-not $backendBaseUrl) {
  $backendBaseUrl = "http://localhost:$BackendPort"
  Write-Warning "Backend health check did not respond in time. Falling back to $backendBaseUrl for admin API base."
}

Start-Process -FilePath powershell -ArgumentList @(
  "-NoProfile",
  "-Command",
  "Set-Location '$adminDir'; `$env:VITE_API_BASE_URL='$backendBaseUrl'; npx vite --host 127.0.0.1 --port $AdminPort *>&1 | Tee-Object -FilePath admin-dev.log"
)

Start-Sleep -Seconds 4

Write-Host "Backend: $backendBaseUrl/api"
Write-Host "Admin:   http://127.0.0.1:$AdminPort"
