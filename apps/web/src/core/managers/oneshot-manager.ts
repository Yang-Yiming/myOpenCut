import type { EditorCore } from "..";
import type {
	OneshotDefinition,
	OneshotMarker,
	CreateOneshotInput,
	UpdateOneshotInput,
	CreateOneshotMarkerInput,
} from "@/types/oneshot";
import { nanoid } from "nanoid";

export class OneshotManager {
	private listeners = new Set<() => void>();
	private audioBufferCache = new Map<string, AudioBuffer>();

	constructor(private editor: EditorCore) {}

	// ---- Definition CRUD ----

	createDefinition(data: CreateOneshotInput): string {
		const definitionId = nanoid();
		const now = Date.now();

		const newDefinition: OneshotDefinition = {
			id: definitionId,
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
			oneshotDefinitions: [
				...(currentScene.oneshotDefinitions || []),
				newDefinition,
			],
		};

		this.editor.scenes.updateScene(currentScene.id, updatedScene);
		this.notify();

		return definitionId;
	}

	updateDefinition(definitionId: string, updates: UpdateOneshotInput): void {
		const currentScene = this.editor.scenes.getActiveScene();
		if (!currentScene) {
			throw new Error("No active scene");
		}

		const definitions = currentScene.oneshotDefinitions || [];
		const defIndex = definitions.findIndex((d) => d.id === definitionId);

		if (defIndex === -1) {
			throw new Error(`Oneshot definition ${definitionId} not found`);
		}

		const updatedDefinitions = [...definitions];
		updatedDefinitions[defIndex] = {
			...updatedDefinitions[defIndex],
			...updates,
			updatedAt: Date.now(),
		};

		const updatedScene = {
			...currentScene,
			oneshotDefinitions: updatedDefinitions,
		};

		this.editor.scenes.updateScene(currentScene.id, updatedScene);
		this.notify();
	}

	deleteDefinition(definitionId: string): void {
		const currentScene = this.editor.scenes.getActiveScene();
		if (!currentScene) {
			throw new Error("No active scene");
		}

		// Remove the definition
		const updatedDefinitions = (currentScene.oneshotDefinitions || []).filter(
			(d) => d.id !== definitionId,
		);

		// Remove all markers associated with this definition
		const updatedMarkers = (currentScene.oneshotMarkers || []).filter(
			(m) => m.oneshotId !== definitionId,
		);

		// Clear audio buffer cache for this definition
		this.audioBufferCache.delete(definitionId);

		const updatedScene = {
			...currentScene,
			oneshotDefinitions: updatedDefinitions,
			oneshotMarkers: updatedMarkers,
		};

		this.editor.scenes.updateScene(currentScene.id, updatedScene);
		this.notify();
	}

	getDefinitions(): OneshotDefinition[] {
		const currentScene = this.editor.scenes.getActiveScene();
		return currentScene?.oneshotDefinitions || [];
	}

	getDefinition(definitionId: string): OneshotDefinition | undefined {
		const definitions = this.getDefinitions();
		return definitions.find((d) => d.id === definitionId);
	}

	// ---- Marker CRUD ----

	addMarker(data: CreateOneshotMarkerInput): string {
		const markerId = nanoid();
		const now = Date.now();

		const newMarker: OneshotMarker = {
			id: markerId,
			...data,
			createdAt: now,
		};

		const currentScene = this.editor.scenes.getActiveScene();
		if (!currentScene) {
			throw new Error("No active scene");
		}

		const updatedScene = {
			...currentScene,
			oneshotMarkers: [...(currentScene.oneshotMarkers || []), newMarker],
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

		const updatedMarkers = (currentScene.oneshotMarkers || []).filter(
			(m) => m.id !== markerId,
		);

		const updatedScene = {
			...currentScene,
			oneshotMarkers: updatedMarkers,
		};

		this.editor.scenes.updateScene(currentScene.id, updatedScene);
		this.notify();
	}

	getMarkers(): OneshotMarker[] {
		const currentScene = this.editor.scenes.getActiveScene();
		return currentScene?.oneshotMarkers || [];
	}

	getMarkersForDefinition(definitionId: string): OneshotMarker[] {
		const markers = this.getMarkers();
		return markers.filter((m) => m.oneshotId === definitionId);
	}

	// ---- Playback timing calculation ----

	/**
	 * Calculate the actual audio start time for a marker.
	 * For marker at time `t`: audio plays from `t - (cuePoint - trimStart)`
	 * so that cuePoint aligns with `t`.
	 */
	getAudioStartTimeForMarker(marker: OneshotMarker): number | null {
		const definition = this.getDefinition(marker.oneshotId);
		if (!definition) return null;

		const cueOffset = definition.cuePoint - definition.trimStart;
		return marker.time - cueOffset;
	}

	/**
	 * Get markers that should be scheduled within a time window.
	 * Returns markers where their audio start time falls within [startTime, endTime].
	 */
	getMarkersInTimeWindow(
		startTime: number,
		endTime: number,
	): Array<{ marker: OneshotMarker; definition: OneshotDefinition; audioStartTime: number }> {
		const markers = this.getMarkers();
		const results: Array<{
			marker: OneshotMarker;
			definition: OneshotDefinition;
			audioStartTime: number;
		}> = [];

		for (const marker of markers) {
			const definition = this.getDefinition(marker.oneshotId);
			if (!definition) continue;

			const audioStartTime = this.getAudioStartTimeForMarker(marker);
			if (audioStartTime === null) continue;

			// Check if the audio would be playing during this window
			const audioEndTime = audioStartTime + (definition.trimEnd - definition.trimStart);

			if (audioStartTime < endTime && audioEndTime > startTime) {
				results.push({ marker, definition, audioStartTime });
			}
		}

		return results;
	}

	// ---- Audio buffer cache ----

	async loadAudioBuffer(definitionId: string): Promise<AudioBuffer | null> {
		// Check cache first
		const cached = this.audioBufferCache.get(definitionId);
		if (cached) return cached;

		const definition = this.getDefinition(definitionId);
		if (!definition) return null;

		try {
			// Resolve the audio URL based on source type
			const audioUrl = this.resolveAudioUrl(definition);
			if (!audioUrl) {
				console.error("Failed to resolve audio URL for oneshot:", definitionId);
				return null;
			}

			const response = await fetch(audioUrl);
			const arrayBuffer = await response.arrayBuffer();
			const audioContext = new AudioContext();
			const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

			this.audioBufferCache.set(definitionId, audioBuffer);
			return audioBuffer;
		} catch (error) {
			console.error("Failed to load audio buffer:", error);
			return null;
		}
	}

	private resolveAudioUrl(definition: OneshotDefinition): string | null {
		const { audioSource } = definition;

		if (audioSource.type === "upload") {
			// For uploaded files, get the URL from MediaManager using fileId
			const assets = this.editor.media.getAssets();
			const asset = assets.find((a) => a.id === audioSource.fileId);
			if (asset) {
				return asset.url;
			}
			// Fallback to stored URL (may be stale blob URL)
			return audioSource.url;
		}

		// For library sounds, use the stored URL directly
		return audioSource.url;
	}

	getCachedAudioBuffer(definitionId: string): AudioBuffer | undefined {
		return this.audioBufferCache.get(definitionId);
	}

	clearAudioBufferCache(): void {
		this.audioBufferCache.clear();
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
