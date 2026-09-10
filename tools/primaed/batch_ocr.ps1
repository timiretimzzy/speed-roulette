$ErrorActionPreference = 'Continue'
$src = "C:\Users\TIMIRE\Downloads\reaction-speed-roulette\data\primaed\images"
$results = New-Object System.Collections.Generic.List[string]

Get-ChildItem -LiteralPath $src -Filter *.jpg -File | ForEach-Object {
    $name = $_.Name
    if ($name -like "up_*" -or $name -like "*.up.png" -or $name -eq "test_text.png") { return }
    $upPath = Join-Path $src ("ocr_" + [System.IO.Path]::GetFileNameWithoutExtension($name) + ".up.png")
    try {
        & powershell -ExecutionPolicy Bypass -File "C:\Users\TIMIRE\Downloads\reaction-speed-roulette\tools\primaed\upscale_image.ps1" -ImagePath $_.FullName -Scale 5 | Out-Null
        $upActual = [System.IO.Path]::ChangeExtension($_.FullName, ".up.png")
        & powershell -ExecutionPolicy Bypass -File "C:\Users\TIMIRE\Downloads\reaction-speed-roulette\tools\primaed\ocr_image.ps1" -ImagePath $upActual | Out-Null
        $ocrLog = $upActual + ".ocr.txt"
        $lines = @(Get-Content -LiteralPath $ocrLog -ErrorAction SilentlyContinue)
        $words = $lines | Where-Object { $_ -match '^\S+\|\d+\|\d+\|\d+$' }
        if ($words.Count -gt 0) {
            foreach ($wd in $words) {
                $results.Add("$name`t$wd")
            }
        }
    } catch {
        $results.Add("$name`tERROR: $_")
    }
}

[System.IO.File]::WriteAllLines((Join-Path $src "ocr_all_results.txt"), $results, (New-Object System.Text.UTF8Encoding($false)))
$grouped = $results | ForEach-Object { ($_ -split "`t")[0] } | Group-Object
Write-Output "Images with OCR text: $($grouped.Count)"
[System.IO.File]::WriteAllLines((Join-Path $src "ocr_images_with_text.txt"), ($grouped | ForEach-Object { "$($_.Name)`t$($_.Count)" }), (New-Object System.Text.UTF8Encoding($false)))