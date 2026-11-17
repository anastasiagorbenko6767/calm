# Генерирует иконки Android из public/static/images/frog.png.
# Требует System.Drawing (есть во всех Windows по умолчанию).
# Запуск: powershell -ExecutionPolicy Bypass -File scripts\make-android-icons.ps1

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $MyInvocation.MyCommand.Path | Split-Path -Parent
$src  = Join-Path $root "public\static\images\frog.png"
if (-not (Test-Path $src)) { throw "Не найден $src" }

# Размеры стандартных Android-мипмапов
$sizes = @{
  "mipmap-mdpi"    = 48
  "mipmap-hdpi"    = 72
  "mipmap-xhdpi"   = 96
  "mipmap-xxhdpi"  = 144
  "mipmap-xxxhdpi" = 192
}

$srcImg = [System.Drawing.Image]::FromFile($src)

foreach ($folder in $sizes.Keys) {
  $size = $sizes[$folder]
  $dir  = Join-Path $root "android\app\src\main\res\$folder"
  if (-not (Test-Path $dir)) {
    Write-Host "Skip $folder (folder missing; run 'npm run android:add' first)"; continue
  }

  # Квадратная подложка-круг в фирменной палитре
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

  # Градиентный фон
  $rect = New-Object System.Drawing.Rectangle 0, 0, $size, $size
  $c1 = [System.Drawing.ColorTranslator]::FromHtml("#1b8a5a")
  $c2 = [System.Drawing.ColorTranslator]::FromHtml("#93c4a7")
  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, $c1, $c2, 45
  $g.FillRectangle($brush, $rect)
  $brush.Dispose()

  # Жаба поверх
  $pad = [int]($size * 0.08)
  $dst = New-Object System.Drawing.Rectangle $pad, $pad, ($size - 2 * $pad), ($size - 2 * $pad)
  $g.DrawImage($srcImg, $dst)

  # Квадратная иконка
  $outSquare = Join-Path $dir "ic_launcher.png"
  $bmp.Save($outSquare, [System.Drawing.Imaging.ImageFormat]::Png)

  # Круглая (та же, но клиппаем в круг)
  $round = New-Object System.Drawing.Bitmap $size, $size
  $gr = [System.Drawing.Graphics]::FromImage($round)
  $gr.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddEllipse(0, 0, $size, $size)
  $gr.SetClip($path)
  $gr.DrawImage($bmp, 0, 0, $size, $size)
  $outRound = Join-Path $dir "ic_launcher_round.png"
  $round.Save($outRound, [System.Drawing.Imaging.ImageFormat]::Png)

  # Foreground (адаптивная иконка, прозрачный фон, только жаба в центре)
  $fg = New-Object System.Drawing.Bitmap $size, $size
  $gfg = [System.Drawing.Graphics]::FromImage($fg)
  $gfg.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $gfg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $pad2 = [int]($size * 0.2)
  $dst2 = New-Object System.Drawing.Rectangle $pad2, $pad2, ($size - 2 * $pad2), ($size - 2 * $pad2)
  $gfg.DrawImage($srcImg, $dst2)
  $outFg = Join-Path $dir "ic_launcher_foreground.png"
  $fg.Save($outFg, [System.Drawing.Imaging.ImageFormat]::Png)

  $g.Dispose(); $gr.Dispose(); $gfg.Dispose()
  $bmp.Dispose(); $round.Dispose(); $fg.Dispose()
  Write-Host "[OK] $folder ($size)"
}

$srcImg.Dispose()
Write-Host ""
Write-Host "Done. Rebuild APK: npm run android:build"
