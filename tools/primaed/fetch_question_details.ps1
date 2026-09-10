$ErrorActionPreference = 'Continue'
$outDir = "C:\Users\TIMIRE\Downloads\reaction-speed-roulette\data\primaed\question_details"
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

. (Join-Path $PSScriptRoot "primaed_session.ps1")

function Login-PrimaEd {
    try {
        $script:session = Get-PrimaEdSession
        return $true
    } catch {
        Write-Output "  Login retry failed: $_"
        return $false
    }
}

$session = Login-PrimaEd
if (-not $session) { Write-Output "FATAL: cannot login"; exit 1 }
Write-Output "Logged in."

$ids = Get-Content "C:\Users\TIMIRE\Downloads\reaction-speed-roulette\data\primaed\unique_question_ids.txt" | Where-Object { $_.Trim() -ne "" }
Write-Output "Total unique questions: $($ids.Count)"

$done = 0
$skip = 0
$fail = 0

for ($i = 0; $i -lt $ids.Count; $i++) {
    $id = $ids[$i].Trim()
    $outFile = Join-Path $outDir "q_$id.json"
    if (Test-Path $outFile) { $skip++; continue }

    $fetchOk = $false
    for ($attempt = 1; $attempt -le 4; $attempt++) {
        try {
            $r = Invoke-WebRequest -Uri "https://primaed.com/wp-json/ldlms/v2/sfwd-question/$id" -WebSession $session -UseBasicParsing -TimeoutSec 40
            if ($r.StatusCode -eq 200) {
                [System.IO.File]::WriteAllText($outFile, $r.Content, [System.Text.Encoding]::UTF8)
                $done++
                $fetchOk = $true
                break
            }
        } catch {
            # Session may have expired; re-login
            if ($attempt -eq 2) { $null = Login-PrimaEd }
        }
        Start-Sleep -Seconds $attempt
    }
    if (-not $fetchOk) {
        $fail++
        Write-Output "  FAIL $id"
    }

    if ($done % 20 -eq 0 -and ($done + $fail) % 20 -eq 0) {
        Write-Output "  Progress: processed=$($skip+$done+$fail) done=$done skip=$skip fail=$fail (remaining=$($ids.Count - $skip - $done - $fail))"
    }
}

Write-Output "`n=== QUESTION DETAILS DONE ==="
Write-Output "Downloaded: $done"
Write-Output "Already existed: $skip"
Write-Output "Failed: $fail"