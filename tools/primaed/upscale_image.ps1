param(
    [Parameter(Mandatory=$true)][string]$ImagePath,
    [int]$Scale = 5,
    [float]$Contrast = 1.5
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$src = $ImagePath
$out = [System.IO.Path]::ChangeExtension($ImagePath, ".up.png")

$img = [System.Drawing.Image]::FromFile($src)
$w = [int]($img.Width * $Scale); $h = [int]($img.Height * $Scale)
$bmp = New-Object System.Drawing.Bitmap($w, $h)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::White)
$g.InterpolationMode = 'HighQualityBicubic'
$g.DrawImage($img, 0, 0, $w, $h)
$g.Dispose()

# Apply contrast via color matrix
$cm = New-Object System.Drawing.Imaging.ColorMatrix
$c = $Contrast
$cm.Matrix00 = $c; $cm.Matrix11 = $c; $cm.Matrix22 = $c
$t = (1 - $c) / 2
$cm.Matrix40 = $t; $cm.Matrix41 = $t; $cm.Matrix42 = $t
$ia = New-Object System.Drawing.Imaging.ImageAttributes
$ia.SetColorMatrix($cm)
$g2 = [System.Drawing.Graphics]::FromImage($bmp)
$r = New-Object System.Drawing.Rectangle(0, 0, $w, $h)
$g2.DrawImage($bmp, $r, 0, 0, $w, $h, [System.Drawing.GraphicsUnit]::Pixel, $ia)
$g2.Dispose()
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose(); $img.Dispose()
Write-Output $out