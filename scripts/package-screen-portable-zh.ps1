$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$exe = Join-Path $root "target\x86_64-pc-windows-msvc\release\Reko.exe"
if (-not (Test-Path $exe)) { throw "Reko.exe missing" }
$size = (Get-Item $exe).Length
if ($size -lt 65MB) { throw "Reko.exe too small (frontend likely missing): $size" }

$portable = Join-Path $root "dist\Reko-Portable"
New-Item -ItemType Directory -Force -Path $portable | Out-Null
Copy-Item $exe (Join-Path $portable "Reko.exe") -Force

$assetsSrc = Join-Path $root "target\x86_64-pc-windows-msvc\release\assets"
if (Test-Path $assetsSrc) {
	$assetsDst = Join-Path $portable "assets"
	if (Test-Path $assetsDst) { Remove-Item $assetsDst -Recurse -Force }
	Copy-Item $assetsSrc $assetsDst -Recurse -Force
}

$releaseDir = Join-Path $root "target\x86_64-pc-windows-msvc\release"
foreach ($dll in @(
	"avcodec-61.dll", "avdevice-61.dll", "avfilter-10.dll", "avformat-61.dll",
	"avutil-59.dll", "postproc-58.dll", "swresample-5.dll", "swscale-8.dll", "DirectML.dll"
)) {
	Copy-Item (Join-Path $releaseDir $dll) (Join-Path $portable $dll) -Force
}
foreach ($sidecar in @("cap-cli.exe", "cap-exporter.exe", "cap-muxer.exe")) {
	Copy-Item (Join-Path $releaseDir $sidecar) (Join-Path $portable $sidecar) -Force
}

$zip = Join-Path $root "dist\Reko-Portable-win-x64-zh.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path (Join-Path $portable "*") -DestinationPath $zip -Force

$shaExe = (Get-FileHash (Join-Path $portable "Reko.exe") -Algorithm SHA256).Hash
$shaZip = (Get-FileHash $zip -Algorithm SHA256).Hash

@{
	builtAt = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss")
	product = "Reko"
	locale = "zh-CN"
	portableDir = "dist/Reko-Portable"
	zip = "dist/Reko-Portable-win-x64-zh.zip"
	exeBytes = $size
	sha256 = @{ RekoExe = $shaExe; zip = $shaZip }
} | ConvertTo-Json | Set-Content (Join-Path $root "dist\manifest-reko-portable-zh.json") -Encoding UTF8

Write-Output "PACKAGED exe=$size sha=$shaExe"
Write-Output "ZIP sha=$shaZip"
