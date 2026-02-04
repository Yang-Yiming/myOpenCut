import type { EditorCore } from "..";
import type {
	AutomationMarker,
	AutomationState,
	AudioVolumeOperation,
	PointMarker,
	RangeMarker,
} from "@/types/automation";
import { nanoid } from "nanoid";
import { getEffectiveVolume } from "@/lib/automation/apply-automation";

export class AutomationManager {
	private listeners = new Set<() => void>();

	constructor(private editor: EditorCore) {}

	// ---- State CRUD ----

	createState(
		data: Omit<AutomationState, "id" | "createdAt" | "updatedAt">,
	): string {
		const stateId = nanoid();
		const now = new Date();

		const newState: AutomationState = {
			id: stateId,
			...data,
			createdAt: now,
			updatedAt: now,
		};

		const currentScene = this.editor.scenes.getActiveScene();
		if (!currentScene) {
			throw new Error("No active scene");
		}

		const updatedScene = {
			...currentScene,
			automationStates: [...(currentScene.automationStates || []), newState],
		};

		this.editor.scenes.updateScene(currentScene.id, updatedScene);
		this.notify();

		return stateId;
	}

	updateState(
		stateId: string,
		updates: Partial<Omit<AutomationState, "id" | "createdAt">>,
	): void {
		const currentScene = this.editor.scenes.getActiveScene();
		if (!currentScene) {
			throw new Error("No active scene");
		}

		const states = currentScene.automationStates || [];
		const stateIndex = states.findIndex((s) => s.id === stateId);

		if (stateIndex === -1) {
			throw new Error(`Automation state ${stateId} not found`);
		}

		const updatedStates = [...states];
		updatedStates[stateIndex] = {
			...updatedStates[stateIndex],
			...updates,
			updatedAt: new Date(),
		};

		const updatedScene = {
			...currentScene,
			automationStates: updatedStates,
		};

		this.editor.scenes.updateScene(currentScene.id, updatedScene);
		this.notify();
	}

	deleteState(stateId: string): void {
		const currentScene = this.editor.scenes.getActiveScene();
		if (!currentScene) {
			throw new Error("No active scene");
		}

		// Remove the state
		const updatedStates = (currentScene.automationStates || []).filter(
			(s) => s.id !== stateId,
		);

		// Remove all markers associated with this state
		const updatedMarkers = (currentScene.automationMarkers || []).filter(
			(m) => m.stateId !== stateId,
		);

		const updatedScene = {
			...currentScene,
			automationStates: updatedStates,
			automationMarkers: updatedMarkers,
		};

		this.editor.scenes.updateScene(currentScene.id, updatedScene);
		this.notify();
	}

	getStates(): AutomationState[] {
		const currentScene = this.editor.scenes.getActiveScene();
		return currentScene?.automationStates || [];
	}

	getState(stateId: string): AutomationState | undefined {
		const states = this.getStates();
		return states.find((s) => s.id === stateId);
	}

	// ---- Marker CRUD ----

	addRangeMarker(
		stateId: string,
		trackId: string,
		elementId: string,
	): string {
		const markerId = nanoid();
		const now = new Date();

		const newMarker: RangeMarker = {
			id: markerId,
			type: "range",
			stateId,
			trackId,
			elementId,
			createdAt: now,
		};

		const currentScene = this.editor.scenes.getActiveScene();
		if (!currentScene) {
			throw new Error("No active scene");
		}

		const updatedScene = {
			...currentScene,
			automationMarkers: [...(currentScene.automationMarkers || []), newMarker],
		};

		this.editor.scenes.updateScene(currentScene.id, updatedScene);
		this.notify();

		return markerId;
	}

	addPointMarker(stateId: string, time: number): string {
		const markerId = nanoid();
		const now = new Date();

		const newMarker: PointMarker = {
			id: markerId,
			type: "point",
			stateId,
			time,
			createdAt: now,
		};

		const currentScene = this.editor.scenes.getActiveScene();
		if (!currentScene) {
			throw new Error("No active scene");
		}

		const updatedScene = {
			...currentScene,
			automationMarkers: [...(currentScene.automationMarkers || []), newMarker],
		};

		this.editor.scenes.updateScene(currentScene.id, updatedScene);
		this.notify();

		return markerId;
	}

	removeMarker(markerId: string): void {
		const currentScene = this.editor.scenes.getActiveScene();
		if (!currentScene) {
			throw new Error("No active scene");
		}

		const updatedMarkers = (currentScene.automationMarkers || []).filter(
			(m) => m.id !== markerId,
		);

		const updatedScene = {
			...currentScene,
			automationMarkers: updatedMarkers,
		};

		this.editor.scenes.updateScene(currentScene.id, updatedScene);
		this.notify();
	}

	getMarkers(): AutomationMarker[] {
		const currentScene = this.editor.scenes.getActiveScene();
		return currentScene?.automationMarkers || [];
	}

	getMarkersForElement(
		trackId: string,
		elementId: string,
	): AutomationMarker[] {
		const markers = this.getMarkers();
		return markers.filter(
			(m) =>
				m.type === "range" && m.trackId === trackId && m.elementId === elementId,
		);
	}

	getActiveMarkersAtTime(time: number): AutomationMarker[] {
		const markers = this.getMarkers();
		const activeMarkers: AutomationMarker[] = [];

		for (const marker of markers) {
			if (marker.type === "point" && marker.time <= time) {
				activeMarkers.push(marker);
			} else if (marker.type === "range") {
				// Check if the element at this time is active
				const track = this.editor.timeline.getTrackById({ trackId: marker.trackId });
				if (!track) continue;

				const element = track.elements.find((e) => e.id === marker.elementId);
				if (!element) continue;

				const elementStart = element.startTime;
				const elementEnd = element.startTime + element.duration;

				if (time >= elementStart && time <= elementEnd) {
					activeMarkers.push(marker);
				}
			}
		}

		return activeMarkers;
	}

	// ---- Effect application ----

	getEffectiveVolumeForTrack(
		trackId: string,
		elementId: string,
		time: number,
		baseVolume: number,
	): number {
		const markers = this.getMarkers();
		const states = this.getStates();

		return getEffectiveVolume(
			trackId,
			elementId,
			time,
			baseVolume,
			markers,
			states,
		);
	}

	// ---- Observer pattern ----

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	private notify(): void {
		for (const listener of this.listeners) {
			listener();
		}
	}
}
