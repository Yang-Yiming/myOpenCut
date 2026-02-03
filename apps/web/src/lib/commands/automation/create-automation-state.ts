import { Command } from "@/lib/commands/base-command";
import { EditorCore } from "@/core";
import type { TScene } from "@/types/timeline";
import type { AutomationState } from "@/types/automation";

export class CreateAutomationStateCommand extends Command {
	private stateId: string | null = null;
	private savedScenes: TScene[] | null = null;

	constructor(
		private stateData: Omit<
			AutomationState,
			"id" | "createdAt" | "updatedAt"
		>,
	) {
		super();
	}

	execute(): void {
		const editor = EditorCore.getInstance();
		const scenes = editor.scenes.getScenes();
		this.savedScenes = [...scenes];

		this.stateId = editor.automation.createState(this.stateData);
	}

	undo(): void {
		if (this.savedScenes) {
			const editor = EditorCore.getInstance();
			editor.scenes.setScenes({ scenes: this.savedScenes });
		}
	}

	getStateId(): string | null {
		return this.stateId;
	}
}
