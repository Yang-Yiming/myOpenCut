import { create } from "zustand";

interface OneshotStore {
	// Mark mode
	isMarkModeActive: boolean;
	activeOneshotId: string | null;

	// UI state
	selectedOneshotId: string | null;
	isCreatingOneshot: boolean;
	editingOneshotId: string | null;
	isOneshotSelectionOpen: boolean;

	// Waveform editor state
	audioBuffer: AudioBuffer | null;
	isLoadingAudio: boolean;

	// Actions
	enterMarkMode: (oneshotId: string) => void;
	exitMarkMode: () => void;
	setSelectedOneshot: (oneshotId: string | null) => void;
	startCreatingOneshot: () => void;
	cancelCreatingOneshot: () => void;
	startEditingOneshot: (oneshotId: string) => void;
	cancelEditingOneshot: () => void;
	openOneshotSelection: () => void;
	closeOneshotSelection: () => void;
	setAudioBuffer: (buffer: AudioBuffer | null) => void;
	setIsLoadingAudio: (loading: boolean) => void;
}

export const useOneshotStore = create<OneshotStore>((set) => ({
	// Initial state
	isMarkModeActive: false,
	activeOneshotId: null,
	selectedOneshotId: null,
	isCreatingOneshot: false,
	editingOneshotId: null,
	isOneshotSelectionOpen: false,
	audioBuffer: null,
	isLoadingAudio: false,

	// Actions
	enterMarkMode: (oneshotId: string) =>
		set({
			isMarkModeActive: true,
			activeOneshotId: oneshotId,
		}),

	exitMarkMode: () =>
		set({
			isMarkModeActive: false,
			activeOneshotId: null,
		}),

	setSelectedOneshot: (oneshotId: string | null) =>
		set({
			selectedOneshotId: oneshotId,
		}),

	startCreatingOneshot: () =>
		set({
			isCreatingOneshot: true,
			editingOneshotId: null,
			audioBuffer: null,
		}),

	cancelCreatingOneshot: () =>
		set({
			isCreatingOneshot: false,
			audioBuffer: null,
		}),

	startEditingOneshot: (oneshotId: string) =>
		set({
			editingOneshotId: oneshotId,
			isCreatingOneshot: false,
		}),

	cancelEditingOneshot: () =>
		set({
			editingOneshotId: null,
			audioBuffer: null,
		}),

	openOneshotSelection: () =>
		set({
			isOneshotSelectionOpen: true,
		}),

	closeOneshotSelection: () =>
		set({
			isOneshotSelectionOpen: false,
		}),

	setAudioBuffer: (buffer: AudioBuffer | null) =>
		set({
			audioBuffer: buffer,
		}),

	setIsLoadingAudio: (loading: boolean) =>
		set({
			isLoadingAudio: loading,
		}),
}));
