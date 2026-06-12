$ErrorActionPreference = "Stop"
$root = "H:\Web\openscreen"
$desktop = Join-Path $root "apps\desktop"
$pub = Join-Path $desktop ".output\public"
$clientBuild = Join-Path $desktop ".vinxi\build\client\_build"
$manifestPath = Join-Path $clientBuild ".vite\manifest.json"
if (-not (Test-Path $manifestPath)) {
	throw "Vite manifest missing — run vinxi build first"
}
$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
$clientEntry = $manifest.'virtual:$vinxi/handler/client'
if (-not $clientEntry) {
	throw "Client entry not found in manifest"
}
$clientJs = "assets/$($clientEntry.file)"

if (Test-Path $pub) { Remove-Item $pub -Recurse -Force }
New-Item -ItemType Directory -Force -Path $pub | Out-Null
Copy-Item $clientBuild (Join-Path $pub "_build") -Recurse -Force

$html = @"
<!DOCTYPE html>
<html lang="zh-CN">
<head>
	<meta charset="utf-8"/>
	<meta name="viewport" content="width=device-width, initial-scale=1"/>
	<title>Screen</title>
	<script type="module" crossorigin src="/_build/$clientJs"></script>
</head>
<body>
	<div id="app"></div>
</body>
</html>
"@

[System.IO.File]::WriteAllText((Join-Path $pub "index.html"), $html, (New-Object System.Text.UTF8Encoding $false))
Write-Output "ASSEMBLED index.html + _build assets at $pub"
