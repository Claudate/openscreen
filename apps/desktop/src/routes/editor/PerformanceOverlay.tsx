import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import {
	createEffect,
	createMemo,
	createSignal,
	on,
	onCleanup,
	Show,
} from "solid-js";
import toast from "solid-toast";
import { t } from "~/i18n";
import { useEditorContext } from "./context";

type PerformanceOverlayProps = {
	size: { width: number; height: number };
};

type FrameStats = {
	fps: number;
	avgFrameMs: number;
	minFrameMs: number;
	maxFrameMs: number;
	jitter: number;
	droppedFrames: number;
	totalFrames: number;
};

const STATS_WINDOW_MS = 1000;
const MAX_TIMESTAMPS = 120;

class RingBuffer {
	private buf: Float64Array;
	private head = 0;
	private _count = 0;

	constructor(private capacity: number) {
		this.buf = new Float64Array(capacity);
	}

	push(value: number) {
		const idx = (this.head + this._count) % this.capacity;
		this.buf[idx] = value;
		if (this._count < this.capacity) {
			this._count++;
		} else {
			this.head = (this.head + 1) % this.capacity;
		}
	}

	get(i: number): number {
		return this.buf[(this.head + i) % this.capacity];
	}

	oldest(): number | undefined {
		return this._count > 0 ? this.buf[this.head] : undefined;
	}

	get count(): number {
		return this._count;
	}

	forEach(fn: (value: number) => void) {
		for (let i = 0; i < this._count; i++) {
			fn(this.buf[(this.head + i) % this.capacity]);
		}
	}

	clear() {
		this.head = 0;
		this._count = 0;
	}
}

