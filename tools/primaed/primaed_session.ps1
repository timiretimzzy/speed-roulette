# Shared authenticated session helper for the PrimaEd research scrapers.
# Credentials come from environment variables or from data/primaed/.creds.txt
# (LINE = "PRIMAED_USER=..."/"PRIMAED_PASS=..."). Never hardcode credentials
# in scripts -- .creds.txt is gitignored.

function Get-PrimaEdSession {
    $user = $env:PRIMAED_USER
    $pass = $env:PRIMAED_PASS
    if (-not $user -or -not $pass) {
        $credsFile = Join-Path $PSScriptRoot "..\..\data\primaed\.creds.txt"
        if (Test-Path -LiteralPath $credsFile) {
            foreach ($line in (Get-Content -LiteralPath $credsFile)) {
                if ($line -like "PRIMAED_USER=*") { $user = $line.Substring(12) }
                elseif ($line -like "PRIMAED_PASS=*") { $pass = $line.Substring(12) }
            }
        }
    }
    if (-not $user -or -not $pass) {
        throw "PrimaEd credentials not found. Set PRIMAED_USER/PRIMAED_PASS env vars or create data/primaed/.creds.txt"
    }

    $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
    $homeResp = Invoke-WebRequest -Uri "https://primaed.com/" -WebSession $session -UseBasicParsing -TimeoutSec 30
    $nonce = ""
    if ($homeResp.Content -match 'learndash-login-form.*?value="([^"]*)"') { $nonce = $matches[1] }
    $body = "log=$([uri]::EscapeDataString($user))&pwd=$([uri]::EscapeDataString($pass))&rememberme=forever&wp-submit=Log+In&redirect_to=%2F&learndash-login-form=$nonce"
    $null = Invoke-WebRequest -Uri "https://primaed.com/wp-login.php" -Method POST -Body $body -ContentType "application/x-www-form-urlencoded" -WebSession $session -UseBasicParsing -TimeoutSec 30
    return $session
}