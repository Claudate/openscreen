$ErrorActionPreference = "Continue"
$root = "H:\Web\openscreen"
$vcvars = "H:\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
$nodeDir = "H:\tools\node-v20.20.2-win-x64"
$log = Join-Path $root "screen-portable-build.log"

cmd /c "call `"$vcvars`" >nul 2>&1 && set PATH=$nodeDir;E:\NodeJs\node_global;C:\Users\Administrator\.cargo\bin;%PATH% && set CMAKE_GENERATOR=Visual Studio 17 2022 && set NODE_OPTIONS=--max-old-space-size=12288 && cd /d $root && echo === BUILD START === && pnpm --dir apps/desktop build && echo === VINXI DONE ===" 2>&1 | Tee-Object -FilePath $log

$indexHtml = Join-Path $root "apps\desktop\.output\public\index.html"
if (-not (Test-Path $indexHtml)) {
	Write-Output "vinxi static export incomplete — assembling .output/public manually"
	powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root "scripts\assemble-frontend-public.ps1") 2>&1 | Tee-Object -FilePath $log -Append
}

cmd /c "call `"$vcvars`" >nul 2>&1 && set PATH=$nodeDir;E:\NodeJs\node_global;C:\Users\Administrator\.cargo\bin;%PATH% && set CMAKE_GENERATOR=Visual Studio 17 2022 && cd /d $root && pnpm exec dotenv -e .env -- pnpm --dir apps/desktop run preparescript && pnpm exec dotenv -e .env -- pnpm --dir apps/desktop tauri build --target x86_64-pc-windows-msvc --config src-tauri/ci-nofe.conf.json --no-bundle && echo === BUILD OK ===" 2>&1 | Tee-Object -FilePath $log -Append

$exe = Join-Path $root "target\x86_64-pc-windows-msvc\release\Reko.exe"
if (-not (Test-Path $exe)) {
	throw "Reko.exe not found after build"
}

$size = (Get-Item $exe).Length
if ($size -lt 65MB) {
	throw "Reko.exe too small ($size bytes) — frontend likely not embedded"
}

$portable = Join-Path $root "dist\Reko-Portable"
New-Item -ItemType Directory -Force -Path $portable | Out-Null

Copy-Item $exe (Join-Path $portable "Reko.exe") -Force
$assetsSrc = Join-Path $root "target\x86_64-pc-windows-msvc\release\assets"
if (Test-Path $assetsSrc) {
	$assetsDst = Join-Path $portable "assets"
	if (Test-Path $assetsDst) { Remove-Item $assetsDst -Recurse -Force }
	Copy-Item $assetsSrc $assetsDst -Recurse -Force
}

$dllNames = @(
	"avcodec-61.dll", "avdevice-61.dll", "avfilter-10.dll", "avformat-61.dll",
	"avutil-59.dll", "postproc-58.dll", "swresample-5.dll", "swscale-8.dll", "DirectML.dll"
)
$releaseDir = Join-Path $root "target\x86_64-pc-windows-msvc\release"
foreach ($dll in $dllNames) {
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

Write-Output "DONE Reko.exe $size bytes SHA256=$shaExe"
Write-Output "ZIP $zip SHA256=$shaZip"
