param(
    [Parameter(Mandatory=$true)][string]$ImagePath,
    [string]$LogPath = ""
)
$ErrorActionPreference = 'Stop'
if (-not $LogPath) { $LogPath = $ImagePath + ".ocr.txt" }
$log = New-Object System.Collections.Generic.List[string]

Add-Type -AssemblyName System.Runtime.WindowsRuntime

$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]

function Await($WinRtTask, $ResultType) {
    $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
    $netTask = $asTask.Invoke($null, @($WinRtTask))
    $netTask.Wait(-1) | Out-Null
    $netTask.Result
}

[Windows.Storage.StorageFile,Windows.Storage,ContentType=WindowsRuntime] | Out-Null
[Windows.Media.Ocr.OcrEngine,Windows.Foundation,ContentType=WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder,Windows.Foundation,ContentType=WindowsRuntime] | Out-Null

try {
    $file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($ImagePath)) ([Windows.Storage.StorageFile])
    $log.Add("file=$($file.Name)")
    $stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
    $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $log.Add("pixel=$($decoder.PixelWidth)x$($decoder.PixelHeight)")
    $bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
    $log.Add("bitmap=$($bitmap.PixelWidth)x$($bitmap.PixelHeight)")

    $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
    if (-not $engine) {
        $en = New-Object Windows.Globalization.Language('en-US')
        $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($en)
    }
    $log.Add("engine_null=$($null -eq $engine)")

    $result = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
    $log.Add("lines=$($result.Lines.Count)")
    foreach ($line in $result.Lines) {
        foreach ($word in $line.Words) {
            $r = $word.BoundingRect
            $log.Add(("{0}|{1}|{2}|{3}" -f $word.Text, [int]$r.X, [int]$r.Y, [int]$r.Width))
        }
    }
} catch {
    $log.Add("ERROR: $_")
}

[System.IO.File]::WriteAllLines($LogPath, $log, (New-Object System.Text.UTF8Encoding($false)))
Write-Output "Wrote $LogPath ($($log.Count) lines)"