// Oneshot audio source types
export type OneshotAudioSource =
	| { type: "library"; soundId: number; url: string; name: string }
	| { type: "upload"; fileId: string; url: string; name: string };

// Oneshot Definition - defines an audio snippet with trim points and cue point
export interface OneshotDefinition {
	id: string;
	name: string;
	color: string;
	audioSource: OneshotAudioSource;
	trimStart: number; // Start of audio slice (seconds)
	trimEnd: number; // End of audio slice (seconds)
	cuePoint: number; // Sync point within slice (seconds from trimStart)
	audioDuration: number; // Total duration of source audio
	createdAt: number;
	updatedAt: number;
}

// Oneshot Marker - a point on the timeline where a oneshot triggers
export interface OneshotMarker {
	id: string;
	oneshotId: string; // Reference to OneshotDefinition
	time: number; // Timeline position where cuePoint aligns
	volume?: number; // Optional per-marker volume (0-1), defaults to 1
	createdAt: number;
}

// Input types for creating/updating
export type CreateOneshotInput = Omit<
	OneshotDefinition,
	"id" | "createdAt" | "updatedAt"
>;

export type UpdateOneshotInput = Partial<
	Omit<OneshotDefinition, "id" | "createdAt" | "updatedAt">
>;

export type CreateOneshotMarkerInput = Omit<OneshotMarker, "id" | "createdAt">;
