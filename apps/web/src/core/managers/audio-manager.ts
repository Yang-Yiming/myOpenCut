import type { EditorCore } from "@/core";
import type { AudioClipSource } from "@/lib/media/audio";
import { createAudioContext, collectAudioClips } from "@/lib/media/audio";
import {
	ALL_FORMATS,
	AudioBufferSink,
	BlobSource,
	Input,
	type WrappedAudioBuffer,
} from "mediabunny";

export class AudioManager {
	private audioContext: AudioContext | null = null;
	private masterGain: GainNode | null = null;
	private playbackStartTime = 0;
	private playbackStartContextTime = 0;
	private scheduleTimer: number | null = null;
	private volumeUpdateTimer: number | null = null;
	private lookaheadSeconds = 2;
	private scheduleIntervalMs = 500;
	private clips: AudioClipSource[] = [];
	private sinks = new Map<string, AudioBufferSink>();
	private inputs = new Map<string, Input>();
	private activeClipIds = new Set<string>();
	private clipIterators = new Map<
		string,
		AsyncGenerator<WrappedAudioBuffer, void, unknown>
	>();
	private queuedSources = new Set<AudioBufferSourceNode>();
	private clipGains = new Map<string, GainNode>();
	private playbackSessionId = 0;
	private lastIsPlaying = false;
	private lastVolume = 1;
	private unsubscribers: Array<() => void> = [];
	private scheduledOneshotIds = new Set<string>();
	private oneshotBuffers = new Map<string, AudioBuffer>();
	private oneshotGainNodes = new Map<
		string,
		{ gainNode: GainNode; definitionId: string; baseVolume: number }
	>();

	constructor(private editor: EditorCore) {
		this.lastVolume = this.editor.playback.getVolume();

		this.unsubscribers.push(
			this.editor.playback.subscribe(this.handlePlaybackChange),
			this.editor.timeline.subscribe(this.handleTimelineChange),
			this.editor.media.subscribe(this.handleTimelineChange),
		);
		if (typeof window !== "undefined") {
			window.addEventListener("playback-seek", this.handleSeek);
		}
	}

	dispose(): void {
		this.stopPlayback();
		for (const unsub of this.unsubscribers) {
			unsub();
		}
		this.unsubscribers = [];
		if (typeof window !== "undefined") {
			window.removeEventListener("playback-seek", this.handleSeek);
		}
		this.disposeSinks();
		if (this.audioContext) {
			void this.audioContext.close();
			this.audioContext = null;
			this.masterGain = null;
		}
	}

	private handlePlaybackChange = (): void => {
		const isPlaying = this.editor.playback.getIsPlaying();
		const volume = this.editor.playback.getVolume();

		if (volume !== this.lastVolume) {
			this.lastVolume = volume;
			this.updateGain();
		}

		if (isPlaying !== this.lastIsPlaying) {
			this.lastIsPlaying = isPlaying;
			if (isPlaying) {
				void this.startPlayback({
					time: this.editor.playback.getCurrentTime(),
				});
			} else {
				this.stopPlayback();
			}
		}
	};

	private handleSeek = (event: Event): void => {
		const detail = (event as CustomEvent<{ time: number }>).detail;
		if (!detail) return;

		if (this.editor.playback.getIsPlaying()) {
			void this.startPlayback({ time: detail.time });
			return;
		}

		this.stopPlayback();
	};

	private handleTimelineChange = (): void => {
		this.disposeSinks();

		if (!this.editor.playback.getIsPlaying()) return;

		void this.startPlayback({ time: this.editor.playback.getCurrentTime() });
	};

	private ensureAudioContext(): AudioContext | null {
		if (this.audioContext) return this.audioContext;
		if (typeof window === "undefined") return null;

		this.audioContext = createAudioContext();
		this.masterGain = this.audioContext.createGain();
		this.masterGain.gain.value = this.lastVolume;
		this.masterGain.connect(this.audioContext.destination);
		return this.audioContext;
	}

	private updateGain(): void {
		if (!this.masterGain) return;
		this.masterGain.gain.value = this.lastVolume;
	}