export function PerformanceOverlay(_props: PerformanceOverlayProps) {
	const { performanceMode, latestFrame, editorState } = useEditorContext();

	const frameTimestamps = new RingBuffer(MAX_TIMESTAMPS);
	let lastFrameTime = 0;
	const frameIntervals = new RingBuffer(MAX_TIMESTAMPS);
	let droppedFrameCount = 0;
	let totalFrameCount = 0;

	const [stats, setStats] = createSignal<FrameStats>({
		fps: 0,
		avgFrameMs: 0,
		minFrameMs: 0,
		maxFrameMs: 0,
		jitter: 0,
		droppedFrames: 0,
		totalFrames: 0,
	});

	const calculateStats = (): FrameStats => {
		const now = performance.now();

		let windowStart = 0;
		for (let i = 0; i < frameTimestamps.count; i++) {
			if (now - frameTimestamps.get(i) <= STATS_WINDOW_MS) break;
			windowStart = i + 1;
		}
		const windowCount = frameTimestamps.count - windowStart;

		if (windowCount < 2) {
			return {
				fps: 0,
				avgFrameMs: 0,
				minFrameMs: 0,
				maxFrameMs: 0,
				jitter: 0,
				droppedFrames: droppedFrameCount,
				totalFrames: totalFrameCount,
			};
		}

		const windowMs = now - frameTimestamps.get(windowStart);
		const fps = windowMs > 0 ? ((windowCount - 1) / windowMs) * 1000 : 0;

		let sum = 0;
		let minFrameMs = Number.MAX_VALUE;
		let maxFrameMs = 0;
		let intervalCount = 0;

		frameIntervals.forEach((interval) => {
			sum += interval;
			minFrameMs = Math.min(minFrameMs, interval);
			maxFrameMs = Math.max(maxFrameMs, interval);
			intervalCount++;
		});

		const avgFrameMs = intervalCount > 0 ? sum / intervalCount : 0;

		let jitter = 0;
		if (intervalCount > 1) {
			let varianceSum = 0;
			frameIntervals.forEach((interval) => {
				varianceSum += (interval - avgFrameMs) ** 2;
			});
			jitter = Math.sqrt(varianceSum / intervalCount);
		}

		return {
			fps,
			avgFrameMs,
			minFrameMs: minFrameMs === Number.MAX_VALUE ? 0 : minFrameMs,
			maxFrameMs,
			jitter,
			droppedFrames: droppedFrameCount,
			totalFrames: totalFrameCount,
		};
	};

	createEffect(
		on(
			() => latestFrame(),
			() => {
				if (!performanceMode()) return;

				const now = performance.now();
				totalFrameCount++;

				if (lastFrameTime > 0) {
					const interval = now - lastFrameTime;
					frameIntervals.push(interval);
					frameTimestamps.push(now);

					const expectedInterval = 1000 / 60;
					if (interval > expectedInterval * 1.8) {
						const missedFrames = Math.floor(interval / expectedInterval) - 1;
						droppedFrameCount += missedFrames;
					}
				} else {
					frameTimestamps.push(now);
				}

				lastFrameTime = now;
				setStats(calculateStats());
			},
		),
	);

	const resetStats = () => {
		frameTimestamps.clear();
		frameIntervals.clear();
		lastFrameTime = 0;
		droppedFrameCount = 0;
		totalFrameCount = 0;
		setStats({
			fps: 0,
			avgFrameMs: 0,
			minFrameMs: 0,
			maxFrameMs: 0,
			jitter: 0,
			droppedFrames: 0,
			totalFrames: 0,
		});
	};

	createEffect(() => {
		if (!performanceMode()) {
			resetStats();
		}
	});

	onCleanup(() => {
		resetStats();
	});

	const formatFps = (fps: number) => fps.toFixed(1);
	const formatMs = (ms: number) => ms.toFixed(2);

	const copyStatsToClipboard = async () => {
		const s = stats();
		const statsText = [
			`FPS: ${formatFps(s.fps)}`,
			`${t("editor.misc.perfFrame")} ${formatMs(s.avgFrameMs)}ms ${t("editor.misc.perfAvg")}`,
			`${t("editor.misc.perfRange")} ${formatMs(s.minFrameMs)} - ${formatMs(s.maxFrameMs)}ms`,
			`${t("editor.misc.perfJitter")} ±${formatMs(s.jitter)}ms`,
			s.droppedFrames > 0
				? t("editor.misc.perfDropped", {
						dropped: String(s.droppedFrames),
						total: String(s.totalFrames),
					})
				: null,
			t("editor.misc.perfPlaying", {
				value: editorState.playing
					? t("editor.misc.perfPlayingYes")
					: t("editor.misc.perfPlayingNo"),
			}),
		]
			.filter(Boolean)
			.join("\n");

		await writeText(statsText);
		toast.success(t("editor.misc.perfStatsCopied"));
	};

	const fpsColor = createMemo(() => {
		const fps = stats().fps;
		if (fps >= 55) return "#4ade80";
		if (fps >= 45) return "#a3e635";
		if (fps >= 30) return "#fbbf24";
		if (fps >= 15) return "#fb923c";
		return "#f87171";
	});

	const jitterColor = createMemo(() => {
		const jitter = stats().jitter;
		if (jitter < 2) return "#4ade80";
		if (jitter < 5) return "#a3e635";
		if (jitter < 10) return "#fbbf24";
		return "#f87171";
	});

	return (
		<Show when={performanceMode()}>
			<div
				class="absolute top-2 left-2 z-50 pointer-events-none select-none"
				style={{
					"font-family":
						"ui-monospace, 'SF Mono', Monaco, 'Cascadia Mono', 'Segoe UI Mono', 'Roboto Mono', Menlo, monospace",
					"font-size": "10px",
					"line-height": "1.4",
					"font-variant-numeric": "tabular-nums",
				}}
			>
				<div
					class="rounded-md px-2 py-1.5 shadow-lg backdrop-blur-xs pointer-events-auto cursor-pointer hover:brightness-110 transition-[filter]"
					style={{
						"background-color": "rgba(0, 0, 0, 0.8)",
						border: "1px solid rgba(255, 255, 255, 0.15)",
					}}
					onClick={copyStatsToClipboard}
					title={t("editor.misc.copyStats")}
				>
					<div class="flex flex-col gap-0.5">
						<div class="flex items-center gap-2">
							<span class="font-bold" style={{ color: fpsColor() }}>
								{formatFps(stats().fps)} FPS
							</span>
							<Show when={editorState.playing}>
								<span style={{ color: "#4ade80" }}>▶</span>
							</Show>
						</div>
						<div style={{ color: "rgba(255, 255, 255, 0.7)" }}>
							<span>{t("editor.misc.perfFrame")} </span>
							<span style={{ color: "#93c5fd" }}>
								{formatMs(stats().avgFrameMs)}ms
							</span>
							<span style={{ color: "rgba(255, 255, 255, 0.4)" }}>
								{" "}
								{t("editor.misc.perfAvg")}
							</span>
						</div>
						<div style={{ color: "rgba(255, 255, 255, 0.7)" }}>
							<span>{t("editor.misc.perfRange")} </span>
							<span style={{ color: "#86efac" }}>
								{formatMs(stats().minFrameMs)}
							</span>
							<span style={{ color: "rgba(255, 255, 255, 0.3)" }}> - </span>
							<span style={{ color: "#fca5a5" }}>
								{formatMs(stats().maxFrameMs)}ms
							</span>
						</div>
						<div style={{ color: "rgba(255, 255, 255, 0.7)" }}>
							<span>{t("editor.misc.perfJitter")} </span>
							<span style={{ color: jitterColor() }}>
								±{formatMs(stats().jitter)}ms
							</span>
						</div>
						<Show when={stats().droppedFrames > 0}>
							<div style={{ color: "#f87171" }}>
								{t("editor.misc.perfDropped", {
									dropped: String(stats().droppedFrames),
									total: String(stats().totalFrames),
								})}
							</div>
						</Show>
					</div>
				</div>
			</div>
		</Show>
	);
}
