import type { TimelineTrack } from "@/types/timeline";
import type { MediaAsset } from "@/types/assets";
import type { TimeRemapConfig, TrackTimeBehavior } from "@/types/time-remap";
import type { OneshotDefinition, OneshotMarker } from "@/types/oneshot";
import {
	createAudioContext,
	collectAudioElements,
	type CollectedAudioElement,
} from "./audio";
import {
	getTrackBehavior,
	remapTime,
	getRemappedDuration,
} from "@/lib/time-remap";
import { SoundTouch, SimpleFilter } from "soundtouchjs";

export interface RemappedAudioElement extends CollectedAudioElement {
	behavior: TrackTimeBehavior;
	playbackRate: number;
}

/**
 * Collect audio elements with time remap configuration
 */
export async function collectAudioElementsWithRemap({
	tracks,
	mediaAssets,
	audioContext,
	timeRemapConfig,
}: {
	tracks: TimelineTrack[];
	mediaAssets: MediaAsset[];
	audioContext: AudioContext;
	timeRemapConfig: TimeRemapConfig;
}): Promise<RemappedAudioElement[]> {
	const baseElements = await collectAudioElements({
		tracks,
		mediaAssets,
		audioContext,
	});

	// Build track ID to track map for looking up track info
	const trackMap = new Map<string, TimelineTrack>();
	for (const track of tracks) {
		trackMap.set(track.id, track);
		for (const element of track.elements) {
			// Map element to track for lookup
			trackMap.set(`element:${element.id}`, track);
		}
	}

	return baseElements.map((element) => {
		// Find which track this element belongs to
		let trackId: string | undefined;
		for (const track of tracks) {
			for (const el of track.elements) {
				if (el.startTime === element.startTime && el.duration === element.duration) {
					trackId = track.id;
					break;
				}
			}
			if (trackId) break;
		}

		const behavior = trackId
			? getTrackBehavior(trackId, timeRemapConfig)
			: "stretch";

		const playbackRate =
			behavior === "stretch" || behavior === "pitch-preserve"
				? timeRemapConfig.timeScale
				: 1.0;

		return {
			...element,
			startTime: remapTime(element.startTime, timeRemapConfig.timeScale),
			behavior,
			playbackRate,
		};
	});
}

/**
 * Create timeline audio buffer with time remapping support
 */
export async function createTimelineAudioBufferWithRemap({
	tracks,
	mediaAssets,
	originalDuration,
	timeRemapConfig,
	sampleRate = 44100,
	audioContext,
}: {
	tracks: TimelineTrack[];
	mediaAssets: MediaAsset[];
	originalDuration: number;
	timeRemapConfig: TimeRemapConfig;
	sampleRate?: number;
	audioContext?: AudioContext;
}): Promise<AudioBuffer | null> {
	const context = audioContext ?? createAudioContext();
	const newDuration = getRemappedDuration(originalDuration, timeRemapConfig.timeScale);

	const remappedElements = await collectAudioElementsWithRemap({
		tracks,
		mediaAssets,
		audioContext: context,
		timeRemapConfig,
	});

	if (remappedElements.length === 0) return null;

	const outputChannels = 2;
	const outputLength = Math.ceil(newDuration * sampleRate);
	const outputBuffer = context.createBuffer(outputChannels, outputLength, sampleRate);

	for (const element of remappedElements) {
		if (element.muted) continue;

		mixRemappedAudioElement({
			element,
			outputBuffer,
			outputLength,
			sampleRate,
			newDuration,
		});
	}

	return outputBuffer;
}

/**
 * Mix a single remapped audio element into the output buffer
 */
function mixRemappedAudioElement({
	element,
	outputBuffer,
	outputLength,
	sampleRate,
	newDuration,
}: {
	element: RemappedAudioElement;
	outputBuffer: AudioBuffer;
	outputLength: number;
	sampleRate: number;
	newDuration: number;
}): void {
	const { buffer, startTime, trimStart, duration: elementDuration, behavior, playbackRate } = element;

	switch (behavior) {
		case "stretch":
			mixAudioStretched({ element, outputBuffer, outputLength, sampleRate });
			break;
		case "pitch-preserve":
			mixAudioPitchPreserve({ element, outputBuffer, outputLength, sampleRate });
			break;
		case "loop":
			mixAudioLooping({ element, outputBuffer, outputLength, sampleRate, newDuration });
			break;
		case "fixed":
			mixAudioFixed({ element, outputBuffer, outputLength, sampleRate });
			break;
	}
}

