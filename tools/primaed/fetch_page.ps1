param(
    [Parameter(Mandatory=$true)][string]$Url,
    [Parameter(Mandatory=$true)][string]$OutFile
)
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot "primaed_session.ps1")
$session = Get-PrimaEdSession

# 3. Fetch target URL
$resp = Invoke-WebRequest -Uri $Url -WebSession $session -UseBasicParsing -TimeoutSec 45
$resp.Content | Out-File -FilePath $OutFile -Encoding UTF8
Write-Output "Saved $($resp.StatusCode) -> $OutFile ($($resp.Content.Length) bytes)"