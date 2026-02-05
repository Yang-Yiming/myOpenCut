// Track time behavior for time remapping export
export type TrackTimeBehavior = "stretch" | "loop" | "fixed";
// stretch: Follow time scaling (video becomes slower/faster)
// loop: Keep original speed, loop to fill new duration
// fixed: Keep original speed, play once (no loop)

// Marker trigger behavior
export type MarkerTriggerBehavior = "stretch" | "original";
// stretch: Trigger time scales with timeScale
// original: Trigger at original time

// Marker playback behavior
export type MarkerPlaybackBehavior = "stretch" | "original";
// stretch: Playback speed scales with timeScale
// original: Playback at original speed

// Single track configuration
export interface TrackRemapConfig {
	trackId: string;
	behavior: TrackTimeBehavior;
}

// Marker configuration
export interface MarkerRemapConfig {
	triggerBehavior: MarkerTriggerBehavior;
	playbackBehavior: MarkerPlaybackBehavior;
}

// Complete time remap configuration
export interface TimeRemapConfig {
	timeScale: number; // 0.5 = half speed (2x duration), 2.0 = double speed (0.5x duration)
	trackConfigs: TrackRemapConfig[];
	automationMarkerConfig: MarkerRemapConfig;
	oneshotMarkerConfig: MarkerRemapConfig;
}

// Preset for common time remap configurations
export interface TimeRemapPreset {
	id: string;
	name: string;
	description: string;
	config: Omit<TimeRemapConfig, "trackConfigs"> & {
		defaultVideoBehavior: TrackTimeBehavior;
		defaultAudioBehavior: TrackTimeBehavior;
	};
}

// Default presets
export const TIME_REMAP_PRESETS: TimeRemapPreset[] = [
	{
		id: "slow-motion-bgm-loop",
		name: "Slow Motion + BGM Loop",
		description: "Video at 0.5x speed, audio loops to fill duration",
		config: {
			timeScale: 0.5,
			defaultVideoBehavior: "stretch",
			defaultAudioBehavior: "loop",
			automationMarkerConfig: {
				triggerBehavior: "stretch",
				playbackBehavior: "original",
			},
			oneshotMarkerConfig: {
				triggerBehavior: "stretch",
				playbackBehavior: "original",
			},
		},
	},
	{
		id: "slow-motion-all-stretch",
		name: "Slow Motion (All Stretch)",
		description: "Everything slows down together",
		config: {
			timeScale: 0.5,
			defaultVideoBehavior: "stretch",
			defaultAudioBehavior: "stretch",
			automationMarkerConfig: {
				triggerBehavior: "stretch",
				playbackBehavior: "stretch",
			},
			oneshotMarkerConfig: {
				triggerBehavior: "stretch",
				playbackBehavior: "stretch",
			},
		},
	},
	{
		id: "fast-forward",
		name: "Fast Forward (2x)",
		description: "Everything speeds up 2x",
		config: {
			timeScale: 2.0,
			defaultVideoBehavior: "stretch",
			defaultAudioBehavior: "stretch",
			automationMarkerConfig: {
				triggerBehavior: "stretch",
				playbackBehavior: "stretch",
			},
			oneshotMarkerConfig: {
				triggerBehavior: "stretch",
				playbackBehavior: "stretch",
			},
		},
	},
];

// Helper to create default config from preset
export function createConfigFromPreset(
	preset: TimeRemapPreset,
	tracks: { id: string; type: string }[],
): TimeRemapConfig {
	return {
		timeScale: preset.config.timeScale,
		trackConfigs: tracks.map((track) => ({
			trackId: track.id,
			behavior:
				track.type === "video" || track.type === "text" || track.type === "sticker"
					? preset.config.defaultVideoBehavior
					: preset.config.defaultAudioBehavior,
		})),
		automationMarkerConfig: preset.config.automationMarkerConfig,
		oneshotMarkerConfig: preset.config.oneshotMarkerConfig,
	};
}

// Helper to get default time remap config
export function getDefaultTimeRemapConfig(
	tracks: { id: string; type: string }[],
): TimeRemapConfig {
	return createConfigFromPreset(TIME_REMAP_PRESETS[0], tracks);
}