	private getPlaybackTime(): number {
		if (!this.audioContext) return this.playbackStartTime;
		const elapsed = this.audioContext.currentTime - this.playbackStartContextTime;
		return this.playbackStartTime + elapsed;
	}

	private async startPlayback({ time }: { time: number }): Promise<void> {
		const audioContext = this.ensureAudioContext();
		if (!audioContext) return;

		this.stopPlayback();
		this.playbackSessionId++;

		const tracks = this.editor.timeline.getTracks();
		const mediaAssets = this.editor.media.getAssets();
		const duration = this.editor.timeline.getTotalDuration();

		if (duration <= 0) return;

		if (audioContext.state === "suspended") {
			await audioContext.resume();
		}

		this.clips = await collectAudioClips({ tracks, mediaAssets });
		if (!this.editor.playback.getIsPlaying()) return;

		// Pre-compute sidechain envelopes for playback
		await this.editor.sidechain.computeAllEnvelopes();

		this.playbackStartTime = time;
		this.playbackStartContextTime = audioContext.currentTime;

		this.scheduleUpcomingClips();

		if (typeof window !== "undefined") {
			this.scheduleTimer = window.setInterval(() => {
				this.scheduleUpcomingClips();
			}, this.scheduleIntervalMs);

			this.volumeUpdateTimer = window.setInterval(() => {
				this.updateClipVolumes();
			}, 100);
		}
	}

	private scheduleUpcomingClips(): void {
		if (!this.editor.playback.getIsPlaying()) return;

		const currentTime = this.getPlaybackTime();
		const windowEnd = currentTime + this.lookaheadSeconds;

		for (const clip of this.clips) {
			if (clip.muted) continue;
			if (this.activeClipIds.has(clip.id)) continue;

			const clipEnd = clip.startTime + clip.duration;
			if (clipEnd <= currentTime) continue;
			if (clip.startTime > windowEnd) continue;

			this.activeClipIds.add(clip.id);
			void this.runClipIterator({ clip, startTime: currentTime, sessionId: this.playbackSessionId });
		}

		// Schedule oneshot markers
		this.scheduleOneshotMarkers(currentTime, windowEnd);
	}

	private scheduleOneshotMarkers(currentTime: number, windowEnd: number): void {
		const audioContext = this.audioContext;
		if (!audioContext || !this.masterGain) return;

		const markersInWindow = this.editor.oneshot.getMarkersInTimeWindow(
			currentTime,
			windowEnd,
		);

		for (const { marker, definition, audioStartTime } of markersInWindow) {
			if (this.scheduledOneshotIds.has(marker.id)) continue;
			if (audioStartTime < currentTime - 0.1) continue;

			this.scheduledOneshotIds.add(marker.id);
			void this.playOneshotMarker(marker, definition, audioStartTime);
		}
	}

	private async playOneshotMarker(
		marker: { id: string; volume?: number },
		definition: { id: string; audioSource: { url: string }; trimStart: number; trimEnd: number },
		audioStartTime: number,
	): Promise<void> {
		const audioContext = this.audioContext;
		if (!audioContext || !this.masterGain) return;

		// Get or load audio buffer
		let buffer = this.oneshotBuffers.get(definition.id);
		if (!buffer) {
			const loadedBuffer = await this.editor.oneshot.loadAudioBuffer(definition.id);
			if (!loadedBuffer) return;
			buffer = loadedBuffer;
			this.oneshotBuffers.set(definition.id, buffer);
		}

		if (!this.editor.playback.getIsPlaying()) return;

		const source = audioContext.createBufferSource();
		source.buffer = buffer;

		// Create gain node for volume control
		const gainNode = audioContext.createGain();
		gainNode.gain.value = marker.volume ?? 1;
		source.connect(gainNode);
		gainNode.connect(this.masterGain);

		// Calculate when to start in audio context time
		const contextStartTime =
			this.playbackStartContextTime +
			(audioStartTime - this.playbackStartTime);

		const sliceDuration = definition.trimEnd - definition.trimStart;

		if (contextStartTime >= audioContext.currentTime) {
			source.start(contextStartTime, definition.trimStart, sliceDuration);
		} else {
			const offset = audioContext.currentTime - contextStartTime;
			if (offset < sliceDuration) {
				source.start(
					audioContext.currentTime,
					definition.trimStart + offset,
					sliceDuration - offset,
				);
			} else {
				return;
			}
		}

		this.queuedSources.add(source);
		this.oneshotGainNodes.set(marker.id, {
			gainNode,
			definitionId: definition.id,
			baseVolume: marker.volume ?? 1,
		});
		source.addEventListener("ended", () => {
			source.disconnect();
			gainNode.disconnect();
			this.queuedSources.delete(source);
			this.oneshotGainNodes.delete(marker.id);
		});
	}

