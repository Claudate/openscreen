$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$vcvars = "H:\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
$nodeDir = "H:\tools\node-v20.20.2-win-x64"
$log = Join-Path $root "reko-installer-build.log"

$env:Path = "$nodeDir;C:\Users\Administrator\.cargo\bin;$env:Path"
$env:CMAKE_GENERATOR = "Visual Studio 17 2022"
$env:NODE_OPTIONS = "--max-old-space-size=12288"

Write-Output "=== Reko installer build (NSIS + MSI) ===" | Tee-Object -FilePath $log

$indexHtml = Join-Path $root "apps\desktop\.output\public\index.html"
if (-not (Test-Path $indexHtml)) {
	Write-Output "Frontend missing — run: pnpm --dir apps/desktop build" | Tee-Object -FilePath $log -Append
	exit 1
}

cmd /c "call `"$vcvars`" >nul 2>&1 && set PATH=$nodeDir;C:\Users\Administrator\.cargo\bin;%PATH% && set CMAKE_GENERATOR=Visual Studio 17 2022 && cd /d $root && pnpm exec dotenv -e .env -- pnpm --dir apps/desktop run preparescript && pnpm exec dotenv -e .env -- pnpm --dir apps/desktop tauri build --target x86_64-pc-windows-msvc --config src-tauri/ci-unsigned.conf.json >> `"$log`" 2>&1"

$nsisDir = Join-Path $root "target\x86_64-pc-windows-msvc\release\bundle\nsis"
$msiDir = Join-Path $root "target\x86_64-pc-windows-msvc\release\bundle\msi"
Write-Output "NSIS: $(Get-ChildItem $nsisDir -Filter *.exe -ErrorAction SilentlyContinue | ForEach-Object Name)" | Tee-Object -FilePath $log -Append
Write-Output "MSI:  $(Get-ChildItem $msiDir -Filter *.msi -ErrorAction SilentlyContinue | ForEach-Object Name)" | Tee-Object -FilePath $log -Append
Write-Output "Log: $log"
