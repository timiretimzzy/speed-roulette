$ErrorActionPreference = 'Continue'
$baseDir = "C:\Users\TIMIRE\Downloads\reaction-speed-roulette\data\primaed\raw"
if (-not (Test-Path $baseDir)) { New-Item -ItemType Directory -Path $baseDir | Out-Null }

$quizUrls = Get-Content "C:\Users\TIMIRE\Downloads\reaction-speed-roulette\data\primaed\all_quiz_urls.txt" | Where-Object { $_.Trim() -ne "" }
Write-Output "Total quizzes to process: $($quizUrls.Count)"

. (Join-Path $PSScriptRoot "primaed_session.ps1")
$session = Get-PrimaEdSession
Write-Output "Logged in."

$processed = 0
foreach ($url in $quizUrls) {
    $processed++
    $quizName = ($url -split '/')[-2]
    $safeName = $quizName -replace '[^\w\-]', '_'
    $outFile = Join-Path $baseDir ($safeName + ".html")
    
    if (Test-Path $outFile) {
        Write-Output "[SKIP] $quizName (already fetched)"
        continue
    }
    
    try {
        $resp = Invoke-WebRequest -Uri $url -WebSession $session -UseBasicParsing -TimeoutSec 40
        $resp.Content | Out-File $outFile -Encoding UTF8
        Write-Output "[$processed/$($quizUrls.Count)] SAVED $quizName ($($resp.Content.Length) bytes)"
    } catch {
        Write-Output "[$processed/$($quizUrls.Count)] ERROR $quizName : $_"
    }
}

Write-Output "`n=== ALL API DONE ==="