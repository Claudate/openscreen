// @ts-check

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");

const RUNTIME_DLLS = [
	"avcodec-61.dll",
	"avdevice-61.dll",
	"avfilter-10.dll",
	"avformat-61.dll",
	"avutil-59.dll",
	"postproc-58.dll",
	"swresample-5.dll",
	"swscale-8.dll",
	"DirectML.dll",
];

async function fileExists(filePath) {
	return fs
		.access(filePath)
		.then(() => true)
		.catch(() => false);
}

async function resolveReleaseDir() {
	const triple =
		process.env.TAURI_ENV_TARGET_TRIPLE ?? process.env.RUST_TARGET_TRIPLE;
	const candidates = [
		triple ? path.join(repoRoot, "target", triple, "release") : null,
		path.join(repoRoot, "target", "release"),
	].filter(Boolean);

	for (const candidate of candidates) {
		if (await fileExists(candidate)) return candidate;
	}

	throw new Error(
		`Windows release dir not found. Checked: ${candidates.join(", ")}. Run cap-setup and tauri build first.`,
	);
}

async function main() {
	if (process.platform !== "win32") {
		console.log("stage-windows-bundle-runtime: skip (not win32)");
		return;
	}

	const releaseDir = await resolveReleaseDir();
	const stageDir = path.join(
		repoRoot,
		"apps/desktop/src-tauri/windows-runtime",
	);
	await fs.mkdir(stageDir, { recursive: true });

	for (const dll of RUNTIME_DLLS) {
		const source = path.join(releaseDir, dll);
		if (!(await fileExists(source))) {
			throw new Error(`Missing runtime DLL for bundling: ${source}`);
		}
		await fs.copyFile(source, path.join(stageDir, dll));
	}

	for (const dll of RUNTIME_DLLS) {
		await fs.copyFile(path.join(stageDir, dll), path.join(releaseDir, dll));
	}

	console.log(
		`Staged ${RUNTIME_DLLS.length} runtime DLLs from ${releaseDir} -> ${stageDir}`,
	);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
