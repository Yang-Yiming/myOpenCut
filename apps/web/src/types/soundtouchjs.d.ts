declare module "soundtouchjs" {
	export class SoundTouch {
		tempo: number;
		rate: number;
		pitch: number;
		pitchOctaves: number;
		pitchSemitones: number;
		inputBuffer: unknown;
		outputBuffer: unknown;
		process(): void;
		clear(): void;
	}

	export class SimpleFilter {
		constructor(
			source: {
				extract(target: Float32Array, numFrames: number, position: number): number;
			},
			pipe: SoundTouch,
			callback?: () => void,
		);
		extract(target: Float32Array, numFrames: number): number;
		clear(): void;
	}

	export class WebAudioBufferSource {
		constructor(buffer: AudioBuffer);
		extract(target: Float32Array, numFrames: number, position: number): number;
	}

	export class PitchShifter {
		constructor(context: AudioContext, buffer: AudioBuffer, bufferSize: number);
		tempo: number;
		pitch: number;
		rate: number;
		connect(destination: AudioNode): void;
		disconnect(): void;
		on(event: string, callback: (detail: unknown) => void): void;
	}
}
