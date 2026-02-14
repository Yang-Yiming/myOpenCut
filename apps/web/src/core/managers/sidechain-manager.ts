import type { EditorCore } from "..";
import type {
	SidechainConfig,
	SidechainEnvelope,
	CreateSidechainInput,
	UpdateSidechainInput,
} from "@/types/sidechain";
import {
	computeSidechainEnvelope,
	getEnvelopeGainAtTime,
} from "@/lib/sidechain/compute-envelope";
import { collectAudioElements } from "@/lib/media/audio";
import { nanoid } from "nanoid";

export class SidechainManager {
	private listeners = new Set<() => void>();
	private envelopeCache = new Map<string, SidechainEnvelope>();
	private unsubscribers: Array<() => void> = [];
	private decodeContext: AudioContext | null = null;

	// Playback lookup tables: targetId -> envelope[] for O(1) lookup in hot path
	private trackGainLookup: Map<string, SidechainEnvelope[]> | null = null;
	private oneshotGainLookup: Map<string, SidechainEnvelope[]> | null = null;

	constructor(private editor: EditorCore) {
		this.unsubscribers.push(
			this.editor.scenes.subscribe(() => this.invalidateCache()),
		);
	}

	private getDecodeContext(): AudioContext {
		if (!this.decodeContext) {
			this.decodeContext = new AudioContext();
		}
		return this.decodeContext;
	}

	dispose(): void {
		for (const unsub of this.unsubscribers) {
			unsub();
		}
		this.unsubscribers = [];
		this.envelopeCache.clear();
		if (this.decodeContext) {
			void this.decodeContext.close();
			this.decodeContext = null;
		}
	}

	// ---- Config CRUD ----

	createConfig(data: CreateSidechainInput): string {
		const configId = nanoid();
		const now = Date.now();

		const newConfig: SidechainConfig = {
			id: configId,
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
			sidechainConfigs: [
				...(currentScene.sidechainConfigs || []),
				newConfig,
			],
		};

		this.editor.scenes.updateScene(currentScene.id, updatedScene);
		this.notify();

		return configId;
	}

	updateConfig(configId: string, updates: UpdateSidechainInput): void {
		const currentScene = this.editor.scenes.getActiveScene();
		if (!currentScene) {
			throw new Error("No active scene");
		}

		const configs = currentScene.sidechainConfigs || [];
		const configIndex = configs.findIndex((c) => c.id === configId);

		if (configIndex === -1) {
			throw new Error(`Sidechain config ${configId} not found`);
		}

		const updatedConfigs = [...configs];
		updatedConfigs[configIndex] = {
			...updatedConfigs[configIndex],
			...updates,
			updatedAt: Date.now(),
		};

		const updatedScene = {
			...currentScene,
			sidechainConfigs: updatedConfigs,
		};

		// Invalidate envelope cache if params or source changed
		if (updates.params || updates.source) {
			this.envelopeCache.delete(configId);
		}

		this.editor.scenes.updateScene(currentScene.id, updatedScene);
		this.notify();
	}

	deleteConfig(configId: string): void {
		const currentScene = this.editor.scenes.getActiveScene();
		if (!currentScene) {
			throw new Error("No active scene");
		}

		const updatedConfigs = (currentScene.sidechainConfigs || []).filter(
			(c) => c.id !== configId,
		);

		this.envelopeCache.delete(configId);

		const updatedScene = {
			...currentScene,
			sidechainConfigs: updatedConfigs,
		};

		this.editor.scenes.updateScene(currentScene.id, updatedScene);
		this.notify();
	}

	getConfigs(): SidechainConfig[] {
		const currentScene = this.editor.scenes.getActiveScene();
		return currentScene?.sidechainConfigs || [];
	}

	getConfig(configId: string): SidechainConfig | undefined {
		return this.getConfigs().find((c) => c.id === configId);
	}

	// ---- Envelope computation ----

