$ErrorActionPreference = 'Stop'
$baseDir = "C:\Users\TIMIRE\Downloads\reaction-speed-roulette\data\primaed"
$uq = Get-Content -LiteralPath (Join-Path $baseDir "unique_questions.json") -Raw | ConvertFrom-Json

# Load question_details img info
$detailImg = @{}
foreach ($f in (Get-ChildItem -LiteralPath (Join-Path $baseDir "question_details") -Filter *.json)) {
    try {
        $d = Get-Content -LiteralPath $f.FullName -Raw | ConvertFrom-Json
        $m = [regex]::Match($d.content.rendered, '<img[^>]*src="([^"]+)"')
        if ($m.Success) { $detailImg[[string]$d.id] = $m.Groups[1].Value.Split('/')[-1] }
    } catch {}
}
Write-Output "detail-images: $($detailImg.Count)"

# Cache raw HTML
$htmlCache = @{}
foreach ($f in (Get-ChildItem -LiteralPath (Join-Path $baseDir "raw") -Filter *.html)) {
    $htmlCache[$f.BaseName] = Get-Content -LiteralPath $f.FullName -Raw
}
Write-Output "raw html cached: $($htmlCache.Count)"

$imgByQid = @{}
$problem = New-Object System.Collections.Generic.List[string]
foreach ($q in $uq) {
    $qid = [string]$q.qid
    $found = ""
    if ($detailImg.ContainsKey($qid)) {
        $found = $detailImg[$qid]
    } else {
        foreach ($qz in $q.quizzes) {
            if (-not $htmlCache.ContainsKey($qz)) { continue }
            $html = $htmlCache[$qz]
            $idx = $html.IndexOf($q.text, [System.StringComparison]::OrdinalIgnoreCase)
            if ($idx -ge 0) {
                $start = [Math]::Max(0, $idx - 300)
                $len = [Math]::Min(600, $html.Length - $start)
                $chunk = $html.Substring($start, $len)
                $m = [regex]::Matches($chunk, '<img[^>]*src="([^"]+)"', 'IgnoreCase')
                foreach ($im in $m) {
                    $name = $im.Groups[1].Value.Split('/')[-1]
                    if ($name -match '(?i)\.(jpg|jpeg|webp|png)$') { $found = $name; break }
                }
                if ($found) { break }
            }
        }
    }
    $imgByQid[$qid] = $found
}

$withImg = 0; $noImg = 0
$sw = New-Object System.Collections.Generic.List[string]
$sn = New-Object System.Collections.Generic.List[string]
foreach ($q in $uq) {
    $qid = [string]$q.qid
    if ($imgByQid[$qid]) { $withImg++; $sw.Add("$qid`t$($q.text)`t$($imgByQid[$qid])") }
    else { $noImg++; $sn.Add("$qid`t$($q.text)") }
}
[System.IO.File]::WriteAllLines((Join-Path $baseDir "answerkey\questions_with_images.txt"), $sw, (New-Object System.Text.UTF8Encoding($false)))
[System.IO.File]::WriteAllLines((Join-Path $baseDir "answerkey\questions_text_only.txt"), $sn, (New-Object System.Text.UTF8Encoding($false)))
Write-Output "With image (skip for user): $withImg"
Write-Output "Text-only (answerable): $noImg"