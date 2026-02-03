// Automation State (preset)
export interface AutomationState {
	id: string;
	name: string;
	description?: string;
	operations: AudioVolumeOperation[];
	createdAt: Date;
	updatedAt: Date;
}

// Audio volume operation (0-100)
export interface AudioVolumeOperation {
	id: string;
	type: "audio-volume";
	trackId: string; // Which audio track to affect
	value: number; // Volume percentage (0-100)
}

// Automation markers
export type AutomationMarker = RangeMarker | PointMarker;

interface BaseMarker {
	id: string;
	stateId: string;
	createdAt: Date;
}

// Range marker: applied to specific clip
export interface RangeMarker extends BaseMarker {
	type: "range";
	trackId: string;
	elementId: string;
}

// Point marker: applied at timeline position
export interface PointMarker extends BaseMarker {
	type: "point";
	time: number; // seconds
}
