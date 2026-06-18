<#
.SYNOPSIS
    Automated desktop release: trigger CI build → wait → download → create/update GitHub Release.
.PARAMETER Version
    Semver tag (e.g. "0.5.2"). Defaults to version from tauri.conf.json.
.PARAMETER Platform
    "both" (default), "windows", or "macos".
.PARAMETER SkipBuild
    Skip CI trigger; just download latest artifacts and create release.
.PARAMETER DryRun
    Print what would happen without executing.
#>
param(
	[string]$Version,
	[ValidateSet("both","windows","macos")]
	[string]$Platform = "both",
	[switch]$SkipBuild,
	[switch]$DryRun
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

Push-Location $root
try {
	if (-not $Version) {
		$conf = Get-Content "apps/desktop/src-tauri/tauri.conf.json" -Raw | ConvertFrom-Json
		$Version = $conf.version
	}
	$tag = "v$Version"
	Write-Host "[release] Version: $tag  Platform: $Platform" -ForegroundColor Cyan

	if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
		throw "gh CLI not found. Install: https://cli.github.com/"
	}

	$dirty = git status --porcelain
	if ($dirty) {
		Write-Host "[release] Uncommitted changes detected — committing..." -ForegroundColor Yellow
		git add -A
		git commit -m "chore: pre-release cleanup for $tag"
		git push origin main
	}

	if (-not $SkipBuild) {
		Write-Host "[release] Triggering Build Desktop (platform=$Platform)..." -ForegroundColor Cyan
		if ($DryRun) {
			Write-Host "[dry-run] gh workflow run build-desktop.yml --ref main -f platform=$Platform"
		} else {
			gh workflow run build-desktop.yml --ref main -f platform=$Platform
			Start-Sleep -Seconds 10

			$runs = gh run list --limit 1 --json databaseId,status,createdAt | ConvertFrom-Json
			$runId = $runs[0].databaseId
			Write-Host "[release] Build triggered: Run #$runId" -ForegroundColor Green
			Write-Host "[release] Waiting for build to complete (this may take 40-90 minutes)..." -ForegroundColor Yellow
			Write-Host "[release] Monitor: https://github.com/Claudate/openscreen/actions/runs/$runId"

			gh run watch $runId --exit-status 2>$null
			if ($LASTEXITCODE -ne 0) {
				$runInfo = gh run view $runId --json conclusion | ConvertFrom-Json
				if ($runInfo.conclusion -ne "success") {
					throw "Build failed with conclusion: $($runInfo.conclusion). Check: https://github.com/Claudate/openscreen/actions/runs/$runId"
				}
			}
			Write-Host "[release] Build completed successfully!" -ForegroundColor Green
		}
	}

	$outDir = Join-Path $root "dist/release-$tag"
	New-Item -ItemType Directory -Force -Path $outDir | Out-Null

	$runs = gh run list --limit 5 --json databaseId,status,conclusion,name | ConvertFrom-Json
	$successRun = $runs | Where-Object { $_.name -eq "Build Desktop (Unsigned)" -and $_.conclusion -eq "success" } | Select-Object -First 1
	if (-not $successRun) {
		throw "No successful Build Desktop run found. Run the build first."
	}
	$runId = $successRun.databaseId

	Write-Host "[release] Downloading artifacts from Run #$runId..." -ForegroundColor Cyan
	if (-not $DryRun) {
		gh run download $runId -D $outDir 2>$null
	}

	$assets = @()
	$winDir = Join-Path $outDir "cap-windows-x64-unsigned"
	if (Test-Path $winDir) {
		$nsis = Get-ChildItem $winDir -Filter "*.exe" -Recurse | Select-Object -First 1
		$msi = Get-ChildItem $winDir -Filter "*.msi" -Recurse | Select-Object -First 1
		if ($nsis) { $assets += $nsis.FullName }
		if ($msi) { $assets += $msi.FullName }
	}

	$macArmDir = Join-Path $outDir "cap-macos-aarch64-unsigned"
	if (Test-Path $macArmDir) {
		$dmg = Get-ChildItem $macArmDir -Filter "*.dmg" -Recurse | Select-Object -First 1
		$appZip = Get-ChildItem $macArmDir -Filter "*.zip" -Recurse | Select-Object -First 1
		if ($dmg) { $assets += $dmg.FullName }
		if ($appZip) { $assets += $appZip.FullName }
	}

	$macX64Dir = Join-Path $outDir "cap-macos-x64-unsigned"
	if (Test-Path $macX64Dir) {
		$dmgX64 = Get-ChildItem $macX64Dir -Filter "*.dmg" -Recurse | Select-Object -First 1
		if ($dmgX64) { $assets += $dmgX64.FullName }
	}

	Write-Host "[release] Found $($assets.Count) assets:" -ForegroundColor Cyan
	foreach ($a in $assets) { Write-Host "  - $(Split-Path -Leaf $a)" }

	$releaseNotes = @"
## Screen $tag

### Downloads
- **Windows**: NSIS installer (.exe) — Chinese installation UI
- **macOS ARM** (Apple Silicon): DMG + .app zip
- **macOS Intel**: DMG (if available)

### Changes since last release
$(git log --oneline "$tag^..HEAD" 2>$null || git log --oneline -10)

### Notes
- Windows installer displays Chinese interface on Chinese systems
- macOS builds are ad-hoc signed (right-click → Open on first launch)
- DLL isolation fix included (prevents Anaconda/PATH conflicts)
"@

	$existingRelease = gh release view $tag --json tagName 2>$null
	if ($existingRelease) {
		Write-Host "[release] Release $tag exists — updating assets..." -ForegroundColor Yellow
		if (-not $DryRun) {
			foreach ($a in $assets) {
				$name = Split-Path -Leaf $a
				gh release delete-asset $tag $name --yes 2>$null
				gh release upload $tag $a --clobber
			}
			gh release edit $tag --notes $releaseNotes
		}
	} else {
		Write-Host "[release] Creating new release $tag..." -ForegroundColor Cyan
		if (-not $DryRun) {
			$assetArgs = $assets -join " "
			gh release create $tag $assets --title "Screen $tag" --notes $releaseNotes
		}
	}

	Write-Host ""
	Write-Host "========================================" -ForegroundColor Green
	Write-Host " Release $tag completed!" -ForegroundColor Green
	Write-Host " https://github.com/Claudate/openscreen/releases/tag/$tag" -ForegroundColor Green
	Write-Host "========================================" -ForegroundColor Green
} finally {
	Pop-Location
}
