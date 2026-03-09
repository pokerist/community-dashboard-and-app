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

Stop-PortProcesses -Ports @($BackendPort, $AdminPort, 5173)
Write-Host "Stopped processes on ports: $BackendPort, $AdminPort, 5173"
