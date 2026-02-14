import type { SidechainParams, SidechainEnvelope } from "@/types/sidechain";

const ENVELOPE_SAMPLE_RATE = 200; // 200 Hz = 5ms resolution
const RMS_WINDOW_SECONDS = 0.01; // 10ms RMS window

/**
 * Convert linear amplitude to dB.
 */
function linearToDb(linear: number): number {
	if (linear <= 0) return -Infinity;
	return 20 * Math.log10(linear);
}

/**
 * Convert dB to linear amplitude.
 */
function dbToLinear(db: number): number {
	return 10 ** (db / 20);
}

/**
 * Mix an AudioBuffer down to a mono Float32Array.
 */
function mixToMono(buffer: AudioBuffer): Float32Array {
	const length = buffer.length;
	const numChannels = buffer.numberOfChannels;
	const mono = new Float32Array(length);

	for (let ch = 0; ch < numChannels; ch++) {
		const channelData = buffer.getChannelData(ch);
		for (let i = 0; i < length; i++) {
			mono[i] += channelData[i];
		}
	}

	if (numChannels > 1) {
		for (let i = 0; i < length; i++) {
			mono[i] /= numChannels;
		}
	}

	return mono;
}

/**
 * Compute RMS amplitude envelope at the target sample rate.
 * Uses a sliding window of RMS_WINDOW_SECONDS.
 */
function computeRmsEnvelope(
	mono: Float32Array,
	sourceSampleRate: number,
	envelopeSampleRate: number,
): Float32Array {
	const windowSamples = Math.floor(RMS_WINDOW_SECONDS * sourceSampleRate);
	const halfWindow = Math.floor(windowSamples / 2);
	const envelopeLength = Math.ceil(
		(mono.length / sourceSampleRate) * envelopeSampleRate,
	);
	const rmsEnvelope = new Float32Array(envelopeLength);

	for (let i = 0; i < envelopeLength; i++) {
		// Map envelope sample index to source sample index
		const centerSample = Math.floor(
			(i / envelopeSampleRate) * sourceSampleRate,
		);
		const start = Math.max(0, centerSample - halfWindow);
		const end = Math.min(mono.length, centerSample + halfWindow);
		const count = end - start;

		if (count <= 0) {
			rmsEnvelope[i] = 0;
			continue;
		}

		let sumSquares = 0;
		for (let j = start; j < end; j++) {
			sumSquares += mono[j] * mono[j];
		}
		rmsEnvelope[i] = Math.sqrt(sumSquares / count);
	}

	return rmsEnvelope;
}

/**
 * Apply compression to the RMS envelope and produce a gain curve.
 *
 * For each sample:
 * - If RMS (in dB) > threshold, compute gain reduction = (rmsDb - threshold) * (1 - 1/ratio)
 * - Clamp reduction to depth
 * - Apply attack/release smoothing via single-pole IIR filter
 */
function computeGainCurve(
	rmsEnvelope: Float32Array,
	params: SidechainParams,
): Float32Array {
	const { threshold, ratio, attack, release, depth } = params;
	const gainCurve = new Float32Array(rmsEnvelope.length);

	// Single-pole IIR coefficients for attack/release
	const attackCoeff =
		attack > 0 ? Math.exp(-1 / (attack * ENVELOPE_SAMPLE_RATE)) : 0;
	const releaseCoeff =
		release > 0 ? Math.exp(-1 / (release * ENVELOPE_SAMPLE_RATE)) : 0;

	// depth is negative dB (e.g. -24), convert to max reduction in positive dB
	const maxReductionDb = Math.abs(depth);

	let smoothedReductionDb = 0;

	for (let i = 0; i < rmsEnvelope.length; i++) {
		const rmsDb = linearToDb(rmsEnvelope[i]);

		// Compute target gain reduction in dB
		let targetReductionDb = 0;
		if (rmsDb > threshold) {
			targetReductionDb = (rmsDb - threshold) * (1 - 1 / ratio);
			targetReductionDb = Math.min(targetReductionDb, maxReductionDb);
		}

		// Apply attack/release smoothing
		if (targetReductionDb > smoothedReductionDb) {
			// Attack: reduction is increasing (signal above threshold)
			smoothedReductionDb =
				attackCoeff * smoothedReductionDb +
				(1 - attackCoeff) * targetReductionDb;
		} else {
			// Release: reduction is decreasing (signal below threshold)
			smoothedReductionDb =
				releaseCoeff * smoothedReductionDb +
				(1 - releaseCoeff) * targetReductionDb;
		}

		// Convert reduction to linear gain (0~1)
		gainCurve[i] = dbToLinear(-smoothedReductionDb);
	}

	return gainCurve;
}

