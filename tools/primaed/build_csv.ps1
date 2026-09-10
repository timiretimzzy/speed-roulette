$ErrorActionPreference = 'Stop'
$baseDir = "C:\Users\TIMIRE\Downloads\reaction-speed-roulette\data\primaed"
$data = Get-Content -LiteralPath (Join-Path $baseDir "parsed_quizzes_enriched.json") -Raw | ConvertFrom-Json

# Build image map: question_post_id -> array of upload URLs from API content.rendered
$imgMap = @{}
# Build filename map: image_url -> local filename in images dir
$localMap = @{}
Get-ChildItem -LiteralPath (Join-Path $baseDir "images") -File | ForEach-Object {
    $localMap[$_.Name.ToLowerInvariant()] = $_.Name
}
Get-ChildItem -LiteralPath (Join-Path $baseDir "question_details") -Filter "q_*.json" | ForEach-Object {
    $id = $_.BaseName.Substring(2)
    try {
        $j = Get-Content -LiteralPath $_.FullName -Raw | ConvertFrom-Json
        if ($j.content -and $j.content.rendered) {
            $ms = [regex]::Matches($j.content.rendered, 'src="([^"]+/wp-content/uploads/[^"]+)"')
            $urls = @($ms | ForEach-Object { $_.Groups[1].Value })
            if ($urls.Count -gt 0) { $imgMap[$id] = $urls }
        }
    } catch {}
}

function Get-LocalFile {
    param([string]$url)
    $name = [System.IO.Path]::GetFileName(($url -split '\?')[0])
    if (-not $name) { return "" }
    if ($localMap.ContainsKey($name.ToLowerInvariant())) { return $localMap[$name.ToLowerInvariant()] }
    return ""
}

$rows = @()
$imageRefCount = 0
$missingLocal = @()
$maxOptions = 0

foreach ($q in $data) {
    $cat = "Other"
    $name = $q.name
    if ($name -like "mock-test*") { $cat = "Mock Tests" }
    elseif ($name -like "quiz-practice*") { $cat = "Practice Quizzes" }
    elseif ($name -like "regulations*") { $cat = "Regulations & Precautions" }
    elseif ($name -like "road-signs*") { $cat = "Road Signs" }
    elseif ($name -like "junction-rules*") { $cat = "Junction Rules" }
    elseif ($name -like "carriageway*") { $cat = "Carriageway Lines" }
    elseif ($name -like "traffic-lights*") { $cat = "Traffic Lights" }
    elseif ($name -like "difficult*") { $cat = "Difficult Questions" }
    elseif ($name -like "supercut*") { $cat = "Supercut" }
    elseif ($name -like "*checkpoint*" -or $name -like "*check-point*") { $cat = "Checkpoints" }
    elseif ($name -like "training-wheels*") { $cat = "Training Wheels" }
    elseif ($name -like "the-confusing-pair*") { $cat = "Confusing Pair" }

    foreach ($qu in $q.questions) {
        $exp = ""
        if ($qu.explanation) { $exp = $qu.explanation -replace '<[^>]+>', ' ' -replace '&nbsp;', ' ' -replace '\s+', ' ' }
        $exp = $exp.Trim()

        # Option text columns
        $optTexts = @($qu.options | ForEach-Object { if ($_.text) { ([string]$_.text -replace '\s+', ' ').Trim() } else { "" } })
        if ($optTexts.Count -gt $maxOptions) { $maxOptions = $optTexts.Count }

        # Image linkage
        $qid = [string]$qu.question_post_id
        $imgUrl = ""
        $imgFile = ""
        if ($imgMap.ContainsKey($qid)) {
            $imgUrl = $imgMap[$qid][0]
            $imgFile = Get-LocalFile -url $imgUrl
            $imageRefCount++
            if ($imgFile -eq "") { $missingLocal += $qid }
        }

        $obj = [PSCustomObject]@{
            quiz = $q.name
            category = $cat
            quiz_post_id = $q.quizPostId
            question_post_id = $qid
            type = $qu.type
            question = ([string]$qu.text -replace '\s+', ' ').Trim()
            option_1 = if ($optTexts.Count -ge 1) { $optTexts[0] } else { "" }
            option_2 = if ($optTexts.Count -ge 2) { $optTexts[1] } else { "" }
            option_3 = if ($optTexts.Count -ge 3) { $optTexts[2] } else { "" }
            option_4 = if ($optTexts.Count -ge 4) { $optTexts[3] } else { "" }
            option_5 = if ($optTexts.Count -ge 5) { $optTexts[4] } else { "" }
            option_count = $optTexts.Count
            image_url = $imgUrl
            image_file = $imgFile
            explanation = $exp
            has_explanation = ($exp -ne "")
        }
        $rows += $obj
    }
}

$rows | Export-Csv -LiteralPath (Join-Path $baseDir "question_bank_full.csv") -NoTypeInformation -Encoding utf8
Write-Output "CSV written: question_bank_full.csv with $($rows.Count) rows"
Write-Output ""
Write-Output "Total question slots: $($rows.Count)"
Write-Output "Unique questions: $(($rows | Select-Object -ExpandProperty question_post_id -Unique).Count)"
Write-Output "With explanations: $(($rows | Where-Object has_explanation).Count)"
Write-Output "Max options in a single question: $maxOptions"
Write-Output "Question slots referencing an image: $imageRefCount"
Write-Output "Image refs missing a local file: $($missingLocal.Count)"
if ($missingLocal.Count -gt 0) { Write-Output "  missing QIDs: $($missingLocal -join ', ')" }