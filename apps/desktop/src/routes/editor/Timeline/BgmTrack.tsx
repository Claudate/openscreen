import { createEventListenerMap } from "@solid-primitives/event-listener";
import { cx } from "cva";
import {
	batch,
	createMemo,
	createRoot,
	createSignal,
	Index,
	Show,
} from "solid-js";
import { produce } from "solid-js/store";
import { open } from "@tauri-apps/plugin-dialog";
import toast from "solid-toast";
import { t } from "~/i18n";
import { useEditorContext } from "../context";
import { useTimelineContext, useTrackContext } from "./context";
import {
	SegmentContent,
	SegmentHandle,
	SegmentRoot,
	TrackRoot,
	useSetPreviewTime,
} from "./Track";

export type BgmSegmentDragState =
	| { type: "idle" }
	| { type: "movePending" }
	| { type: "moving" };

export function BgmTrack(props: {
	onDragStateChanged: (v: BgmSegmentDragState) => void;
	handleUpdatePlayhead: (e: MouseEvent) => void;
}) {
	const {
		project,
		setProject,
		setEditorState,
		editorState,
		totalDuration,
	} = useEditorContext();

	const { secsPerPixel } = useTimelineContext();
	const setPreviewTime = useSetPreviewTime();

	const bgmSegments = createMemo(
		() => project.timeline?.bgmSegments ?? [],
	);

	const handleAddBgm = async () => {
		try {
			const selected = await open({
				multiple: false,
				filters: [
					{
						name: "Audio",
						extensions: ["mp3", "wav", "ogg", "flac", "aac", "m4a"],
					},
				],
			});

			if (!selected) return;

			const path = typeof selected === "string" ? selected : selected.path;

			batch(() => {
				setProject("audio", "bgm", {
					path,
					volumeDb: -6.0,
					startOffset: 0.0,
					enabled: true,
					loopPlayback: false,
				});

				setProject(
					"timeline",
					"bgmSegments",
					produce((segments) => {
						if (!segments) return;
						const id = `bgm-${Date.now()}-${Math.random().toString(36).slice(2)}`;
						segments.push({
							id,
							start: 0,
							end: totalDuration(),
							sourceStart: 0,
							volumeDb: -6.0,
							fadeIn: 0.5,
							fadeOut: 0.5,
						});
					}),
				);
			});

			toast.success(t("editor.bgm.added"));
		} catch (error) {
			console.error("Failed to add BGM:", error);
		}
	};

	return (
		<TrackRoot
			class="group cursor-pointer"
			onMouseDown={(e: MouseEvent) => {
				if (e.button !== 0) return;
				if (bgmSegments().length > 0) return;
				createRoot((dispose) => {
					createEventListenerMap(window, {
						mouseup: () => {
							dispose();
							props.handleUpdatePlayhead(e);
						},
					});
				});
			}}
		>
			<Show
				when={bgmSegments().length > 0}
				fallback={
					<button
						type="button"
						class="flex items-center justify-center w-full h-full rounded-lg border border-dashed border-gray-5 hover:border-emerald-7 hover:bg-emerald-3/20 transition-colors text-xs text-gray-9 hover:text-emerald-11 gap-1.5"
						onClick={handleAddBgm}
					>
						<IconLucideMusic class="size-3.5" />
						{t("editor.bgm.addMusic")}
					</button>
				}
			>
				<Index each={bgmSegments()}>
					{(segment, index) => (
						<BgmSegment
							segment={segment()}
							index={index}
							onDragStateChanged={props.onDragStateChanged}
						/>
					)}
				</Index>
			</Show>
		</TrackRoot>
	);
}

function BgmSegment(props: {
	segment: {
		id: string;
		start: number;
		end: number;
		sourceStart: number;
		volumeDb: number;
		fadeIn: number;
		fadeOut: number;
	};
	index: number;
	onDragStateChanged: (v: BgmSegmentDragState) => void;
}) {
	const { setProject, editorState, setEditorState, project } =
		useEditorContext();
	const { secsPerPixel } = useTrackContext();

	const fileName = createMemo(() => {
		const bgm = project.audio.bgm;
		if (!bgm) return t("editor.bgm.untitled");
		const parts = bgm.path.replace(/\\/g, "/").split("/");
		return parts[parts.length - 1] ?? t("editor.bgm.untitled");
	});

	const handleDelete = () => {
		batch(() => {
			setProject(
				"timeline",
				"bgmSegments",
				produce((segments) => {
					if (!segments) return;
					segments.splice(props.index, 1);
				}),
			);
			setProject("audio", "bgm", undefined);
			setEditorState("timeline", "selection", null);
		});
	};

	return (
		<SegmentRoot
			segment={props.segment}
			class="group/segment"
			onClick={(e: MouseEvent) => {
				e.stopPropagation();
				setEditorState("timeline", "selection", {
					type: "bgm" as "clip",
					indices: [props.index],
				});
			}}
		>
			<SegmentContent
				class={cx(
					"rounded-md border transition-colors",
					"bg-emerald-4/60 border-emerald-6 hover:bg-emerald-5/70",
					"dark:bg-emerald-5/30 dark:border-emerald-7 dark:hover:bg-emerald-5/40",
				)}
			>
				<div class="flex items-center gap-1.5 px-2 h-full overflow-hidden">
					<IconLucideMusic class="size-3 text-emerald-11 flex-shrink-0" />
					<span class="text-xs text-emerald-12 truncate font-medium">
						{fileName()}
					</span>
				</div>
			</SegmentContent>
			<SegmentHandle side="left" />
			<SegmentHandle side="right" />
		</SegmentRoot>
	);
}
