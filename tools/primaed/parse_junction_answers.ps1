$ErrorActionPreference = 'Stop'
$baseDir = "C:\Users\TIMIRE\Downloads\reaction-speed-roulette\data\primaed"
$uq = Get-Content -LiteralPath (Join-Path $baseDir "unique_questions.json") -Raw | ConvertFrom-Json

function Get-AnswerVerb([string]$text) {
    $t = $text.ToLowerInvariant()
    if ($t -match 'moves first|goes first|move first|first to') { return 'first' }
    if ($t -match 'goes last|move.*last|moves last|must go last|goes.*last|first,? second') { return 'last' }
    if ($t -match 'stops|must stop|should stop|stop ') { return 'stop' }
    if ($t -match 'right of way') { return 'row' }
    if ($t -match 'breaking the law|break(s|ing)? the law|law') { return 'law' }
    if ($t -match 'can move|may move|moves second|goes second|second') { return 'order' }
    if ($t -match 'gives right of way') { return 'gives' }
    if ($t -match 'not breaking') { return 'notlaw' }
    return 'other'
}

# Junction questions: extract car mentioned most prominently for the answer verb
$out = New-Object System.Collections.Generic.List[object]
foreach ($q in $uq) {
    $t = [string]$q.text
    $isJunction = ($t -match 'Which car|right of way' -and $t -match 'car')
    if (-not $isJunction) { continue }
    $exp = [string]$q.explanation
    $verb = Get-AnswerVerb $t
    $ans = ''
    $how = ''
    if ($exp) {
        $en = ($exp -replace '\s+', ' ').Trim()
        # Take last 1-2 sentences as the conclusion
        $sentences = [regex]::Split($en, '(?<=[.!?])\s+')
        $conclusion = $sentences[-1]
        if ($sentences.Count -gt 1) { $conclusion = $sentences[-2] + ' ' + $sentences[-1] }
        # Now find "Car X" (or "car X") pairings
        switch ($verb) {
            'first' {
                if ($conclusion -match '([Cc]ar\s+(?:A|B|C))\s+(?:and[^.]*?)?goes?\s+(?:first|firstly)' -or
                    $conclusion -match '([Cc]ar\s+(?:A|B|C))\s+(?:is|will)?\s*follows?') { $ans = $matches[1] }
                if ($conclusion -match 'goes first' -and $conclusion -match '([Cc]ar\s+(?:A|B|C))') { $ans = $matches[1]; $how='firstmention' }
            }
            'last' {
                if ($conclusion -match '([Cc]ar\s+(?:A|B|C)).{0,40}(?:last|lastly)') { $ans = $matches[1] }
                if (-not $ans -and $conclusion -match '(?:last|lastly).{0,30}([Cc]ar\s+(?:A|B|C))') { $ans = $matches[1]; $how='before' }
            }
            'stop' {
                if ($conclusion -match '([Cc]ar\s+(?:A|B|C)).{0,50}(?:stops?|must stop|waits|must wait|stop )') { $ans = $matches[1] }
                if (-not $ans -and $conclusion -match 'stop(s|ped)?\s*(?:is|and)?\s*([Cc]ar\s+(?:A|B|C))') { $ans = $matches[($matches.Count-1)]; $how='after' }
            }
            'row' {
                if ($conclusion -match '([Cc]ar\s+(?:A|B|C)).{0,50}right of way') { $ans = $matches[1] }
                if (-not $ans -and $conclusion -match 'right of way.{0,30}([Cc]ar\s+(?:A|B|C))') { $ans = $matches[1]; $how='before' }
            }
            'law' {
                if ($conclusion -match '([Cc]ar\s+(?:A|B|C)).{0,60}(?:law|breaking)') { $ans = $matches[1] }
            }
            'notlaw' {
                if ($conclusion -match '([Cc]ar\s+(?:A|B|C)).{0,60}(?:right of way|not.*law)') { $ans = $matches[1] }
            }
            'order' {
                if ($conclusion -match '([Cc]ar\s+(?:A|B|C)).{0,40}(?:second|first|last|moves)') { $ans = $matches[1] }
            }
            'gives' {
                if ($conclusion -match '([Cc]ar\s+(?:A|B|C)).{0,50}(?:gives|give)') { $ans = $matches[1] }
                if (-not $ans -and $exp -match '(?:Car|car)\s+(?:A|B|C)\s+(?:gives?|has to give)\s+(?:the\s+)?right of way') { $ans = $matches[0] }
            }
            default { }
        }
    }
    $out.Add(([PSCustomObject]@{ qid=$q.qid; verb=$verb; text=$t; exp=$exp; parsed_ans=$ans; how=$how }))
}

foreach ($o in $out) {
    Write-Output "QID=$($o.qid) VERB=$($o.verb) PARSED=$($o.parsed_ans)"
    Write-Output "  Q: $($o.text)"
    if ($o.exp) { Write-Output "  EXP: $($o.exp)" }
    Write-Output ""
}