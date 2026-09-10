$ErrorActionPreference = 'Stop'
$file = "C:\Users\TIMIRE\Downloads\reaction-speed-roulette\data\primaed\junction_rules_practice_1.html"
$content = Get-Content $file -Raw

# find the wpProQuiz JSON config (contains questions, answers, correct answers)
# Look for the localized script data with question config
$patterns = @(
    'var quiz_',
    'wpProQuiz',
    'questions_data',
    'questionList',
    'correct',
    'points'
)

# Find the quiz container start
$idx = $content.IndexOf('<div class="wpProQuiz_content')
if ($idx -lt 0) { $idx = $content.IndexOf('wpProQuiz_questionList') }
Write-Output "Quiz container idx: $idx"

# Extract the quiz HTML section
$startIdx = $content.LastIndexOf('<div', $idx)
$endIdx = $content.IndexOf('</div>', $idx)
Write-Output "Section: $startIdx to $endIdx"

# Find all question blocks
$questionRegex = [regex]'<li class="wpProQuiz_questionListItem"[\s\S]*?</li>'
$questions = $questionRegex.Matches($content)
Write-Output "Questions matched: $($questions.Count)"

# Extract question text and answers
$qtextRegex = [regex]'<div class="wpProQuiz_question_text">([\s\S]*?)</div>'
$answerRegex = [regex]'<label[\s\S]*?<input[^>]*?(?:value="([^"]*)")?[^>]*>([\s\S]*?)</label>'

Write-Output ""
Write-Output "========== QUESTIONS & ANSWERS =========="
foreach ($q in $questions) {
    $qhtml = $q.Value
    $qtext = $qtextRegex.Match($qhtml)
    if ($qtext.Success) {
        Write-Output ""
        Write-Output "--- QUESTION ---"
        # Strip HTML tags from question text
        $clean = [regex]::Replace($qtext.Groups[1].Value, '<[^>]+>', ' ')
        $clean = [System.Net.WebUtility]::HtmlDecode($clean)
        $clean = $clean -replace '\s+', ' '
        Write-Output $clean.Trim()
        
        # Get answers
        $anss = $answerRegex.Matches($qhtml)
        Write-Output "  Options:"
        foreach ($ans in $anss) {
            $cleanAns = [regex]::Replace($ans.Groups[2].Value, '<[^>]+>', ' ')
            $cleanAns = [System.Net.WebUtility]::HtmlDecode($cleanAns)
            $cleanAns = $cleanAns -replace '\s+', ' '
            Write-Output "    - $($cleanAns.Trim())"
        }
    }
}
