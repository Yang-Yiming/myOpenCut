import type { AutomationMarker, AutomationState } from "@/types/automation";

export interface ElementTimeRange {
	trackId: string;
	elementId: string;
	startTime: number;
	endTime: number;
}

/**
 * Get active automation states at a given time from range markers
 * Range markers activate their state during the time range of the element they're attached to
 */
export function getActiveAutomationFromRangeMarkers(
	time: number,
	markers: AutomationMarker[],
	states: AutomationState[],
	elementTimeRanges: ElementTimeRange[],
): AutomationState[] {
	const activeStates: AutomationState[] = [];

	for (const marker of markers) {
		if (marker.type !== "range") continue;

		// Find the time range of the element this marker is attached to
		const elementRange = elementTimeRanges.find(
			(e) => e.trackId === marker.trackId && e.elementId === marker.elementId,
		);
		if (!elementRange) continue;

		// Check if current time is within the element's time range
		if (time >= elementRange.startTime && time < elementRange.endTime) {
			const state = states.find((s) => s.id === marker.stateId);
			if (state) activeStates.push(state);
		}
	}

	return activeStates;
}

/**
 * Get active automation states at a given time (from point markers)
 */
export function getActiveAutomationAtTime(
	time: number,
	markers: AutomationMarker[],
	states: AutomationState[],
): AutomationState[] {
	const activeStates: AutomationState[] = [];

	// Find all point markers before or at current time
	const activePointMarkers = markers
		.filter((m) => m.type === "point" && m.time <= time)
		.sort((a, b) => {
			if (a.type === "point" && b.type === "point") {
				return b.time - a.time; // Most recent first
			}
			return 0;
		});

	// Collect unique states (later markers override earlier ones)
	const seenStates = new Set<string>();
	for (const marker of activePointMarkers) {
		if (!seenStates.has(marker.stateId)) {
			const state = states.find((s) => s.id === marker.stateId);
			if (state) {
				activeStates.push(state);
				seenStates.add(marker.stateId);
			}
		}
	}

	return activeStates;
}

/**
 * Calculate effective volume for an audio track considering automation
 */
export function getEffectiveVolume(
	trackId: string,
	_elementId: string,
	time: number,
	baseVolume: number,
	markers: AutomationMarker[],
	states: AutomationState[],
	elementTimeRanges: ElementTimeRange[] = [],
): number {
	// Get automation from range markers (time-based, not element-specific)
	const rangeAutomation = getActiveAutomationFromRangeMarkers(
		time,
		markers,
		states,
		elementTimeRanges,
	);

	// Get automation from point markers (timeline-wide)
	const timeAutomation = getActiveAutomationAtTime(time, markers, states);

	// Combine all active automation (range automation takes precedence)
	const allAutomation = [...rangeAutomation, ...timeAutomation];

	// Apply volume operations (last one wins)
	let effectiveVolume = baseVolume;
	for (const state of allAutomation) {
		for (const op of state.operations) {
			if (op.trackId === trackId) {
				effectiveVolume = op.value;
			}
		}
	}

	return effectiveVolume;
}