/**
 * Mix audio with stretch behavior - audio speed changes with timeScale
 */
function mixAudioStretched({
	element,
	outputBuffer,
	outputLength,
	sampleRate,
}: {
	element: RemappedAudioElement;
	outputBuffer: AudioBuffer;
	outputLength: number;
	sampleRate: number;
}): void {
	const { buffer, startTime, trimStart, duration: elementDuration, playbackRate } = element;

	const sourceStartSample = Math.floor(trimStart * buffer.sampleRate);
	const sourceLengthSamples = Math.floor(elementDuration * playbackRate * buffer.sampleRate);
	const outputStartSample = Math.floor(startTime * sampleRate);

	// Stretched duration in output
	const stretchedDuration = elementDuration;
	const outputSamplesToWrite = Math.floor(stretchedDuration * sampleRate);

	const outputChannels = 2;
	for (let channel = 0; channel < outputChannels; channel++) {
		const outputData = outputBuffer.getChannelData(channel);
		const sourceChannel = Math.min(channel, buffer.numberOfChannels - 1);
		const sourceData = buffer.getChannelData(sourceChannel);

		for (let i = 0; i < outputSamplesToWrite; i++) {
			const outputIndex = outputStartSample + i;
			if (outputIndex >= outputLength) break;

			// Map output position to source position with playback rate
			const sourcePosition = (i / sampleRate) * playbackRate * buffer.sampleRate;
			const sourceIndex = sourceStartSample + Math.floor(sourcePosition);
			if (sourceIndex >= sourceData.length) break;

			outputData[outputIndex] += sourceData[sourceIndex];
		}
	}
}

/**
 * Mix audio with pitch-preserve behavior - duration changes but pitch stays the same.
 * Uses SoundTouch WSOLA algorithm via soundtouchjs.
 */
function mixAudioPitchPreserve({
	element,
	outputBuffer,
	outputLength,
	sampleRate,
}: {
	element: RemappedAudioElement;
	outputBuffer: AudioBuffer;
	outputLength: number;
	sampleRate: number;
}): void {
	const { buffer, startTime, trimStart, duration: elementDuration, playbackRate } = element;

	const sourceStartSample = Math.floor(trimStart * buffer.sampleRate);
	const sourceSamples = Math.floor(elementDuration * playbackRate * buffer.sampleRate);
	const sourceEnd = Math.min(sourceStartSample + sourceSamples, buffer.getChannelData(0).length);
	const actualSourceSamples = sourceEnd - sourceStartSample;

	if (actualSourceSamples <= 0) return;

	// Build interleaved stereo buffer from source
	const interleaved = new Float32Array(actualSourceSamples * 2);
	const srcCh0 = buffer.getChannelData(0);
	const srcCh1 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : srcCh0;

	for (let i = 0; i < actualSourceSamples; i++) {
		const si = sourceStartSample + i;
		interleaved[i * 2] = srcCh0[si];
		interleaved[i * 2 + 1] = srcCh1[si];
	}

	// Set up SoundTouch processing
	const st = new SoundTouch();
	st.tempo = playbackRate;

	let sourcePosition = 0;
	const sourceFrameCount = actualSourceSamples;

	const source = {
		extract(target: Float32Array, numFrames: number, position: number): number {
			const framesToRead = Math.min(numFrames, sourceFrameCount - sourcePosition);
			if (framesToRead <= 0) return 0;

			for (let i = 0; i < framesToRead * 2; i++) {
				target[i] = interleaved[sourcePosition * 2 + i];
			}
			sourcePosition += framesToRead;
			return framesToRead;
		},
	};

	const filter = new SimpleFilter(source, st);

	// Extract processed samples
	const outputStartSample = Math.floor(startTime * sampleRate);
	const expectedOutputFrames = Math.floor(elementDuration * sampleRate);
	const chunkSize = 4096;
	const chunkBuffer = new Float32Array(chunkSize * 2);

	const outCh0 = outputBuffer.getChannelData(0);
	const outCh1 = outputBuffer.getChannelData(1);

	let framesWritten = 0;
	while (framesWritten < expectedOutputFrames) {
		const framesToExtract = Math.min(chunkSize, expectedOutputFrames - framesWritten);
		const extracted = filter.extract(chunkBuffer, framesToExtract);
		if (extracted === 0) break;

		for (let i = 0; i < extracted; i++) {
			const outIdx = outputStartSample + framesWritten + i;
			if (outIdx >= outputLength) break;

			outCh0[outIdx] += chunkBuffer[i * 2];
			outCh1[outIdx] += chunkBuffer[i * 2 + 1];
		}
		framesWritten += extracted;
	}
}

