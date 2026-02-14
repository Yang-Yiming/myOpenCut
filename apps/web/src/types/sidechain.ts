export interface SidechainParams {
	threshold: number; // dB, -60~0, default -20
	ratio: number; // 1~20, default 4
	attack: number; // seconds, 0.001~0.5, default 0.01
	release: number; // seconds, 0.01~2.0, default 0.2
	depth: number; // max reduction dB, 0~-60, default -24
}

export type SidechainSource =
	| { type: "track"; trackId: string }
	| { type: "oneshot"; definitionId: string };

export interface SidechainConfig {
	id: string;
	name: string;
	source: SidechainSource;
	targetTrackIds: string[];
	targetOneshotDefinitionIds: string[];
	params: SidechainParams;
	enabled: boolean;
	createdAt: number;
	updatedAt: number;
}

export interface SidechainEnvelope {
	sampleRate: number; // 200 Hz (5ms resolution)
	gainValues: Float32Array; // 0.0~1.0 linear gain
	duration: number; // seconds
}

export type CreateSidechainInput = Omit<
	SidechainConfig,
	"id" | "createdAt" | "updatedAt"
>;

export type UpdateSidechainInput = Partial<
	Omit<SidechainConfig, "id" | "createdAt" | "updatedAt">
>;

export const DEFAULT_SIDECHAIN_PARAMS: SidechainParams = {
	threshold: -20,
	ratio: 4,
	attack: 0.01,
	release: 0.2,
	depth: -24,
};