	async computeEnvelope(configId: string): Promise<SidechainEnvelope | null> {
		const config = this.getConfig(configId);
		if (!config || !config.enabled) return null;

		const duration = this.editor.timeline.getTotalDuration();

		try {
			let elements: Array<{
				buffer: AudioBuffer;
				startTime: number;
				trimStart: number;
				duration: number;
				loop: boolean;
			}>;

			const { source } = config;
			if (source.type === "track") {
				const tracks = this.editor.timeline.getTracks();
				const sourceTrack = tracks.find((t) => t.id === source.trackId);
				if (!sourceTrack) return null;

				const mediaAssets = this.editor.media.getAssets();
				const audioContext = this.getDecodeContext();
				const allElements = await collectAudioElements({
					tracks: [sourceTrack],
					mediaAssets,
					audioContext,
				});

				elements = allElements.map((el) => ({
					buffer: el.buffer,
					startTime: el.startTime,
					trimStart: el.trimStart,
					duration: el.duration,
					loop: el.loop ?? false,
				}));
			} else {
				// Oneshot source
				const defId = source.definitionId;
				const buffer = await this.editor.oneshot.loadAudioBuffer(defId);
				if (!buffer) return null;

				const markers = this.editor.oneshot.getMarkersForDefinition(defId);
				const definition = this.editor.oneshot.getDefinition(defId);
				if (!definition) return null;

				const sliceDuration = definition.trimEnd - definition.trimStart;

				elements = markers.map((marker) => {
					const audioStartTime = this.editor.oneshot.getAudioStartTimeForMarker(marker);
					return {
						buffer,
						startTime: audioStartTime ?? marker.time,
						trimStart: definition.trimStart,
						duration: sliceDuration,
						loop: false,
					};
				});
			}

			const envelope = computeSidechainEnvelope(
				elements,
				duration,
				config.params,
			);

			this.envelopeCache.set(configId, envelope);
			return envelope;
		} catch (error) {
			console.error(
				`Failed to compute sidechain envelope for ${configId}:`,
				error,
			);
			return null;
		}
	}

	async computeAllEnvelopes(): Promise<void> {
		const configs = this.getConfigs().filter((c) => c.enabled);
		await Promise.all(configs.map((c) => this.computeEnvelope(c.id)));
	}

	/**
	 * Build lookup tables mapping targetId -> envelope[] for O(1) access during playback.
	 * Call after computeAllEnvelopes() and before the playback tick loop starts.
	 */
	prepareForPlayback(): void {
		const trackLookup = new Map<string, SidechainEnvelope[]>();
		const oneshotLookup = new Map<string, SidechainEnvelope[]>();

		const configs = this.getConfigs().filter((c) => c.enabled);
		for (const config of configs) {
			const envelope = this.envelopeCache.get(config.id);
			if (!envelope) continue;

			for (const trackId of config.targetTrackIds) {
				const arr = trackLookup.get(trackId);
				if (arr) {
					arr.push(envelope);
				} else {
					trackLookup.set(trackId, [envelope]);
				}
			}

			for (const defId of config.targetOneshotDefinitionIds) {
				const arr = oneshotLookup.get(defId);
				if (arr) {
					arr.push(envelope);
				} else {
					oneshotLookup.set(defId, [envelope]);
				}
			}
		}

		this.trackGainLookup = trackLookup;
		this.oneshotGainLookup = oneshotLookup;
	}

	clearPlaybackCache(): void {
		this.trackGainLookup = null;
		this.oneshotGainLookup = null;
	}

	/**
	 * Get the combined sidechain gain for a track at a given time.
	 * Multiple sidechain configs targeting the same track are multiplied together.
	 * Returns linear gain (0~1).
	 */
	getSidechainGainForTrack(trackId: string, time: number): number {
		// Fast path: use prebuilt lookup table during playback
		if (this.trackGainLookup) {
			const envelopes = this.trackGainLookup.get(trackId);
			if (!envelopes) return 1;
			let combinedGain = 1;
			for (const envelope of envelopes) {
				combinedGain *= getEnvelopeGainAtTime(envelope, time);
			}
			return combinedGain;
		}

		// Slow path fallback: read scene + filter configs
		const configs = this.getConfigs().filter(
			(c) => c.enabled && c.targetTrackIds.includes(trackId),
		);

		if (configs.length === 0) return 1;

		let combinedGain = 1;
		for (const config of configs) {
			const envelope = this.envelopeCache.get(config.id);
			if (!envelope) continue;
			combinedGain *= getEnvelopeGainAtTime(envelope, time);
		}

		return combinedGain;
	}

	/**
	 * Get the combined sidechain gain for a oneshot definition at a given time.
	 * Multiple sidechain configs targeting the same definition are multiplied together.
	 * Returns linear gain (0~1).
	 */
	getSidechainGainForOneshot(definitionId: string, time: number): number {
		// Fast path: use prebuilt lookup table during playback
		if (this.oneshotGainLookup) {
			const envelopes = this.oneshotGainLookup.get(definitionId);
			if (!envelopes) return 1;
			let combinedGain = 1;
			for (const envelope of envelopes) {
				combinedGain *= getEnvelopeGainAtTime(envelope, time);
			}
			return combinedGain;
		}

		// Slow path fallback: read scene + filter configs
		const configs = this.getConfigs().filter(
			(c) =>
				c.enabled &&
				c.targetOneshotDefinitionIds.includes(definitionId),
		);

		if (configs.length === 0) return 1;

		let combinedGain = 1;
		for (const config of configs) {
			const envelope = this.envelopeCache.get(config.id);
			if (!envelope) continue;
			combinedGain *= getEnvelopeGainAtTime(envelope, time);
		}

		return combinedGain;
	}

	getCachedEnvelope(configId: string): SidechainEnvelope | undefined {
		return this.envelopeCache.get(configId);
	}

	invalidateCache(): void {
		this.envelopeCache.clear();
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
