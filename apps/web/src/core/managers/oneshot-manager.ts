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
	private decodeContext: AudioContext | null = null;

	// Playback cache: sorted marker index for binary search scheduling
	private sortedMarkerIndex: Array<{
		marker: OneshotMarker;
		definition: OneshotDefinition;
		audioStartTime: number;
		audioEndTime: number;
	}> | null = null;

	constructor(private editor: EditorCore) {}

	private getDecodeContext(): AudioContext {
		if (!this.decodeContext) {
			this.decodeContext = new AudioContext();
		}
		return this.decodeContext;
	}

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
		// Fast path: use sorted index with binary search during playback
		if (this.sortedMarkerIndex) {
			return this.getMarkersInTimeWindowFast(startTime, endTime);
		}

		// Slow path fallback: read from scene each time
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

	// ---- Playback cache ----

	/**
	 * Build a sorted marker index for O(log n) scheduling during playback.
	 * Pre-resolves all definitions and computes audio time ranges once.
	 */
	prepareForPlayback(): void {
		const markers = this.getMarkers();
		const definitions = this.getDefinitions();

		// Build definition lookup map to avoid O(n) .find() per marker
		const defMap = new Map<string, OneshotDefinition>();
		for (const def of definitions) {
			defMap.set(def.id, def);
		}

		const index: Array<{
			marker: OneshotMarker;
			definition: OneshotDefinition;
			audioStartTime: number;
			audioEndTime: number;
		}> = [];

		for (const marker of markers) {
			const definition = defMap.get(marker.oneshotId);
			if (!definition) continue;

			const cueOffset = definition.cuePoint - definition.trimStart;
			const audioStartTime = marker.time - cueOffset;
			const sliceDuration = definition.trimEnd - definition.trimStart;

			index.push({
				marker,
				definition,
				audioStartTime,
				audioEndTime: audioStartTime + sliceDuration,
			});
		}

		// Sort by audioStartTime for binary search
		index.sort((a, b) => a.audioStartTime - b.audioStartTime);

		this.sortedMarkerIndex = index;
	}

	clearPlaybackCache(): void {
		this.sortedMarkerIndex = null;
	}

	/**
	 * Binary search + linear scan for markers overlapping [startTime, endTime].
	 * O(log n + window_size) instead of O(n * definitions).
	 */
	private getMarkersInTimeWindowFast(
		startTime: number,
		endTime: number,
	): Array<{ marker: OneshotMarker; definition: OneshotDefinition; audioStartTime: number }> {
		const index = this.sortedMarkerIndex!;
		const results: Array<{
			marker: OneshotMarker;
			definition: OneshotDefinition;
			audioStartTime: number;
		}> = [];

		if (index.length === 0) return results;

		// Binary search: find first entry where audioStartTime < endTime
		// We need entries where audioStartTime < endTime AND audioEndTime > startTime
		let lo = 0;
		let hi = index.length;
		while (lo < hi) {
			const mid = (lo + hi) >>> 1;
			if (index[mid].audioStartTime < startTime) {
				lo = mid + 1;
			} else {
				hi = mid;
			}
		}

		// Scan backwards to catch entries that started before startTime but haven't ended
		let scanStart = lo;
		while (scanStart > 0 && index[scanStart - 1].audioEndTime > startTime) {
			scanStart--;
		}

		// Scan forward from scanStart, collecting all overlapping entries
		for (let i = scanStart; i < index.length; i++) {
			const entry = index[i];
			// Past the window — no more matches possible
			if (entry.audioStartTime >= endTime) break;

			if (entry.audioEndTime > startTime) {
				results.push({
					marker: entry.marker,
					definition: entry.definition,
					audioStartTime: entry.audioStartTime,
				});
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
			// decodeAudioData detaches the ArrayBuffer, so slice to avoid issues with shared buffers
			const audioContext = this.getDecodeContext();
			const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));

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
