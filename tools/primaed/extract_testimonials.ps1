param()
$ErrorActionPreference = "Stop"
$baseDir = "C:\Users\TIMIRE\Downloads\reaction-speed-roulette\data\primaed"
$enc = New-Object System.Text.UTF8Encoding($false)

# Extract learner testimonials/comments from saved course-page snapshots.
# Astra theme markup: <article id="comment-N" class="ast-comment"> ... <b class="fn">Author</b>
# ... <time datetime="..."> ... <section class="ast-comment-content"> text
$htmlFile = Join-Path $baseDir "pages\auth_course.html"
if (-not (Test-Path -LiteralPath $htmlFile)) { Write-Output "no auth_course.html yet -- run scrape_course_content.ps1 first"; exit 1 }

$html = [System.IO.File]::ReadAllText($htmlFile)
$blocks = $html -split '(?=<article id="comment-)'
$comments = [System.Collections.Generic.List[object]]::new()

foreach ($b in $blocks) {
    if ($b -notmatch '^<article id="comment-(\d+)"') { continue }
    $cid = $Matches[1]
    $author = ""
    if ($b -match '<b class="fn">\s*(?:<a[^>]*>)?([\s\S]*?)(?:</a>)?\s*</b>') {
        $author = [System.Net.WebUtility]::HtmlDecode(([regex]::Replace($Matches[1], '<[^>]+>', '')).Trim())
    }
    $dateStr = ""
    if ($b -match '<time datetime="([^"]+)"') { $dateStr = $Matches[1] }
    $content = ""
    if ($b -match 'class="ast-comment-content comment ?[^"]*">([\s\S]*?)</section>') {
        $content = [System.Net.WebUtility]::HtmlDecode(([regex]::Replace($Matches[1], '<[^>]+>', ' ')))
        $content = ($content -replace '\s+', ' ').Trim()
    }
    $comments.Add([PSCustomObject]@{
        id = $cid
        author = $author
        date = $dateStr
        text = $content
    })
}

$outDir = Join-Path $baseDir "testimonials"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$comments | ConvertTo-Json -Depth 3 | Out-File -FilePath (Join-Path $outDir "testimonials.json") -Encoding utf8
Write-Output "testimonials.json written: $($comments.Count) comments (from pages/auth_course.html)"