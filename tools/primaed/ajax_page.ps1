param(
    [Parameter(Mandatory=$true)][string]$Action,
    [Parameter(Mandatory=$true)][string]$OutFile,
    [string]$Data = ""
)
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot "primaed_session.ps1")
$session = Get-PrimaEdSession

# 3. POST to admin-ajax.php
$ajaxUrl = "https://primaed.com/wp-admin/admin-ajax.php"
if ($Data -eq "") {
    $null = Invoke-WebRequest -Uri $ajaxUrl -Method POST -Body "action=$Action" -ContentType "application/x-www-form-urlencoded" -WebSession $session -UseBasicParsing -TimeoutSec 45
} else {
    $null = Invoke-WebRequest -Uri $ajaxUrl -Method POST -Body "action=$Action&$Data" -ContentType "application/x-www-form-urlencoded" -WebSession $session -UseBasicParsing -TimeoutSec 45
}

# Re-fetch with GET to capture the response body (some AJAX handlers output only)
# Simpler: capture response of the POST directly
$resp = Invoke-WebRequest -Uri $ajaxUrl -Method POST -Body "action=$Action" -ContentType "application/x-www-form-urlencoded" -WebSession $session -UseBasicParsing -TimeoutSec 45
$resp.Content | Out-File -FilePath $OutFile -Encoding UTF8
Write-Output "Saved -> $OutFile ($($resp.Content.Length) bytes)"