	private stopPlayback(): void {
		if (this.scheduleTimer && typeof window !== "undefined") {
			window.clearInterval(this.scheduleTimer);
		}
		this.scheduleTimer = null;

		if (this.volumeUpdateTimer && typeof window !== "undefined") {
			window.clearInterval(this.volumeUpdateTimer);
		}
		this.volumeUpdateTimer = null;

		for (const iterator of this.clipIterators.values()) {
			void iterator.return();
		}
		this.clipIterators.clear();
		this.activeClipIds.clear();
		this.scheduledOneshotIds.clear();

		for (const source of this.queuedSources) {
			try {
				source.stop();
			} catch {}
			source.disconnect();
		}
		this.queuedSources.clear();
		this.clipGains.clear();
		this.oneshotGainNodes.clear();
	}

	private async runClipIterator({
		clip,
		startTime,
		sessionId,
	}: {
		clip: AudioClipSource;
		startTime: number;
		sessionId: number;
	}): Promise<void> {
		const audioContext = this.ensureAudioContext();
		if (!audioContext) return;

		const sink = await this.getAudioSink({ clip });
		if (!sink || !this.editor.playback.getIsPlaying()) return;
		if (sessionId !== this.playbackSessionId) return;

		// Create per-clip gain node for automation volume control
		const clipGain = audioContext.createGain();
		clipGain.connect(this.masterGain ?? audioContext.destination);
		this.clipGains.set(clip.id, clipGain);

		// Set initial volume from automation
		const initialTime = Math.max(startTime, clip.startTime);
		const initialVolume = this.editor.automation.getEffectiveVolumeForTrack(
			clip.trackId,
			clip.id,
			initialTime,
			clip.baseVolume * 100,
		);
		clipGain.gain.value = initialVolume / 100;

		const clipStart = clip.startTime;
		const clipDuration = clip.duration;
		const totalDuration = this.editor.timeline.getTotalDuration();

		// For looping clips, effective end is timeline end; otherwise it's clip end
		const effectiveEnd = clip.loop ? totalDuration : clipStart + clipDuration;

		const iteratorStartTime = Math.max(startTime, clipStart);

		// Calculate which loop iteration we're starting in
		let loopIteration = 0;
		let positionInLoop = iteratorStartTime - clipStart;

		if (clip.loop && clipDuration > 0) {
			loopIteration = Math.floor((iteratorStartTime - clipStart) / clipDuration);
			positionInLoop = (iteratorStartTime - clipStart) % clipDuration;
		}

		let sourceStartTime = clip.trimStart + positionInLoop;
		let iterator = sink.buffers(sourceStartTime);
		this.clipIterators.set(clip.id, iterator);

		try {
			while (true) {
				for await (const { buffer, timestamp } of iterator) {
					if (!this.editor.playback.getIsPlaying()) return;
					if (sessionId !== this.playbackSessionId) return;

					// Calculate position within the current loop
					const sourceOffset = timestamp - clip.trimStart;

					// Map source time to timeline time accounting for loop iteration
					const timelineTime = clipStart + (loopIteration * clipDuration) + sourceOffset;

					// Stop if we've reached the effective end
					if (timelineTime >= effectiveEnd) return;

					const node = audioContext.createBufferSource();
					node.buffer = buffer;
					node.connect(clipGain);

					const startTimestamp =
						this.playbackStartContextTime +
						(timelineTime - this.playbackStartTime);

					if (startTimestamp >= audioContext.currentTime) {
						node.start(startTimestamp);
					} else {
						const offset = audioContext.currentTime - startTimestamp;
						if (offset < buffer.duration) {
							node.start(audioContext.currentTime, offset);
						} else {
							continue;
						}
					}

					this.queuedSources.add(node);
					node.addEventListener("ended", () => {
						node.disconnect();
						this.queuedSources.delete(node);
					});

					const aheadTime = timelineTime - this.getPlaybackTime();
					if (aheadTime >= 1) {
						await this.waitUntilCaughtUp({ timelineTime, targetAhead: 1 });
						if (sessionId !== this.playbackSessionId) return;
					}
				}

				// If not looping, we're done after the first iteration
				if (!clip.loop) break;

				// For looping clips, restart the iterator from the beginning
				loopIteration++;
				iterator = sink.buffers(clip.trimStart);
				this.clipIterators.set(clip.id, iterator);
			}
		} catch (error) {
			// Input may be disposed when timeline changes (e.g., muting a track)
			// This is expected and we can safely ignore it
			if (
				error instanceof Error &&
				error.message.includes("disposed")
			) {
				return;
			}
			throw error;
		}

		this.clipIterators.delete(clip.id);
		// don't remove from activeClipIds - prevents scheduler from restarting this clip
		// the set is cleared on stopPlayback anyway
	}

