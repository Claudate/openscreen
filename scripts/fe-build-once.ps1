$env:PATH = "H:\tools\node-v20.20.2-win-x64;E:\NodeJs\node_global;C:\Users\Administrator\.cargo\bin;" + $env:PATH
$env:NODE_OPTIONS = "--max-old-space-size=12288"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root
& pnpm --dir apps/desktop build *>&1 | Out-File -FilePath (Join-Path $root "fe-build.log") -Encoding utf8
"PNPM_EXIT=$LASTEXITCODE" | Out-File (Join-Path $root "fe-build.log") -Append -Encoding utf8
Write-Output "PNPM_EXIT=$LASTEXITCODE"
