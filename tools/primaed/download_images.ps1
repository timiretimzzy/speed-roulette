$ErrorActionPreference = 'Stop'
$imageDir = "C:\Users\TIMIRE\Downloads\reaction-speed-roulette\data\primaed\images"
if (-not (Test-Path $imageDir)) { New-Item -ItemType Directory -Path $imageDir | Out-Null }

. (Join-Path $PSScriptRoot "primaed_session.ps1")
$session = Get-PrimaEdSession
Write-Output "Logged in."

$imageUrls = Get-Content "C:\Users\TIMIRE\Downloads\reaction-speed-roulette\data\primaed\image_urls.txt" | Where-Object { $_.Trim() -ne "" }
Write-Output "Images to download: $($imageUrls.Count)"

$downloaded = 0
$failed = 0
$existing = 0

foreach ($url in $imageUrls) {
    $urlTrim = $url.Trim()
    $noQuery = $urlTrim.Split('?')[0]
    $filename = [System.IO.Path]::GetFileName($noQuery)
    if ($filename -eq "") { $filename = "img_$downloaded.jpg" }
    $filename = $filename -replace '[^\w\.\-]', '_'
    $outFile = Join-Path $imageDir $filename

    if (Test-Path $outFile) { $existing++; continue }

    try {
        $resp = Invoke-WebRequest -Uri $urlTrim -WebSession $session -UseBasicParsing -TimeoutSec 30
        [System.IO.File]::WriteAllBytes($outFile, [byte[]]$resp.Content)
        $downloaded++
    } catch {
        $failed++
        Write-Output "  FAILED $urlTrim : $_"
    }
}

Write-Output "`n=== IMAGE DOWNLOAD DONE ==="
Write-Output "Downloaded: $downloaded"
Write-Output "Already existed: $existing"
Write-Output "Failed: $failed"