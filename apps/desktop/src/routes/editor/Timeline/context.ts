import {
	createElementBounds,
	type NullableBounds,
} from "@solid-primitives/bounds";
import { createContextProvider } from "@solid-primitives/context";
import { type Accessor, createMemo } from "solid-js";
import { createStore } from "solid-js/store";

import { useEditorContext } from "../context";

export const MAX_TIMELINE_MARKINGS = 20;
const TIMELINE_MARKING_RESOLUTIONS = [0.5, 1, 2.5, 5, 10, 30];

const SEGMENT_RENDER_PADDING = 2;

const SNAP_THRESHOLD_PX = 8;

type TimelineContextValue = {
	duration: Accessor<number>;
	secsPerPixel: Accessor<number>;
	timelineBounds: Readonly<NullableBounds>;
	markingResolution: Accessor<number>;
	visibleTimeRange: Accessor<{ start: number; end: number }>;
	isSegmentVisible(segmentStart: number, segmentEnd: number): boolean;
	snapTime(time: number, exclude?: { start?: number; end?: number }): number;
};

type TrackContextValue = {
	secsPerPixel: Accessor<number>;
	trackBounds: Readonly<NullableBounds>;
	trackState: {
		draggingSegment: boolean;
	};
	setTrackState: ReturnType<
		typeof createStore<{ draggingSegment: boolean }>
	>[1];
};

type SegmentContextValue = {
	width: Accessor<number>;
};

export const [TimelineContextProvider, useTimelineContext] =
	createContextProvider(
		(props: {
			duration: number;
			secsPerPixel: number;
			timelineBounds: Readonly<NullableBounds>;
		}) => {
			const { editorState: state } = useEditorContext();

			const markingResolution = createMemo(
				() =>
					TIMELINE_MARKING_RESOLUTIONS.find(
						(r) => state.timeline.transform.zoom / r <= MAX_TIMELINE_MARKINGS,
					) ?? 30,
			);

			const visibleTimeRange = createMemo(() => {
				const { transform } = state.timeline;
				const start = transform.position - SEGMENT_RENDER_PADDING;
				const end =
					transform.position + transform.zoom + SEGMENT_RENDER_PADDING;
				return { start: Math.max(0, start), end };
			});

			const isSegmentVisible = (segmentStart: number, segmentEnd: number) => {
				const range = visibleTimeRange();
				return segmentEnd >= range.start && segmentStart <= range.end;
			};

			const { project } = useEditorContext();

			const snapTime = (
				time: number,
				exclude?: { start?: number; end?: number },
			): number => {
				if (!state.timeline.snap) return time;

				const spp = props.secsPerPixel;
				const threshold = SNAP_THRESHOLD_PX * spp;
				const edges: number[] = [0, props.duration];

				const playhead = state.playbackTime;
				edges.push(playhead);
				if (state.previewTime != null) edges.push(state.previewTime);

				let clipCursor = 0;
				for (const seg of project.timeline?.segments ?? []) {
					edges.push(clipCursor);
					clipCursor += (seg.end - seg.start) / seg.timescale;
					edges.push(clipCursor);
				}
				for (const seg of project.timeline?.zoomSegments ?? [])
					edges.push(seg.start, seg.end);
				for (const seg of project.timeline?.textSegments ?? [])
					edges.push(seg.start, seg.end);
				for (const seg of project.timeline?.maskSegments ?? [])
					edges.push(seg.start, seg.end);
				for (const seg of project.timeline?.captionSegments ?? [])
					edges.push(seg.start, seg.end);
				for (const seg of project.timeline?.keyboardSegments ?? [])
					edges.push(seg.start, seg.end);
				for (const seg of project.timeline?.bgmSegments ?? [])
					edges.push(seg.start, seg.end);

				let best = time;
				let bestDist = threshold;
				for (const edge of edges) {
					if (
						exclude &&
						((exclude.start != null && Math.abs(edge - exclude.start) < 1e-6) ||
							(exclude.end != null && Math.abs(edge - exclude.end) < 1e-6))
					)
						continue;
					const dist = Math.abs(edge - time);
					if (dist < bestDist) {
						bestDist = dist;
						best = edge;
					}
				}
				return best;
			};

			return {
				duration: () => props.duration,
				secsPerPixel: () => props.secsPerPixel,
				timelineBounds: props.timelineBounds,
				markingResolution,
				visibleTimeRange,
				isSegmentVisible,
				snapTime,
			};
		},
		null as unknown as TimelineContextValue,
	);

export const [TrackContextProvider, useTrackContext] = createContextProvider(
	(props: { ref: Accessor<Element | undefined> }) => {
		const { editorState: state } = useEditorContext();

		const [trackState, setTrackState] = createStore({
			draggingSegment: false,
		});
		const bounds = createElementBounds(() => props.ref());

		const secsPerPixel = () =>
			state.timeline.transform.zoom / (bounds.width ?? 1);

		return {
			secsPerPixel,
			trackBounds: bounds,
			trackState,
			setTrackState,
		};
	},
	null as unknown as TrackContextValue,
);

export const [SegmentContextProvider, useSegmentContext] =
	createContextProvider(
		(props: { width: Accessor<number> }) => {
			return props;
		},
		null as unknown as SegmentContextValue,
	);
