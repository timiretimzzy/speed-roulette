$ErrorActionPreference = 'Continue'
$quizUrls = Get-Content "C:\Users\TIMIRE\Downloads\reaction-speed-roulette\data\primaed\all_quiz_urls.txt" | Where-Object { $_.Trim() -ne "" }
Write-Output "Total quizzes to process: $($quizUrls.Count)"

. (Join-Path $PSScriptRoot "primaed_session.ps1")
$session = Get-PrimaEdSession
Write-Output "Logged in. Nonce: $nonce"

$allQuizzes = @()
$processed = 0

foreach ($url in $quizUrls) {
    $processed++
    try {
        $resp = Invoke-WebRequest -Uri $url -WebSession $session -UseBasicParsing -TimeoutSec 40
        $content = $resp.Content
        
        # Extract quiz name from URL
        $quizName = ($url -split '/')[-2]
        Write-Output "[$processed/$($quizUrls.Count)] $quizName (size $($content.Length))"
        
        # Extract quiz config metadata
        $quizMeta = @{
            url = $url
            name = $quizName
            quizPostId = ""
            passingPercentage = ""
            mode = ""
            timelimit = ""
            globalPoints = ""
            questions = @()
        }
        
        if ($content -match 'quiz: (\d+),') { $quizMeta.quizPostId = $matches[1] }
        if ($content -match 'passingpercentage: (\d+)') { $quizMeta.passingPercentage = $matches[1] }
        if ($content -match 'mode: (\d+)') { $quizMeta.mode = $matches[1] }
        if ($content -match 'timelimit: (\d+)') { $quizMeta.timelimit = $matches[1] }
        if ($content -match 'globalPoints: (\d+)') { $quizMeta.globalPoints = $matches[1] }
        
        # Extract all question blocks (wpProQuiz_listItem or wpProQuiz_question)
        $questionList = [regex]::Matches($content, '<li class="wpProQuiz_listItem"[^>]*data-question-meta="([^"]*)"[\s\S]*?</li>')
        
        if ($questionList.Count -eq 0) {
            # Fallback: try extracting question content differently
            Write-Output "  No question blocks found"
        } else {
            foreach ($q in $questionList) {
                $qhtml = $q.Value
                $qObj = @{
                    question_pro_id = ""
                    question_post_id = ""
                    type = "single"
                    text = ""
                    options = @()
                    correct_message = ""
                    incorrect_message = ""
                }
                
                # Extract question meta
                if ($qhtml -match 'question_pro_id&quot;:(\d+)') { $qObj.question_pro_id = $matches[1] }
                if ($qhtml -match 'question_post_id&quot;:(\d+)') { $qObj.question_post_id = $matches[1] }
                
                # Extract question text
                if ($qhtml -match '<div class="wpProQuiz_question_text">([\s\S]*?)</div>') {
                    $qTextHtml = $matches[1]
                    $clean = [regex]::Replace($qTextHtml, '<[^>]+>', ' ')
                    $clean = [System.Net.WebUtility]::HtmlDecode($clean)
                    $clean = $clean -replace '\s+', ' '
                    $qObj.text = $clean.Trim()
                }
                
                # Extract options/answers
                $optMatches = [regex]::Matches($qhtml, 'value="(\d+)"[^>]*>([\s\S]*?)</label>')
                foreach ($opt in $optMatches) {
                    $optText = [regex]::Replace($opt.Groups[2].Value, '<[^>]+>', ' ')
                    $optText = [System.Net.WebUtility]::HtmlDecode($optText)
                    $optText = $optText -replace '\s+', ' '
                    $qObj.options += $optText.Trim()
                }
                
                $quizMeta.questions += $qObj
            }
        }
        
        $allQuizzes += $quizMeta
    } catch {
        Write-Output "ERROR fetching $url : $_"
    }
}

# Save all quiz data as JSON
$allQuizzes | ConvertTo-Json -Depth 10 | Out-File "C:\Users\TIMIRE\Downloads\reaction-speed-roulette\data\primaed\all_quizzes.json" -Encoding UTF8
Write-Output "`n=== DONE ==="
Write-Output "Total quizzes: $($allQuizzes.Count)"
$totalQ = ($allQuizzes | ForEach-Object { $_.questions.Count } | Measure-Object -Sum).Sum
Write-Output "Total questions extracted: $totalQ"