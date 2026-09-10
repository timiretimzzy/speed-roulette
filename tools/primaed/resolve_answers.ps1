param()
$ErrorActionPreference = "Stop"
$baseDir = "C:\Users\TIMIRE\Downloads\reaction-speed-roulette\data\primaed"
function ReadJson($path) {
  return [System.IO.File]::ReadAllText($path, (New-Object System.Text.UTF8Encoding($false)))
}
$uq = ReadJson (Join-Path $baseDir "unique_questions.json") | ConvertFrom-Json
$masterPath = Join-Path $baseDir "answerkey\answers_master.json"
$master = @{}
if (Test-Path $masterPath) {
  $m = ReadJson $masterPath | ConvertFrom-Json
  foreach ($p in $m.answers.PSObject.Properties) { $master[$p.Name] = $p.Value }
}
$rules = $null
try {
  Add-Type -AssemblyName System.Web.Extensions -ErrorAction Stop
  $ser = New-Object System.Web.Script.Serialization.JavaScriptSerializer
  $rules = $ser.DeserializeObject((ReadJson (Join-Path $baseDir "answerkey\rules.json")))
} catch { throw "need System.Web.Extensions: $_" }

function Normalize($s) {
  $s = [System.Net.WebUtility]::HtmlDecode($s)
  $s = $s.Replace([char]0x2018, [char]39).Replace([char]0x2019, [char]39)
  $s = $s.Replace([char]0x201C, [char]34).Replace([char]0x201D, [char]34)
  $s = $s.Replace([char]0x2013, [char]45).Replace([char]0x2014, [char]45)
  $s = $s.Replace([char]0x00A0, [char]32)
  $s = $s.Replace("`r"," ").Replace("`n"," ").Replace("`t"," ")
  while ($s.Contains("  ")) { $s = $s.Replace("  "," ") }
  return $s.Trim()
}

$ruleMap = New-Object 'System.Collections.Generic.Dictionary[string,System.Object]' ([System.StringComparer]::Ordinal)
foreach ($cat in $rules.Keys) {
  $catDict = $rules[$cat]
  foreach ($r in $catDict.Keys) {
    $k = Normalize $r
    if ($ruleMap.ContainsKey($k)) { Write-Output "DUPLICATE RULE KEY: $r" }
    $ruleMap[$k] = $catDict[$r]
  }
}

$added = 0; $conflict = 0
foreach ($q in $uq) {
  $key = Normalize $q.text
  $qid = [string]$q.qid
  if (-not $ruleMap.ContainsKey($key)) { continue }
  $wanted = $ruleMap[$key]
  $cands = @()
  if ($wanted -is [System.Array]) { foreach ($c in $wanted) { $cands += [string]$c } }
  else { $cands += [string]$wanted }
  $val = $null
  foreach ($cand in $cands) {
    $idx = [Array]::IndexOf([string[]]$q.options, $cand)
    if ($idx -lt 0) {
      for ($i = 0; $i -lt $q.options.Count; $i++) {
        if ((Normalize $q.options[$i]) -eq (Normalize $cand)) { $idx = $i; break }
      }
    }
    if ($idx -ge 0) { $val = $q.options[$idx]; break }
  }
  if ($null -eq $val) { Write-Output "NO OPTION MATCH ${qid}: wanted='$($cands -join ' OR ')' opts='$($q.options -join '|')'"; continue }
  if ($master.ContainsKey($qid) -and $master[$qid] -cne $val) {
    Write-Output "CONFLICT ${qid}: master='$($master[$qid])' rule='$val'"
    $conflict++
  }
  $master[$qid] = $val
  $added++
}
foreach ($cat in $rules.Keys) {
  $n = 0
  foreach ($rr in $rules[$cat].Keys) {
    $k = Normalize $rr
    foreach ($q in $uq) { if ((Normalize $q.text) -eq $k) { $n++ } }
  }
  Write-Output "$cat : $n rules matched in bank"
}

$ordered = [ordered]@{}
foreach ($k in ($master.Keys | Sort-Object {[int]$_})) { $ordered[$k] = $master[$k] }
$out = [ordered]@{
  "src" = "course explanations + research rules (merged); option text"
  "count" = $ordered.Count
  "answers" = $ordered
}
[System.IO.File]::WriteAllText($masterPath, ($out | ConvertTo-Json), (New-Object System.Text.UTF8Encoding($false)))
Write-Output "added=$added conflicts=$conflict total_master=$($ordered.Count)"