param(
    [Parameter(Mandatory=$true)][string]$Action,
    [Parameter(Mandatory=$true)][string]$OutFile,
    [string]$PostBody = ""
)
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot "primaed_session.ps1")
$session = Get-PrimaEdSession

# 3. POST to admin-ajax.php
$ajaxUrl = "https://primaed.com/wp-admin/admin-ajax.php"
$resp = Invoke-WebRequest -Uri $ajaxUrl -Method POST -Body "action=$Action&$PostBody" -ContentType "application/x-www-form-urlencoded" -WebSession $session -UseBasicParsing -TimeoutSec 45
$resp.Content | Out-File -FilePath $OutFile -Encoding UTF8
Write-Output "Saved $($resp.StatusCode) -> $OutFile ($($resp.Content.Length) bytes)"