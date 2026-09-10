$ErrorActionPreference = 'Stop'
$baseDir = "C:\Users\TIMIRE\Downloads\reaction-speed-roulette\data\primaed"

$uq = Get-Content -LiteralPath (Join-Path $baseDir "unique_questions.json") -Raw | ConvertFrom-Json

function Norm([string]$s) {
    if (-not $s) { return "" }
    $s = $s.ToLowerInvariant()
    $s = $s -replace '[^a-z0-9 ]', ' '
    $s = $s -replace '\s+', ' '
    return $s.Trim()
}

function NormOpt([string]$s) {
    if (-not $s) { return "" }
    $s = $s.ToLowerInvariant()
    # strip leading letters like "a)", "b)" or option markers
    $s = $s -replace '^\s*[a-g]\)\s*', ''
    $s = $s -replace '[^a-z0-9 ]', ' '
    $s = $s -replace '\s+', ' '
    return $s.Trim()
}

$out = New-Object System.Collections.Generic.List[object]
$matched = 0
$noexp = 0
$multi = 0
$single = 0
$none = 0

foreach ($q in $uq) {
    $exp = [string]$q.explanation
    if (-not $exp) { $noexp++; continue }
    $expNorm = Norm $exp
    $options = @($q.options)
    # track which options matched and their normalized form
    $matches = @()
    for ($i = 0; $i -lt $options.Count; $i++) {
        $oNorm = NormOpt $options[$i]
        if ($oNorm.Length -lt 3) { continue }
        if ($expNorm.Contains($oNorm)) {
            $matches += [PSCustomObject]@{ idx = $i + 1; norm = $oNorm; len = $oNorm.Length }
        }
    }
    $ansIdx = 0
    $status = "none"
    if ($matches.Count -eq 1) {
        $ansIdx = $matches[0].idx
        $status = "single"
        $single++
    } elseif ($matches.Count -gt 1) {
        # prefer the match furthest into the explanation (usually answer at end)
        $last = $matches | Sort-Object { $expNorm.LastIndexOf($_.norm) } -Descending -ErrorAction SilentlyContinue | Select-Object -First 1
        $ansIdx = $last.idx
        $status = "multi"
        $multi++
    }
    if ($ansIdx -gt 0) {
        $matched++
    } else {
        $none++
    }
    $out.Add([PSCustomObject]@{
        qid = $q.qid
        text = $q.text
        options = ($options -join ' | ')
        explanation = $exp
        answer_index = $ansIdx
        match_status = $status
    })
}

[System.IO.File]::WriteAllLines((Join-Path $baseDir "auto_answers.txt"), ($out | ForEach-Object {
    "QID=$($_.qid) ANS=$($_.answer_index) ($($_.match_status))"
    "Q: $($_.text)"
    "OPTIONS: $($_.options)"
    "EXPLANATION: $($_.explanation)"
    "ANSWER_OPTION: $(if ($_.answer_index -gt 0) { ($_.options -split ' \| ')[$_.answer_index-1] } else { '' })"
    ""
}), (New-Object System.Text.UTF8Encoding($false)))

Write-Output "Questions with explanation: $($uq.Count - $noexp)"
Write-Output "Auto-matched: $matched (single=$single multi=$multi)"
Write-Output "No match from explanation: $none"
Write-Output "No explanation at all: $noexp"