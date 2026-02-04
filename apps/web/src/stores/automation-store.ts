import { create } from "zustand";

interface AutomationStore {
	// Mark mode
	isMarkModeActive: boolean;
	activeMarkStateId: string | null;

	// UI state
	selectedStateId: string | null;
	isCreatingState: boolean;
	editingStateId: string | null;
	isStateSelectionOpen: boolean;

	// Actions
	enterMarkMode: (stateId: string) => void;
	exitMarkMode: () => void;
	setSelectedState: (stateId: string | null) => void;
	startCreatingState: () => void;
	cancelCreatingState: () => void;
	startEditingState: (stateId: string) => void;
	cancelEditingState: () => void;
	openStateSelection: () => void;
	closeStateSelection: () => void;
}

export const useAutomationStore = create<AutomationStore>((set) => ({
	// Initial state
	isMarkModeActive: false,
	activeMarkStateId: null,
	selectedStateId: null,
	isCreatingState: false,
	editingStateId: null,
	isStateSelectionOpen: false,

	// Actions
	enterMarkMode: (stateId: string) =>
		set({
			isMarkModeActive: true,
			activeMarkStateId: stateId,
		}),

	exitMarkMode: () =>
		set({
			isMarkModeActive: false,
			activeMarkStateId: null,
		}),

	setSelectedState: (stateId: string | null) =>
		set({
			selectedStateId: stateId,
		}),

	startCreatingState: () =>
		set({
			isCreatingState: true,
			editingStateId: null,
		}),

	cancelCreatingState: () =>
		set({
			isCreatingState: false,
		}),

	startEditingState: (stateId: string) =>
		set({
			editingStateId: stateId,
			isCreatingState: false,
		}),

	cancelEditingState: () =>
		set({
			editingStateId: null,
		}),

	openStateSelection: () =>
		set({
			isStateSelectionOpen: true,
		}),

	closeStateSelection: () =>
		set({
			isStateSelectionOpen: false,
		}),
}));
