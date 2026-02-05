import type {
	TimeRemapConfig,
	TrackTimeBehavior,
	TrackRemapConfig,
	MarkerRemapConfig,
} from "@/types/time-remap";
import type { TimelineTrack, TimelineElement } from "@/types/timeline";
import type { AutomationMarker, PointMarker } from "@/types/automation";
import type { OneshotMarker, OneshotDefinition } from "@/types/oneshot";

/**
 * Get the remapped duration based on time scale
 * timeScale 0.5 = half speed = 2x duration
 * timeScale 2.0 = double speed = 0.5x duration
 */
export function getRemappedDuration(
	originalDuration: number,
	timeScale: number,
): number {
	if (timeScale <= 0) return originalDuration;
	return originalDuration / timeScale;
}

/**
 * Remap a time point based on time scale
 */
export function remapTime(time: number, timeScale: number): number {
	if (timeScale <= 0) return time;
	return time / timeScale;
}

/**
 * Get track behavior from config
 */
export function getTrackBehavior(
	trackId: string,
	config: TimeRemapConfig,
): TrackTimeBehavior {
	const trackConfig = config.trackConfigs.find((tc) => tc.trackId === trackId);
	return trackConfig?.behavior ?? "stretch";
}

/**
 * Remap a timeline element based on track behavior
 */
export function remapTimelineElement<T extends TimelineElement>(
	element: T,
	timeScale: number,
	behavior: TrackTimeBehavior,
): T {
	if (behavior === "stretch") {
		// Element timing scales with timeScale
		return {
			...element,
			startTime: remapTime(element.startTime, timeScale),
			duration: remapTime(element.duration, timeScale),
			// trimStart and trimEnd stay the same (they're relative to source)
		};
	}

	// For loop and fixed behaviors, element starts at remapped time
	// but duration handling differs
	return {
		...element,
		startTime: remapTime(element.startTime, timeScale),
		// Duration stays original for loop/fixed - audio mixing handles the rest
	};
}

/**
 * Remap automation point marker
 */
export function remapAutomationPointMarker(
	marker: PointMarker,
	config: MarkerRemapConfig,
	timeScale: number,
): PointMarker {
	const newTime =
		config.triggerBehavior === "stretch"
			? remapTime(marker.time, timeScale)
			: marker.time;

	return {
		...marker,
		time: newTime,
	};
}

/**
 * Remap automation markers (only point markers have time)
 */
export function remapAutomationMarkers(
	markers: AutomationMarker[],
	config: MarkerRemapConfig,
	timeScale: number,
): AutomationMarker[] {
	return markers.map((marker) => {
		if (marker.type === "point") {
			return remapAutomationPointMarker(marker, config, timeScale);
		}
		// Range markers are tied to elements, no time remapping needed
		return marker;
	});
}

/**
 * Remap oneshot marker
 */
export function remapOneshotMarker(
	marker: OneshotMarker,
	config: MarkerRemapConfig,
	timeScale: number,
): OneshotMarker {
	const newTime =
		config.triggerBehavior === "stretch"
			? remapTime(marker.time, timeScale)
			: marker.time;

	return {
		...marker,
		time: newTime,
	};
}

/**
 * Remap all oneshot markers
 */
export function remapOneshotMarkers(
	markers: OneshotMarker[],
	config: MarkerRemapConfig,
	timeScale: number,
): OneshotMarker[] {
	return markers.map((marker) => remapOneshotMarker(marker, config, timeScale));
}

/**
 * Calculate oneshot audio timing with remap config
 */
export interface OneshotAudioTiming {
	startTime: number; // When audio starts in timeline
	playbackRate: number; // Playback speed multiplier
	trimStart: number;
	trimEnd: number;
	cuePoint: number;
}

export function calculateOneshotAudioTiming(
	marker: OneshotMarker,
	definition: OneshotDefinition,
	config: MarkerRemapConfig,
	timeScale: number,
): OneshotAudioTiming {
	// Calculate trigger time
	const triggerTime =
		config.triggerBehavior === "stretch"
			? remapTime(marker.time, timeScale)
			: marker.time;

	// Calculate playback rate
	const playbackRate =
		config.playbackBehavior === "stretch" ? timeScale : 1.0;

	// Audio starts before trigger time by cuePoint amount (adjusted for playback rate)
	const audioStartTime = triggerTime - definition.cuePoint / playbackRate;

	return {
		startTime: Math.max(0, audioStartTime),
		playbackRate,
		trimStart: definition.trimStart,
		trimEnd: definition.trimEnd,
		cuePoint: definition.cuePoint,
	};
}

/**
 * Remap all tracks based on config
 */
export function remapTracks(
	tracks: TimelineTrack[],
	config: TimeRemapConfig,
): TimelineTrack[] {
	return tracks.map((track) => {
		const behavior = getTrackBehavior(track.id, config);

		const remappedElements = track.elements.map((element) =>
			remapTimelineElement(element, config.timeScale, behavior),
		);

		return {
			...track,
			elements: remappedElements,
		} as TimelineTrack;
	});
}

/**
 * Build track config map for quick lookup
 */
export function buildTrackConfigMap(
	config: TimeRemapConfig,
): Map<string, TrackRemapConfig> {
	return new Map(config.trackConfigs.map((tc) => [tc.trackId, tc]));
}
