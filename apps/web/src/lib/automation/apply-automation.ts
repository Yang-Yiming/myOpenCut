import type { AutomationMarker, AutomationState } from "@/types/automation";

/**
 * Get active automation states at a given time for a specific element
 */
export function getActiveAutomationForElement(
	trackId: string,
	elementId: string,
	time: number,
	markers: AutomationMarker[],
	states: AutomationState[],
): AutomationState[] {
	const activeStates: AutomationState[] = [];

	for (const marker of markers) {
		if (
			marker.type === "range" &&
			marker.trackId === trackId &&
			marker.elementId === elementId
		) {
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
	elementId: string,
	time: number,
	baseVolume: number,
	markers: AutomationMarker[],
	states: AutomationState[],
): number {
	// Get automation from range markers (element-specific)
	const elementAutomation = getActiveAutomationForElement(
		trackId,
		elementId,
		time,
		markers,
		states,
	);

	// Get automation from point markers (timeline-wide)
	const timeAutomation = getActiveAutomationAtTime(time, markers, states);

	// Combine all active automation (element automation takes precedence)
	const allAutomation = [...elementAutomation, ...timeAutomation];

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
