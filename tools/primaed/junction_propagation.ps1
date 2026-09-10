$ErrorActionPreference = 'Stop'
$baseDir = "C:\Users\TIMIRE\Downloads\reaction-speed-roulette\data\primaed"
$uq = Get-Content -LiteralPath (Join-Path $baseDir "unique_questions.json") -Raw | ConvertFrom-Json
$ak = Get-Content -LiteralPath (Join-Path $baseDir "answerkey\junction_answers.json") -Raw | ConvertFrom-Json
$answered = @{}
foreach ($p in $ak.answers.PSObject.Properties) { $answered[$p.Name] = $p.Value }

function NormImg($n) {
    if (-not $n) { return "" }
    $n = $n -replace '-1-300x200', ''
    $n = $n -replace '-300x200', ''
    return $n.ToLowerInvariant()
}

# Cache raw HTML contents once
$htmlCache = @{}
foreach ($qz in (Get-ChildItem -LiteralPath (Join-Path $baseDir "raw") -Filter *.html | ForEach-Object { $_.BaseName })) {
    $htmlCache[$qz] = Get-Content -LiteralPath (Join-Path $baseDir "raw\$qz.html") -Raw
}

# Map: qid -> (quiz -> img basename) using cached html
$qidByText = @{}
foreach ($q in $uq) {
    $t = [string]$q.text
    if (-not $t) { continue }
    $normT = $t.Replace('&#8217;',"'").Replace('&#8220;','"').Replace('&#8221;','"').Replace('&#8211;','-').Replace('&#8221;','"')
    if (-not $qidByText.ContainsKey($normT)) { $qidByText[$normT] = New-Object System.Collections.Generic.List[string] }
    $qidByText[$normT].Add([string]$q.qid)
}

$imgByQid = @{}
foreach ($q in $uq) {
    $t = [string]$q.text
    if (-not ($t -match 'Which car|right of way' -and $t -match 'car')) { continue }
    $found = ""
    $normT = $t.Replace('&#8217;',"'").Replace('&#8220;','"').Replace('&#8221;','"')
    foreach ($qz in $q.quizzes) {
        if (-not $htmlCache.ContainsKey($qz)) { continue }
        $html = $htmlCache[$qz]
        $m = [regex]::Match($html, '.{0,150}' + [regex]::Escape($t) + '.{0,350}', 'Singleline')
        if ($m.Success) {
            $imgs = [regex]::Matches($m.Value, '<img[^>]*src="([^"]+)"', 'IgnoreCase')
            foreach ($im in $imgs) {
                $name = $im.Groups[1].Value.Split('/')[-1]
                if ($name -match '(?i)\.(jpg|jpeg|webp|png)$') { $found = $name; break }
            }
        }
        if ($found) { break }
    }
    $imgByQid[[string]$q.qid] = $found
}

# Build groups from explained questions first
$groups = @{}
foreach ($qid in $answered.Keys) {
    $q = $uq | Where-Object { $_.qid -eq $qid }
    $key = $q.text + "||" + ($q.options -join "§") + "||" + (NormImg $imgByQid[$qid])
    if (-not $groups.ContainsKey($key)) { $groups[$key] = New-Object System.Collections.Generic.List[string] }
    $groups[$key].Add($qid)
}

$unans = @("49937","49936","49562","49981","47061","49547","47060","50079","49437","49577","49924","49982","49546","47062","49456","49846","49689","47158","49593","49669","47296","49954","49592","47188","49719","47315","49532","47034","49564","49565","49329","49952","49955","49923","49591","49533","49563","49534","49953","50059","49827","49585")

$out = New-Object System.Collections.Generic.List[string]
foreach ($qid in $unans) {
    $q = $uq | Where-Object { $_.qid -eq $qid }
    $key = $q.text + "||" + ($q.options -join "§") + "||" + (NormImg $imgByQid[$qid])
    $sisters = @()
    if ($groups.ContainsKey($key)) { $sisters = $groups[$key] }
    $prop = @()
    foreach ($s in $sisters) { $prop += "$s=$($answered[$s])" }
    $out.Add("QID=$qid IMG=$($imgByQid[$qid])  question=$($q.text)")
    $out.Add("   opts: $($q.options -join ' | ')")
    $out.Add("   propagated-from: $($prop -join '; ')")
    $out.Add("")
}

[System.IO.File]::WriteAllLines((Join-Path $baseDir "answerkey\junction_propagation.txt"), $out, (New-Object System.Text.UTF8Encoding($false)))
Write-Output "done, $($out.Count) lines"