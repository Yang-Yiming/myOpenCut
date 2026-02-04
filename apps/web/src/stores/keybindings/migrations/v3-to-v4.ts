import type { KeybindingConfig, ShortcutKey } from "@/types/keybinding";

interface V3State {
	keybindings: KeybindingConfig;
	isCustomized: boolean;
}

export function v3ToV4({ state }: { state: unknown }): unknown {
	const v3 = state as V3State;

	const migrated = { ...v3.keybindings };

	// Add "o" -> "mark-oneshot" if not already assigned
	if (!migrated["o" as ShortcutKey]) {
		migrated["o" as ShortcutKey] = "mark-oneshot";
	}

	return { ...v3, keybindings: migrated };
}
