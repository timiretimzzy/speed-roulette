$ErrorActionPreference = 'Continue'
$rawDir = "C:\Users\TIMIRE\Downloads\reaction-speed-roulette\data\primaed\raw"
$imageDir = "C:\Users\TIMIRE\Downloads\reaction-speed-roulette\data\primaed\images"
if (-not (Test-Path $imageDir)) { New-Item -ItemType Directory -Path $imageDir | Out-Null }

$files = Get-ChildItem $rawDir -Filter "*.html"
Write-Output "HTML files: $($files.Count)"

$allQuizzes = @()
$allImages = @()
$totalQuestions = 0

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $quizName = $file.BaseName
    
    $quizObj = @{
        name = $quizName
        file = $file.Name
        quizPostId = ""
        passingPercentage = ""
        mode = ""
        timelimit = ""
        globalPoints = ""
        questionCount = ""
        questions = @()
    }
    
    if ($content -match 'quiz: (\d+),') { $quizObj.quizPostId = $matches[1] }
    if ($content -match 'passingpercentage: (\d+)') { $quizObj.passingPercentage = $matches[1] }
    if ($content -match 'mode: (\d+)') { $quizObj.mode = $matches[1] }
    if ($content -match 'timelimit: (\d+)') { $quizObj.timelimit = $matches[1] }
    if ($content -match 'globalPoints: (\d+)') { $quizObj.globalPoints = $matches[1] }
    if ($content -match 'Question <span>\d+</span> of <span>(\d+)</span>') { $quizObj.questionCount = $matches[1] }
    
    # Extract question blocks - each li.wpProQuiz_listItem with data-question-meta
    $listItems = [regex]::Matches($content, '<li class="wpProQuiz_listItem"[^>]*data-question-meta="([^"]*)"')
    
    if ($listItems.Count -eq 0) {
        Write-Output "  $quizName : NO questions found"
        continue
    }
    
    # For each question, get its question_post_id
    $questionMetaIds = @()
    foreach ($li in $listItems) {
        if ($li.Groups[1].Value -match 'question_post_id&quot;:(\d+)') {
            $questionMetaIds += $matches[1]
        }
    }
    
    $quizObj.questionCount = $listItems.Count
    
    # Now split content into question sections by splitting on the listItem markers
    $segments = [regex]::Split($content, '(?=<li class="wpProQuiz_listItem")')
    
    foreach ($seg in $segments) {
        if ($seg -notmatch 'data-question-meta=') { continue }
        
        # Extract question post id
        $qPostId = ""
        if ($seg -match 'question_post_id&quot;:(\d+)') { $qPostId = $matches[1] }
        
        # Extract question text
        $qText = ""
        if ($seg -match '<div class="wpProQuiz_question_text">([\s\S]*?)</div>\s*<p class="wpProQuiz_clear') {
            $qTextHtml = $matches[1]
        } elseif ($seg -match '<div class="wpProQuiz_question_text">([\s\S]*?)</div>') {
            $qTextHtml = $matches[1]
        }
        if ($qText -eq "" -and $qTextHtml) {
            # Extract text, keep image URLs, strip other tags
            $imgRefs = [regex]::Matches($qTextHtml, 'src="([^"]*)"')
            $cleanText = [regex]::Replace($qTextHtml, '<[^>]+>', ' ')
            $cleanText = [System.Net.WebUtility]::HtmlDecode($cleanText)
            $cleanText = $cleanText -replace '\s+', ' '
            $qText = $cleanText.Trim()
            
            foreach ($img in $imgRefs) {
                $allImages += @{ url = $img.Groups[1].Value; quiz = $quizName; question = $qPostId }
            }
        }
        
        # Extract question title
        $qTitle = ""
        if ($seg -match '<h5[^>]*>\s*<span>\d+</span>\.\s*Question\s*</h5>\s*([\s\S]*?)(?=<div class="wpProQuiz_question"|<ul class="wpProQuiz_questionList")') {
            $qTitle = ([regex]::Replace($matches[1], '<[^>]+>', ' ')).Trim()
        }
        
        # Extract answer options
        $options = @()
        $ansMatches = [regex]::Matches($seg, '<li class="wpProQuiz_questionListItem"[\s\S]*?<label>\s*<input[^>]*?value="(\d+)"[^>]*>\s*([\s\S]*?)</label>')
        foreach ($ans in $ansMatches) {
            $optText = [regex]::Replace($ans.Groups[2].Value, '<[^>]+>', ' ')
            $optText = [System.Net.WebUtility]::HtmlDecode($optText)
            $optText = $optText -replace '\s+', ' '
            $options += [PSCustomObject]@{ value = $ans.Groups[1].Value; text = $optText.Trim() }
        }
        
        # Extract question type
        $qType = "single"
        if ($seg -match 'data-type="([^"]*)"') { $qType = $matches[1] }
        
        # Extract next button message / placeholder
        $qObj = [PSCustomObject]@{
            question_post_id = $qPostId
            title = $qTitle
            type = $qType
            text = $qText
            options = $options
        }
        $quizObj.questions += $qObj
        $totalQuestions++
    }
    
    $allQuizzes += $quizObj
    Write-Output "  Parsed $quizName : $($quizObj.questions.Count) questions"
}

# Save parsed quiz data
$allQuizzes | ConvertTo-Json -Depth 10 | Out-File "C:\Users\TIMIRE\Downloads\reaction-speed-roulette\data\primaed\parsed_quizzes.json" -Encoding UTF8

# Deduplicate images and save list
$uniqueImages = $allImages | ForEach-Object { $_.url } | Where-Object { $_ -match '^https?://' -and $_ -match '\.(jpg|jpeg|png|gif|webp)' } | Sort-Object -Unique
$uniqueImages | Out-File "C:\Users\TIMIRE\Downloads\reaction-speed-roulette\data\primaed\image_urls.txt" -Encoding UTF8

Write-Output "`n=== SUMMARY ==="
Write-Output "Quizzes parsed: $($allQuizzes.Count)"
Write-Output "Total questions: $totalQuestions"
Write-Output "Total unique image URLs: $($uniqueImages.Count)"