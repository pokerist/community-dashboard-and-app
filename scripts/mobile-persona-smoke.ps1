param(
  [string]$BaseUrl = "http://127.0.0.1:3001"
)

$ErrorActionPreference = "Stop"

function Invoke-Login {
  param(
    [string]$Email,
    [string]$Password = "pass123"
  )
  $body = @{ email = $Email; password = $Password } | ConvertTo-Json
  return Invoke-RestMethod -Method POST -Uri "$BaseUrl/auth/login" -ContentType "application/json" -Body $body
}

function Invoke-JsonGet {
  param(
    [hashtable]$Headers,
    [string]$Path
  )
  return Invoke-RestMethod -Headers $Headers -Uri "$BaseUrl$Path"
}

$accounts = @(
  @{ Label = "Owner"; Email = "owner.demo@test.com" },
  @{ Label = "Tenant"; Email = "tenant.demo@test.com" },
  @{ Label = "PreOwner"; Email = "preowner.demo@test.com" },
  @{ Label = "Family Member"; Email = "family.demo@test.com" },
  @{ Label = "Authorized"; Email = "authorized.demo@test.com" },
  @{ Label = "Contractor"; Email = "contractor.demo@test.com" }
)

$results = @()

foreach ($acct in $accounts) {
  try {
    $login = Invoke-Login -Email $acct.Email
    $headers = @{ Authorization = "Bearer $($login.accessToken)" }

    $me = Invoke-JsonGet -Headers $headers -Path "/auth/me"
    $services = Invoke-WebRequest -UseBasicParsing -Headers $headers -Uri "$BaseUrl/services?status=active"
    $banners = Invoke-JsonGet -Headers $headers -Path "/banners/mobile-feed"
    $notifications = Invoke-WebRequest -UseBasicParsing -Headers $headers -Uri "$BaseUrl/notifications/me?page=1&limit=10"
    $units = @($me.units)
    $unitStatuses = ($units | ForEach-Object { $_.status }) -join ","
    $persona = $me.personaHints.resolvedPersona

    $results += [PSCustomObject]@{
      PersonaLabel = $acct.Label
      Email = $acct.Email
      ResolvedPersona = $persona
      Units = $units.Count
      UnitStatuses = $unitStatuses
      ServicesStatus = $services.StatusCode
      BannersCount = @($banners.data).Count
      NotificationsStatus = $notifications.StatusCode
      Result = "OK"
      Error = $null
    }
  }
  catch {
    $results += [PSCustomObject]@{
      PersonaLabel = $acct.Label
      Email = $acct.Email
      ResolvedPersona = $null
      Units = $null
      UnitStatuses = $null
      ServicesStatus = $null
      BannersCount = $null
      NotificationsStatus = $null
      Result = "FAIL"
      Error = $_.Exception.Message
    }
  }
}

$results | Format-Table -AutoSize

$failed = @($results | Where-Object { $_.Result -ne "OK" })
if ($failed.Count -gt 0) {
  Write-Host "`nSMOKE_RESULT=FAIL count=$($failed.Count)" -ForegroundColor Red
  exit 1
}

Write-Host "`nSMOKE_RESULT=OK count=$($results.Count)" -ForegroundColor Green
