import { Command } from "@/lib/commands/base-command";
import { EditorCore } from "@/core";
import type { TScene } from "@/types/timeline";
import type { AutomationState } from "@/types/automation";

export class UpdateAutomationStateCommand extends Command {
	private savedScenes: TScene[] | null = null;

	constructor(
		private stateId: string,
		private updates: Partial<Omit<AutomationState, "id" | "createdAt">>,
	) {
		super();
	}

	execute(): void {
		const editor = EditorCore.getInstance();
		const scenes = editor.scenes.getScenes();
		this.savedScenes = [...scenes];

		editor.automation.updateState(this.stateId, this.updates);
	}

	undo(): void {
		if (this.savedScenes) {
			const editor = EditorCore.getInstance();
			editor.scenes.setScenes({ scenes: this.savedScenes });
		}
	}
}
