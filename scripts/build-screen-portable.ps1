$ErrorActionPreference = "Continue"
$root = "H:\Web\openscreen"
$vcvars = "H:\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
$nodeDir = "H:\tools\node-v20.20.2-win-x64"
$log = Join-Path $root "screen-portable-build.log"

cmd /c "call `"$vcvars`" >nul 2>&1 && set PATH=$nodeDir;C:\Users\Administrator\.cargo\bin;%PATH% && set CMAKE_GENERATOR=Visual Studio 17 2022 && cd /d $root && echo === BUILD START === && pnpm --dir apps/desktop build && pnpm exec dotenv -e .env -- pnpm --dir apps/desktop run preparescript && pnpm exec dotenv -e .env -- pnpm --dir apps/desktop tauri build --target x86_64-pc-windows-msvc --config src-tauri/ci-nofe.conf.json --no-bundle && echo === BUILD OK ===" 2>&1 | Tee-Object -FilePath $log

$exe = Join-Path $root "target\x86_64-pc-windows-msvc\release\Screen.exe"
if (-not (Test-Path $exe)) {
	throw "Screen.exe not found after build"
}

$size = (Get-Item $exe).Length
if ($size -lt 70MB) {
	throw "Screen.exe too small ($size bytes) — frontend likely not embedded"
}

$portable = Join-Path $root "dist\Screen-Portable"
New-Item -ItemType Directory -Force -Path $portable | Out-Null

Copy-Item $exe (Join-Path $portable "Screen.exe") -Force
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

$zip = Join-Path $root "dist\Screen-Portable-win-x64.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path (Join-Path $portable "*") -DestinationPath $zip -Force

$shaExe = (Get-FileHash (Join-Path $portable "Screen.exe") -Algorithm SHA256).Hash
$shaZip = (Get-FileHash $zip -Algorithm SHA256).Hash

@{
	builtAt = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss")
	product = "Screen"
	portableDir = "dist/Screen-Portable"
	exeBytes = $size
	sha256 = @{ ScreenExe = $shaExe; zip = $shaZip }
} | ConvertTo-Json | Set-Content (Join-Path $root "dist\manifest-screen-portable.json") -Encoding UTF8

Write-Output "DONE Screen.exe $size bytes SHA256=$shaExe"
Write-Output "ZIP $zip SHA256=$shaZip"