/**
 * Mix audio with loop behavior - original speed, loops to fill new duration
 */
function mixAudioLooping({
	element,
	outputBuffer,
	outputLength,
	sampleRate,
	newDuration,
}: {
	element: RemappedAudioElement;
	outputBuffer: AudioBuffer;
	outputLength: number;
	sampleRate: number;
	newDuration: number;
}): void {
	const { buffer, startTime, trimStart, duration: elementDuration } = element;

	const sourceStartSample = Math.floor(trimStart * buffer.sampleRate);
	const sourceLengthSamples = Math.floor(elementDuration * buffer.sampleRate);
	const outputStartSample = Math.floor(startTime * sampleRate);

	// Loop until end of new duration
	const samplesToFill = outputLength - outputStartSample;
	const resampleRatio = sampleRate / buffer.sampleRate;
	const resampledLoopLength = Math.floor(sourceLengthSamples * resampleRatio);

	if (resampledLoopLength <= 0) return;

	const outputChannels = 2;
	for (let channel = 0; channel < outputChannels; channel++) {
		const outputData = outputBuffer.getChannelData(channel);
		const sourceChannel = Math.min(channel, buffer.numberOfChannels - 1);
		const sourceData = buffer.getChannelData(sourceChannel);

		for (let i = 0; i < samplesToFill; i++) {
			const outputIndex = outputStartSample + i;
			if (outputIndex >= outputLength) break;

			// Loop within the source segment
			const loopPosition = i % resampledLoopLength;
			const sourceIndex = sourceStartSample + Math.floor(loopPosition / resampleRatio);
			if (sourceIndex >= sourceData.length) continue;

			outputData[outputIndex] += sourceData[sourceIndex];
		}
	}
}

/**
 * Mix audio with fixed behavior - original speed, plays once (no loop)
 */
function mixAudioFixed({
	element,
	outputBuffer,
	outputLength,
	sampleRate,
}: {
	element: RemappedAudioElement;
	outputBuffer: AudioBuffer;
	outputLength: number;
	sampleRate: number;
}): void {
	const { buffer, startTime, trimStart, duration: elementDuration } = element;

	const sourceStartSample = Math.floor(trimStart * buffer.sampleRate);
	const sourceLengthSamples = Math.floor(elementDuration * buffer.sampleRate);
	const outputStartSample = Math.floor(startTime * sampleRate);

	const resampleRatio = sampleRate / buffer.sampleRate;
	const resampledLength = Math.floor(sourceLengthSamples * resampleRatio);

	const outputChannels = 2;
	for (let channel = 0; channel < outputChannels; channel++) {
		const outputData = outputBuffer.getChannelData(channel);
		const sourceChannel = Math.min(channel, buffer.numberOfChannels - 1);
		const sourceData = buffer.getChannelData(sourceChannel);

		for (let i = 0; i < resampledLength; i++) {
			const outputIndex = outputStartSample + i;
			if (outputIndex >= outputLength) break;

			const sourceIndex = sourceStartSample + Math.floor(i / resampleRatio);
			if (sourceIndex >= sourceData.length) break;

			outputData[outputIndex] += sourceData[sourceIndex];
		}
	}
}
