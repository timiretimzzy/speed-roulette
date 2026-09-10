param()
$ErrorActionPreference = "Stop"
$baseDir = "C:\Users\TIMIRE\Downloads\reaction-speed-roulette\data\primaed"
function ReadJson($path) {
  return [System.IO.File]::ReadAllText($path, (New-Object System.Text.UTF8Encoding($false)))
}
function Normalize($s) {
  if ($null -eq $s) { return "" }
  $s = [System.Net.WebUtility]::HtmlDecode([string]$s)
  $s = $s.Replace([char]0x2018, [char]39).Replace([char]0x2019, [char]39)
  $s = $s.Replace([char]0x201C, [char]34).Replace([char]0x201D, [char]34)
  $s = $s.Replace([char]0x2013, [char]45).Replace([char]0x2014, [char]45)
  $s = $s.Replace([char]0x00A0, [char]32)
  $s = $s.Replace("`r"," ").Replace("`n"," ").Replace("`t"," ")
  while ($s.Contains("  ")) { $s = $s.Replace("  "," ") }
  return $s.Trim()
}

$masterRaw = ReadJson (Join-Path $baseDir "answerkey\answers_master.json") | ConvertFrom-Json
$master = @{}
foreach ($p in $masterRaw.answers.PSObject.Properties) { $master[[string]$p.Name] = [string]$p.Value }

$uq = ReadJson (Join-Path $baseDir "unique_questions.json") | ConvertFrom-Json
$uqText = @{}
foreach ($q in $uq) { $uqText[[string]$q.qid] = [string]$q.text }

$img = @{}
foreach ($line in (Get-Content -LiteralPath (Join-Path $baseDir "answerkey\questions_with_images.txt"))) {
  if ($line -match '^(\d+)\t') { $img[$Matches[1]] = $true }
}

$skip = @{}
foreach ($q in $uq) {
  $qid = [string]$q.qid
  if ($master.ContainsKey($qid)) { continue }
  if ($q.type -eq "cloze_answer") { $skip[$qid] = "interactive (cloze access-code)" }
  elseif ($q.type -eq "matrix_sort_answer") { $skip[$qid] = "interactive (matrix sort)" }
  elseif ($img.ContainsKey($qid)) { $skip[$qid] = "image" }
  else { $skip[$qid] = "malformed (truncated options)" }
}

$skipFile = Join-Path $baseDir "answerkey\user_skip.txt"
$lines = @()
foreach ($qid in ($skip.Keys | Sort-Object {[int]$_})) {
  $lines += "$qid`t$($skip[$qid])`t$($uqText[$qid])"
}
[System.IO.File]::WriteAllLines($skipFile, $lines, (New-Object System.Text.UTF8Encoding($false)))
Write-Output "user_skip.txt written: $($lines.Count) qids"

$rows = Import-Csv -LiteralPath (Join-Path $baseDir "question_bank_full.csv")
$out = @()
$answered = 0; $skipped = 0; $noOptionMatch = @()
foreach ($r in $rows) {
  $qid = [string]$r.question_post_id
  $status = "skip"
  $ans = ""
  if ($master.ContainsKey($qid)) {
    $want = $master[$qid]
    $found = $null
    for ($i = 1; $i -le 5; $i++) {
      $opt = [string]$r.("option_$i")
      if ($opt -and (Normalize $opt) -eq (Normalize $want)) { $found = $opt; break }
    }
    if ($null -eq $found) {
      foreach ($col in @("option_1","option_2","option_3","option_4","option_5")) {
        $opt = [string]$r.$col
        if ($opt -and $opt -eq $want) { $found = $opt; break }
      }
    }
    if ($null -eq $found) {
      $noOptionMatch += $qid
      $ans = $want
    } else {
      $ans = $found
    }
    $status = "answered"
    $answered++
  } else {
    $skipped++
  }
  $obj = $r | Select-Object *
  $obj | Add-Member -NotePropertyName correct_answer -NotePropertyValue $ans
  $obj | Add-Member -NotePropertyName status -NotePropertyValue $status
  $out += $obj
}

$out | Export-Csv -LiteralPath (Join-Path $baseDir "question_bank_filled.csv") -NoTypeInformation -Encoding utf8
Write-Output "filled=$answered skip=$skipped rows=$($out.Count)"
Write-Output "no option match (fallback to master text): $($noOptionMatch.Count)"
if ($noOptionMatch.Count) { Write-Output "  $($noOptionMatch -join ', ')" }

$qa = $out | Group-Object question_post_id
$mixed = @($qa | Where-Object { ($_.Group | Select-Object -ExpandProperty status -Unique).Count -gt 1 })
Write-Output "distinct qids=$($qa.Count) with mixed status=$($mixed.Count)"
$perCat = $out | Group-Object status, category
foreach ($g in ($perCat | Sort-Object Name)) {
  Write-Output ("  {0,-12} {1}" -f $g.Name, $g.Count)
}