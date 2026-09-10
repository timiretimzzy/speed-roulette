$ErrorActionPreference = 'Stop'
$baseDir = "C:\Users\TIMIRE\Downloads\reaction-speed-roulette\data\primaed"
$workDir = Join-Path $baseDir "answerkey"
if (-not (Test-Path -LiteralPath $workDir)) { New-Item -ItemType Directory -Path $workDir | Out-Null }

$uq = Get-Content -LiteralPath (Join-Path $baseDir "unique_questions.json") -Raw | ConvertFrom-Json

function AppendQ($sb, $q) {
    [void]$sb.AppendLine("QID=$($q.qid) TYPE=$($q.type)")
    [void]$sb.AppendLine("Q: $($q.text)")
    if ($q.image_files) { [void]$sb.AppendLine("IMG: $($q.image_files -join ', ')") }
    for ($i = 0; $i -lt $q.options.Count; $i++) {
        $marker = if ($i -eq $q.options.Count - 1) { '+' } else { ' ' }
        [void]$sb.AppendLine("  $($i+1). $($q.options[$i])")
    }
    if ($q.explanation) { [void]$sb.AppendLine("EXP: $($q.explanation)") }
    [void]$sb.AppendLine("")
}

function Categorize([string]$t) {
    $tL = $t.ToLowerInvariant()
    if ($t -match 'Which car|right of way.*car|car.*right of way') { return 'JUNCTION' }
    elseif ($t -match 'sign|signboard|road marking|roundabout|traffic island') { 
        # signs: check if it's about lines vs signs
        if ($tL -match 'line|kerb|continuous|broken|hatched|straddl') { return 'LINES' }
        return 'SIGNS'
    }
    elseif ($tL -match 'robot|traffic light') { return 'ROBOT' }
    elseif ($tL -match 'line|kerb|continuous|broken|hatched|straddl|zig|lane') { return 'LINES' }
    elseif ($tL -match 'cyclist|cycle|bike|bicycle|motorcycle|pedal') { return 'CYCLES' }
    elseif ($tL -match 'speed|limit|km/h|kmh|mph|kilometre') { return 'SPEED' }
    elseif ($tL -match 'park|parking') { return 'PARKING' }
    elseif ($tL -match 'age|aged|years old|must be.*years|of years') { return 'AGE' }
    elseif ($tL -match 'overtak') { return 'OVERTAKING' }
    elseif ($tL -match 'accident|report.*police|police.*report') { return 'ACCIDENT' }
    elseif ($tL -match 'headlamp|headlight|light(s)?|dip|beam|lamp') { return 'LIGHTS' }
    elseif ($tL -match 'horn|hooter|sound.*signal') { return 'HORN' }
    elseif ($tL -match 'trailer|tow|towing') { return 'TOWING' }
    elseif ($tL -match 'pedestrian|walking|footpath|zebra|pavement') { return 'PEDESTRIAN' }
    elseif ($tL -match 'l-plate|learner|licence|license|provisional|driving test') { return 'LPLATE' }
    elseif ($tL -match 'drink|alcohol|drug|intoxicat') { return 'ALCOHOL' }
    elseif ($tL -match 'insurance|third party|certificate') { return 'INSURANCE' }
    elseif ($tL -match 'laden|load|carry') { return 'LOAD' }
    elseif ($tL -match 'following dist|safe dist|distance') { return 'DISTANCE' }
    else { return 'OTHER' }
}

$buckets = @{}
foreach ($q in $uq) {
    $cat = Categorize $q.text
    if (-not $buckets.ContainsKey($cat)) { $buckets[$cat] = New-Object System.Collections.Generic.List[object] }
    $buckets[$cat].Add($q)
}

# Write one compact file per category; junction split into explained / not-explained
foreach ($k in $buckets.Keys) {
    $items = $buckets[$k]
    if ($k -eq 'JUNCTION') {
        $withExp = $items | Where-Object { $_.explanation }
        $noExp = $items | Where-Object { -not $_.explanation }
        $sb = New-Object System.Text.StringBuilder
        [void]$sb.AppendLine("=== JUNCTION WITH EXPLANATION ($($withExp.Count)) ===")
        foreach ($q in $withExp) { AppendQ $sb $q }
        [System.IO.File]::WriteAllText((Join-Path $workDir "junction_explained.txt"), $sb.ToString(), (New-Object System.Text.UTF8Encoding($false)))
        $sb2 = New-Object System.Text.StringBuilder
        [void]$sb2.AppendLine("=== JUNCTION NO EXPLANATION ($($noExp.Count)) ===")
        foreach ($q in $noExp) { AppendQ $sb2 $q }
        [System.IO.File]::WriteAllText((Join-Path $workDir "junction_noexp.txt"), $sb2.ToString(), (New-Object System.Text.UTF8Encoding($false)))
    } else {
        $sb = New-Object System.Text.StringBuilder
        foreach ($q in $items) { AppendQ $sb $q }
        [System.IO.File]::WriteAllText((Join-Path $workDir ("q_" + $k.ToLower() + ".txt")), $sb.ToString(), (New-Object System.Text.UTF8Encoding($false)))
    }
}

function AppendQ($sb, $q) {
    [void]$sb.AppendLine("QID=$($q.qid) TYPE=$($q.type)")
    [void]$sb.AppendLine("Q: $($q.text)")
    if ($q.image_files) { [void]$sb.AppendLine("IMG: $($q.image_files -join ', ')") }
    for ($i = 0; $i -lt $q.options.Count; $i++) {
        $marker = if ($i -eq $q.options.Count - 1) { '+' } else { ' ' }
        [void]$sb.AppendLine("  $($i+1). $($q.options[$i])")
    }
    if ($q.explanation) { [void]$sb.AppendLine("EXP: $($q.explanation)") }
    [void]$sb.AppendLine("")
}

# Summary
foreach ($k in ($buckets.Keys | Sort-Object)) {
    Write-Output ("{0,-12} {1}" -f $k, $buckets[$k].Count)
}
Write-Output ("Files in {0}:" -f $workDir)