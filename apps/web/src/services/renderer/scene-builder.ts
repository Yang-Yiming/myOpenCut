import type { TimelineTrack } from "@/types/timeline";
import type { MediaAsset } from "@/types/assets";
import type { TimeRemapConfig } from "@/types/time-remap";
import { RootNode } from "./nodes/root-node";
import { VideoNode } from "./nodes/video-node";
import { ImageNode } from "./nodes/image-node";
import { TextNode } from "./nodes/text-node";
import { StickerNode } from "./nodes/sticker-node";
import { ColorNode } from "./nodes/color-node";
import { BlurBackgroundNode } from "./nodes/blur-background-node";
import type { TBackground, TCanvasSize } from "@/types/project";
import { DEFAULT_BLUR_INTENSITY } from "@/constants/project-constants";
import { isMainTrack } from "@/lib/timeline";
import { getTrackBehavior, remapTime } from "@/lib/time-remap";

export type BuildSceneParams = {
	canvasSize: TCanvasSize;
	tracks: TimelineTrack[];
	mediaAssets: MediaAsset[];
	duration: number;
	background: TBackground;
	timeRemapConfig?: TimeRemapConfig;
};

export function buildScene(params: BuildSceneParams) {
	const { tracks, mediaAssets, duration, canvasSize, background, timeRemapConfig } = params;

	const rootNode = new RootNode({ duration });
	const mediaMap = new Map(mediaAssets.map((m) => [m.id, m]));

	const visibleTracks = tracks.filter(
		(track) => !("hidden" in track && track.hidden),
	);

	const mainTrack = visibleTracks.find((track) => isMainTrack(track)) ?? null;
	const orderedTracksTopToBottom = [
		...visibleTracks.filter((track) => !isMainTrack(track)),
		...(mainTrack ? [mainTrack] : []),
	];

	const orderedTracksBottomToTop = orderedTracksTopToBottom.slice().reverse();

	const contentNodes = [];

	for (const track of orderedTracksBottomToTop) {
		// Get track behavior for time remapping
		const trackBehavior = timeRemapConfig
			? getTrackBehavior(track.id, timeRemapConfig)
			: "stretch";
		const timeScale = timeRemapConfig?.timeScale ?? 1;

		const elements = track.elements
			.filter((element) => !("hidden" in element && element.hidden))
			.slice()
			.sort((a, b) => {
				if (a.startTime !== b.startTime) return a.startTime - b.startTime;
				return a.id.localeCompare(b.id);
			});

		for (const element of elements) {
			// Calculate remapped timing based on track behavior
			const elementStartTime = timeRemapConfig
				? remapTime(element.startTime, timeScale)
				: element.startTime;
			const elementDuration = trackBehavior === "stretch" && timeRemapConfig
				? remapTime(element.duration, timeScale)
				: element.duration;

			if (element.type === "video" || element.type === "image") {
				const mediaAsset = mediaMap.get(element.mediaId);
				if (!mediaAsset?.file) {
					continue;
				}

				if (mediaAsset.type === "video") {
					contentNodes.push(
						new VideoNode({
							mediaId: mediaAsset.id,
							file: mediaAsset.file,
							duration: elementDuration,
							timeOffset: elementStartTime,
							trimStart: element.trimStart,
							trimEnd: element.trimEnd,
						}),
					);
				}
				if (mediaAsset.type === "image") {
					contentNodes.push(
						new ImageNode({
							file: mediaAsset.file,
							duration: elementDuration,
							timeOffset: elementStartTime,
							trimStart: element.trimStart,
							trimEnd: element.trimEnd,
						}),
					);
				}
			}

			if (element.type === "text") {
				contentNodes.push(
					new TextNode({
						...element,
						startTime: elementStartTime,
						duration: elementDuration,
						canvasCenter: { x: canvasSize.width / 2, y: canvasSize.height / 2 },
						textBaseline: "middle",
					}),
				);
			}

			if (element.type === "sticker") {
				contentNodes.push(
					new StickerNode({
						iconName: element.iconName,
						duration: elementDuration,
						timeOffset: elementStartTime,
						trimStart: element.trimStart,
						trimEnd: element.trimEnd,
						transform: element.transform,
						opacity: element.opacity,
						color: element.color,
					}),
				);
			}
		}
	}

	if (background.type === "blur") {
		rootNode.add(
			new BlurBackgroundNode({
				blurIntensity: background.blurIntensity ?? DEFAULT_BLUR_INTENSITY,
				contentNodes,
			}),
		);
		for (const node of contentNodes) {
			rootNode.add(node);
		}
	} else {
		if (background.type === "color" && background.color !== "transparent") {
			rootNode.add(new ColorNode({ color: background.color }));
		}
		for (const node of contentNodes) {
			rootNode.add(node);
		}
	}

	return rootNode;
}