/**
 * Compose a full-timeline mono buffer from source track audio elements.
 * Handles time offsets, trim, and looping.
 */
export function composeSourceTrackBuffer(
	elements: Array<{
		buffer: AudioBuffer;
		startTime: number;
		trimStart: number;
		duration: number;
		loop?: boolean;
	}>,
	timelineDuration: number,
	targetSampleRate: number,
): Float32Array {
	const outputLength = Math.ceil(timelineDuration * targetSampleRate);
	const output = new Float32Array(outputLength);

	for (const element of elements) {
		const mono = mixToMono(element.buffer);
		const resampleRatio = targetSampleRate / element.buffer.sampleRate;
		const sourceStartSample = Math.floor(
			element.trimStart * element.buffer.sampleRate,
		);
		const sourceLengthSamples = Math.floor(
			element.duration * element.buffer.sampleRate,
		);
		const resampledLength = Math.floor(sourceLengthSamples * resampleRatio);
		const outputStartSample = Math.floor(
			element.startTime * targetSampleRate,
		);

		const maxOutputSamples = element.loop
			? outputLength - outputStartSample
			: resampledLength;

		for (let i = 0; i < maxOutputSamples; i++) {
			const outputIndex = outputStartSample + i;
			if (outputIndex >= outputLength) break;

			const sourceOffset =
				element.loop && resampledLength > 0
					? i % resampledLength
					: i;
			const sourceIndex =
				sourceStartSample + Math.floor(sourceOffset / resampleRatio);
			if (sourceIndex >= mono.length) break;

			output[outputIndex] += mono[sourceIndex];
		}
	}

	return output;
}

/**
 * Compute a sidechain envelope from a pre-composed mono source buffer.
 */
export function computeEnvelopeFromBuffer(
	sourceBuffer: Float32Array,
	sourceSampleRate: number,
	params: SidechainParams,
): SidechainEnvelope {
	const duration = sourceBuffer.length / sourceSampleRate;

	// Wrap in a minimal object that looks like Float32Array for RMS computation
	const rmsEnvelope = computeRmsEnvelope(
		sourceBuffer,
		sourceSampleRate,
		ENVELOPE_SAMPLE_RATE,
	);

	const gainValues = computeGainCurve(rmsEnvelope, params);

	return {
		sampleRate: ENVELOPE_SAMPLE_RATE,
		gainValues,
		duration,
	};
}

/**
 * Compute a sidechain envelope from source track AudioBuffer elements.
 *
 * This is the main entry point: collects audio from source track elements,
 * composes them into a timeline-length mono buffer, then computes the
 * compression envelope.
 */
export function computeSidechainEnvelope(
	sourceElements: Array<{
		buffer: AudioBuffer;
		startTime: number;
		trimStart: number;
		duration: number;
		loop?: boolean;
	}>,
	timelineDuration: number,
	params: SidechainParams,
): SidechainEnvelope {
	if (sourceElements.length === 0) {
		const envelopeLength = Math.ceil(
			timelineDuration * ENVELOPE_SAMPLE_RATE,
		);
		return {
			sampleRate: ENVELOPE_SAMPLE_RATE,
			gainValues: new Float32Array(envelopeLength).fill(1),
			duration: timelineDuration,
		};
	}

	// Use the first element's sample rate as reference
	const targetSampleRate = sourceElements[0].buffer.sampleRate;

	const composedBuffer = composeSourceTrackBuffer(
		sourceElements,
		timelineDuration,
		targetSampleRate,
	);

	return computeEnvelopeFromBuffer(composedBuffer, targetSampleRate, params);
}

/**
 * Look up the sidechain gain at a given time from an envelope.
 * Returns linear gain (0~1). Uses linear interpolation.
 */
export function getEnvelopeGainAtTime(
	envelope: SidechainEnvelope,
	time: number,
): number {
	if (time < 0 || time >= envelope.duration) return 1;

	const sampleIndex = time * envelope.sampleRate;
	const index0 = Math.floor(sampleIndex);
	const index1 = Math.min(index0 + 1, envelope.gainValues.length - 1);
	const frac = sampleIndex - index0;

	if (index0 >= envelope.gainValues.length) return 1;

	return envelope.gainValues[index0] * (1 - frac) + envelope.gainValues[index1] * frac;
}
