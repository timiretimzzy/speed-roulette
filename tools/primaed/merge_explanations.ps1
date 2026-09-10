$ErrorActionPreference = 'Stop'
$baseDir = "C:\Users\TIMIRE\Downloads\reaction-speed-roulette\data\primaed"
$parsedPath = Join-Path $baseDir "parsed_quizzes.json"
$detailsDir = Join-Path $baseDir "question_details"

$data = Get-Content -LiteralPath $parsedPath -Raw | ConvertFrom-Json

# Build lookup dict: question_post_id -> enrichment object
$enrich = @{}
Get-ChildItem -LiteralPath $detailsDir -Filter "q_*.json" | ForEach-Object {
    $id = $_.BaseName.Substring(2)
    try {
        $j = Get-Content -LiteralPath $_.FullName -Raw | ConvertFrom-Json
        $enrich[$id] = $j
    } catch {}
}

Write-Output "Enrichment files: $($enrich.Count)"

$withExplanation = 0
$totalQuestions = 0
$totalQuizzes = $data.Count

foreach ($quiz in $data) {
    foreach ($q in $quiz.questions) {
        $totalQuestions++
        $id = [string]$q.question_post_id
        if ($enrich.ContainsKey($id)) {
            $detail = $enrich[$id]
            $correctMsg = if ($detail.correct_message) { $detail.correct_message.rendered } else { "" }
            $incorrectMsg = if ($detail.incorrect_message) { $detail.incorrect_message.rendered } else { "" }
            $exp = $correctMsg
            if ($exp.Trim() -eq "") { $exp = $incorrectMsg }
            $q | Add-Member -NotePropertyName explanation -NotePropertyValue $exp -Force
            # Add all detail fields for reference
            $q | Add-Member -NotePropertyName question_meta -NotePropertyValue (@{
                title = $detail.title.rendered
                slug = $detail.slug
                quiz = $detail.quiz
                question_type = $detail.question_type
                points_total = $detail.points_total
                correct_same = $detail.correct_same
            }) -Force
            if ($correctMsg.Trim() -ne "" -or $incorrectMsg.Trim() -ne "") {
                $withExplanation++
            }
        }
    }
}

# Round explanations in lists
$data | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $baseDir "parsed_quizzes_enriched.json") -Encoding utf8

Write-Output "Final summary:"
Write-Output "  Quizzes: $totalQuizzes"
Write-Output "  Total questions: $totalQuestions"
Write-Output "  Questions with explanations: $withExplanation"
Write-Output "  Coverage: $([math]::Round(100 * $withExplanation / $totalQuestions, 1))%"