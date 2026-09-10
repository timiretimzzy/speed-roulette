param()
$ErrorActionPreference = "Stop"
$baseDir = "C:\Users\TIMIRE\Downloads\reaction-speed-roulette\data\primaed"
. (Join-Path $PSScriptRoot "primaed_session.ps1")
$enc = New-Object System.Text.UTF8Encoding($false)

function Get-BodyText($html) {
    $t = $html -replace '(?is)<script[\s\S]*?</script>', ' '
    $t = $t -replace '(?is)<style[\s\S]*?</style>', ' '
    $t = $t -replace '(?is)<!--[\s\S]*?-->', ' '
    $t = $t -replace '(?is)<nav[\s\S]*?</nav>', ' '
    $t = $t -replace '(?is)<header[\s\S]*?</header>', ' '
    $t = $t -replace '(?is)<footer[\s\S]*?</footer>', ' '
    $t = $t -replace '(?is)<form[\s\S]*?</form>', ' '
    $t = $t -replace '(?is)<ul class="wpProQuiz[\s\S]*?</ul>', ' '
    $t = [regex]::Replace($t, '<[^>]+>', ' ')
    $t = [System.Net.WebUtility]::HtmlDecode($t)
    $t = $t -replace '\s+', ' '
    return $t.Trim()
}

$session = Get-PrimaEdSession
$pagesDir = Join-Path $baseDir "pages"
$lessonsDir = Join-Path $baseDir "lessons"
$lessonsTextDir = Join-Path $baseDir "lessons_text"
New-Item -ItemType Directory -Force -Path $pagesDir | Out-Null
New-Item -ItemType Directory -Force -Path $lessonsDir | Out-Null
New-Item -ItemType Directory -Force -Path $lessonsTextDir | Out-Null

# Existing quiz pages (these are handled by recheck_quizzes.ps1)
$knownQuizzes = @(Get-Content -LiteralPath (Join-Path $baseDir "all_quiz_urls.txt") | Where-Object { $_.Trim() -ne "" } | ForEach-Object { $_.Trim() })

# 1. Fetch the course landing page and detect access state
$courseUrl = "https://primaed.com/courses/provisional-licence-course/"
$resp = Invoke-WebRequest -Uri $courseUrl -WebSession $session -UseBasicParsing -TimeoutSec 60
[System.IO.File]::WriteAllText((Join-Path $pagesDir "auth_course.html"), $resp.Content, $enc)
[System.IO.File]::WriteAllText((Join-Path $pagesDir "auth_enrolled_course.html"), $resp.Content, $enc)
$gated = ($resp.Content -match 'Not Enrolled|This course is currently closed')
Write-Output "course page saved ($($resp.Content.Length) bytes) gated=$gated"
if ($gated) {
    Write-Output "WARNING: session is not an enrolled learner -- lesson/quiz pages will redirect to this landing page. Live lesson scraping is blocked until the account is re-enrolled."
}

# 2. Restore the other page snapshots
$pageFetches = @(
    @{ url = "https://primaed.com/";                                   file = "primaed_home.html" }
    @{ url = "https://primaed.com/my-account/";                        file = "my_account.html" }
    @{ url = "https://primaed.com/courses/provisional-licence-course/lessons/junction-rules/quizzes/junction-rules-practice-1/"; file = "quiz_junction_1.html" }
)
foreach ($p in $pageFetches) {
    try {
        $r = Invoke-WebRequest -Uri $p.url -WebSession $session -UseBasicParsing -TimeoutSec 45
        [System.IO.File]::WriteAllText((Join-Path $pagesDir $p.file), $r.Content, $enc)
        Write-Output "  saved $($p.file)"
    } catch { Write-Output "  FAIL $($p.file): $_" }
}

# 3. Collect lesson + topic links from the course outline
$qidsInKnownQuizzes = @{}
foreach ($u in $knownQuizzes) { $qidsInKnownQuizzes[[string]$u] = $true }
$lessonLinks = [regex]::Matches($resp.Content, 'href="(https://primaed\.com/courses/provisional-licence-course/lessons/[^"]+)"') |
    ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique | Where-Object { -not $qidsInKnownQuizzes.ContainsKey([string]$_ ) }
$lessonLinks = @($lessonLinks | Where-Object { $_ -match '/lessons/' -and $_ -match 'topic/|/lessons/[^/]+/$' })
Write-Output "non-quiz lesson/topic links: $($lessonLinks.Count)"

$structure = @()
foreach ($url in $lessonLinks) {
    $slug = ($url -split '/')[-2]
    try {
        $r = Invoke-WebRequest -Uri $url -WebSession $session -UseBasicParsing -TimeoutSec 45
        # LearnDash redirects gated lessons/topics to the course landing page
        if ($r.Content -match 'Not Enrolled|This course is currently closed') {
            Write-Output "  SKIP $slug (gated -- redirected to course landing)"
            continue
        }
        [System.IO.File]::WriteAllText((Join-Path $lessonsDir "$slug.html"), $r.Content, $enc)
        $title = ""
        if ($r.Content -match '(?is)<title>([\s\S]*?)</title>') { $title = [System.Net.WebUtility]::HtmlDecode($Matches[1].Trim()) }
        $text = Get-BodyText $r.Content
        [System.IO.File]::WriteAllText((Join-Path $lessonsTextDir "$slug.txt"), $text, $enc)
        $structure += [PSCustomObject]@{ slug = $slug; url = $url; title = $title; html = "lessons/$slug.html"; text = "lessons_text/$slug.txt"; chars = $text.Length }
        Write-Output "  lesson $slug ($($text.Length) chars)"
    } catch {
        Write-Output "  FAIL $slug : $_"
    }
}

$structure | ConvertTo-Json -Depth 4 | Out-File -FilePath (Join-Path $baseDir "course_structure.json") -Encoding utf8
Write-Output "course_structure.json written ($($structure.Count) lessons/topics)"