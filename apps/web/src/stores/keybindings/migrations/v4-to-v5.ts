import type { KeybindingConfig, ShortcutKey } from "@/types/keybinding";

interface V4State {
	keybindings: KeybindingConfig;
	isCustomized: boolean;
}

export function v4ToV5({ state }: { state: unknown }): unknown {
	const v4 = state as V4State;

	const migrated = { ...v4.keybindings };

	// Add "shift+tab" -> "cycle-oneshot" if not already assigned
	if (!migrated["shift+tab" as ShortcutKey]) {
		migrated["shift+tab" as ShortcutKey] = "cycle-oneshot";
	}

	return { ...v4, keybindings: migrated };
}