	private waitUntilCaughtUp({
		timelineTime,
		targetAhead,
	}: {
		timelineTime: number;
		targetAhead: number;
	}): Promise<void> {
		return new Promise((resolve) => {
			const checkInterval = setInterval(() => {
				if (!this.editor.playback.getIsPlaying()) {
					clearInterval(checkInterval);
					resolve();
					return;
				}

				const playbackTime = this.getPlaybackTime();
				if (timelineTime - playbackTime < targetAhead) {
					clearInterval(checkInterval);
					resolve();
				}
			}, 100);
		});
	}

	private updateClipVolumes(): void {
		const currentTime = this.getPlaybackTime();
		for (const clip of this.clips) {
			const clipGain = this.clipGains.get(clip.id);
			if (!clipGain) continue;

			const effectiveVolume = this.editor.automation.getEffectiveVolumeForTrack(
				clip.trackId,
				clip.id,
				currentTime,
				clip.baseVolume * 100,
			);
			const sidechainGain = this.editor.sidechain.getSidechainGainForTrack(
				clip.trackId,
				currentTime,
			);
			clipGain.gain.value = (effectiveVolume / 100) * sidechainGain;
		}

		// Apply sidechain gain to active oneshot nodes
		for (const [, { gainNode, definitionId, baseVolume }] of this.oneshotGainNodes) {
			const scGain = this.editor.sidechain.getSidechainGainForOneshot(definitionId, currentTime);
			gainNode.gain.value = baseVolume * scGain;
		}
	}

	private disposeSinks(): void {
		for (const iterator of this.clipIterators.values()) {
			void iterator.return();
		}
		this.clipIterators.clear();
		this.activeClipIds.clear();

		for (const input of this.inputs.values()) {
			input.dispose();
		}
		this.inputs.clear();
		this.sinks.clear();
	}

	private async getAudioSink({
		clip,
	}: {
		clip: AudioClipSource;
	}): Promise<AudioBufferSink | null> {
		const existingSink = this.sinks.get(clip.sourceKey);
		if (existingSink) return existingSink;

		try {
			const input = new Input({
				source: new BlobSource(clip.file),
				formats: ALL_FORMATS,
			});
			const audioTrack = await input.getPrimaryAudioTrack();
			if (!audioTrack) {
				input.dispose();
				return null;
			}

			const sink = new AudioBufferSink(audioTrack);
			this.inputs.set(clip.sourceKey, input);
			this.sinks.set(clip.sourceKey, sink);
			return sink;
		} catch (error) {
			console.warn("Failed to initialize audio sink:", error);
			return null;
		}
	}
}
