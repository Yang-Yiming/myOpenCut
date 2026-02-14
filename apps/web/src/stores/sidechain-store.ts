import { create } from "zustand";

interface SidechainStore {
	selectedConfigId: string | null;
	isCreating: boolean;
	editingConfigId: string | null;
	isComputingEnvelope: boolean;

	setSelectedConfig: (configId: string | null) => void;
	startCreating: () => void;
	cancelCreating: () => void;
	startEditing: (configId: string) => void;
	cancelEditing: () => void;
	setComputingEnvelope: (computing: boolean) => void;
}

export const useSidechainStore = create<SidechainStore>((set) => ({
	selectedConfigId: null,
	isCreating: false,
	editingConfigId: null,
	isComputingEnvelope: false,

	setSelectedConfig: (configId: string | null) =>
		set({ selectedConfigId: configId }),

	startCreating: () =>
		set({ isCreating: true, editingConfigId: null }),

	cancelCreating: () =>
		set({ isCreating: false }),

	startEditing: (configId: string) =>
		set({ editingConfigId: configId, isCreating: false }),

	cancelEditing: () =>
		set({ editingConfigId: null }),

	setComputingEnvelope: (computing: boolean) =>
		set({ isComputingEnvelope: computing }),
}));
