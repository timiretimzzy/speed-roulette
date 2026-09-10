param()
$ErrorActionPreference = "Continue"
$baseDir = "C:\Users\TIMIRE\Downloads\reaction-speed-roulette\data\primaed"
. (Join-Path $PSScriptRoot "primaed_session.ps1")
$enc = New-Object System.Text.UTF8Encoding($false)

function Normalize($s) {
    $s = [System.Net.WebUtility]::HtmlDecode([string]$s)
    $s = $s -replace '\s+', ' '
    return $s.Trim()
}

# Load the previously parsed bank for comparison
$parsed = Get-Content -Raw -LiteralPath (Join-Path $baseDir "parsed_quizzes.json") | ConvertFrom-Json
$prevQuizQids = @{}
foreach ($quiz in $parsed) {
    $prevQuizQids[[string]$quiz.name] = @($quiz.questions | ForEach-Object { [string]$_.question_post_id })
}
$prevText = @{}
foreach ($quiz in $parsed) {
    foreach ($q in $quiz.questions) { $prevText[[string]$q.question_post_id] = Normalize ([string]$q.text) }
}

$session = Get-PrimaEdSession
$date = Get-Date -Format "yyyy-MM-dd"
$recheckDir = Join-Path $baseDir "recheck"
$runDir = Join-Path $recheckDir $date
New-Item -ItemType Directory -Force -Path $runDir | Out-Null

$quizUrls = Get-Content -LiteralPath (Join-Path $baseDir "all_quiz_urls.txt") | Where-Object { $_.Trim() -ne "" }
$report = [System.Collections.Generic.List[object]]::new()
$totalNew = 0
$totalChanged = 0
$totalMissing = 0

foreach ($url in $quizUrls) {
    $quizName = ($url -split '/')[-2]
    try {
        $resp = Invoke-WebRequest -Uri $url -WebSession $session -UseBasicParsing -TimeoutSec 45
        $html = $resp.Content
        $qids = @()
        $qText = @{}
        $qOpts = @{}
        $qList = [regex]::Matches($html, '<li class="wpProQuiz_listItem"[^>]*data-question-meta="([^"]*)"[\s\S]*?</li>')
        foreach ($q in $qList) {
            $qhtml = $q.Value
            $qid = ""
            if ($qhtml -match 'question_post_id&quot;:(\d+)') { $qid = $Matches[1] }
            if (-not $qid) { continue }
            $text = ""
            if ($qhtml -match '<div class="wpProQuiz_question_text">([\s\S]*?)</div>') {
                $text = Normalize ([regex]::Replace($Matches[1], '<[^>]+>', ' '))
            }
            $opts = @()
            foreach ($o in [regex]::Matches($qhtml, 'value="(\d+)"[^>]*>([\s\S]*?)</label>')) {
                $opts += Normalize ([regex]::Replace($o.Groups[2].Value, '<[^>]+>', ' '))
            }
            $qids += $qid
            $qText[$qid] = $text
            $qOpts[$qid] = @($opts -join '|')
        }
        [System.IO.File]::WriteAllText((Join-Path $runDir "$quizName.html"), $html, $enc)

        $prev = $prevQuizQids[$quizName]
        $newIds = @($qids | Where-Object { $_ -notin $prev })
        $missingIds = @($prev | Where-Object { $_ -notin $qids })
        $changed = @()
        foreach ($id in $qids) {
            if ($prevText.ContainsKey($id) -and $prevText[$id] -ne $qText[$id]) { $changed += $id }
        }
        if ($newIds.Count -or $missingIds.Count -or $changed.Count) {
            $report.Add([PSCustomObject]@{
                quiz = $quizName
                url = $url
                found = $qids.Count
                previous = $prev.Count
                new = @($newIds -join ',')
                missing = @($missingIds -join ',')
                changed = @($changed -join ',')
            })
            $totalNew += $newIds.Count
            $totalMissing += $missingIds.Count
            $totalChanged += $changed.Count
            Write-Output "$quizName : new=$($newIds.Count) missing=$($missingIds.Count) changed=$($changed.Count)"
        } else {
            Write-Output "$quizName : unchanged ($($qids.Count))"
        }
    } catch {
        Write-Output "ERROR $quizName : $_"
    }
}

$summary = [PSCustomObject]@{
    date = $date
    quizzes_checked = $quizUrls.Count
    new_questions = $totalNew
    changed_questions = $totalChanged
    disappeared_questions = $totalMissing
    per_quiz = @($report)
    note = "Same quiz URLs as data/primaed/all_quiz_urls.txt; new quiz URLs would appear as new quizzes, not captured here."
}
$summary | ConvertTo-Json -Depth 6 | Out-File -FilePath (Join-Path $runDir "report.json") -Encoding utf8
Write-Output "`n====`nChecked $($quizUrls.Count) quizzes; new=$totalNew changed=$totalChanged missing=$totalMissing"
Write-Output "Report: recheck/$date/report.json"