# Builds the pictures used when the film's link is shared:
#   og-heart.jpg          1200x630, the link preview in LINE / Facebook / Messenger
#   apple-touch-icon.png  180x180, the icon when the film is added to a home screen
# Both are photographs of share-card.html (a heart made of the album's own photos),
# taken with headless Chrome or Edge. Run again after changing the photos:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\build-share-image.ps1
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$browser = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $browser) { throw 'Google Chrome or Microsoft Edge is needed to build the share image.' }

$tmp = Join-Path $env:TEMP 'khaokho-share-card'
New-Item -ItemType Directory -Force $tmp | Out-Null
$page = ([Uri](Join-Path $root 'share-card.html')).AbsoluteUri

function Take-Shot([int]$w, [int]$h, [string]$hash, [string]$out) {
  if (Test-Path $out) { Remove-Item $out }
  $args = @('--headless=new', '--hide-scrollbars', '--force-device-scale-factor=1', "--window-size=$w,$h",
    '--timeout=20000', "--screenshot=$out", "--user-data-dir=$tmp\profile", "`"$page$hash`"")
  Start-Process -FilePath $browser -ArgumentList $args -Wait -NoNewWindow -RedirectStandardError "$tmp\log.txt"
  if (-not (Test-Path $out)) { throw "No screenshot was produced for $page$hash" }
}

Take-Shot 1200 630 '' "$tmp\og.png"
Take-Shot 512 512 '#square' "$tmp\square.png"

Add-Type -AssemblyName System.Drawing
$jpeg = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$params = New-Object System.Drawing.Imaging.EncoderParameters 1
$params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality, [long]90)

$og = [System.Drawing.Image]::FromFile("$tmp\og.png")
$bmp = New-Object System.Drawing.Bitmap 1200, 630
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.DrawImage($og, 0, 0, 1200, 630)
$g.Dispose(); $og.Dispose()
$bmp.Save((Join-Path $root 'og-heart.jpg'), $jpeg, $params)
$bmp.Dispose()

$sq = [System.Drawing.Image]::FromFile("$tmp\square.png")
$icon = New-Object System.Drawing.Bitmap 180, 180
$g = [System.Drawing.Graphics]::FromImage($icon)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.DrawImage($sq, 0, 0, 180, 180)
$g.Dispose(); $sq.Dispose()
$icon.Save((Join-Path $root 'apple-touch-icon.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$icon.Dispose()

Get-Item (Join-Path $root 'og-heart.jpg'), (Join-Path $root 'apple-touch-icon.png') | Select-Object Name, Length | Format-Table -AutoSize
