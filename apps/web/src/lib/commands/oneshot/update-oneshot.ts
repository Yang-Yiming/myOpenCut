import { Command } from "@/lib/commands/base-command";
import { EditorCore } from "@/core";
import type { TScene } from "@/types/timeline";
import type { UpdateOneshotInput } from "@/types/oneshot";

export class UpdateOneshotCommand extends Command {
	private savedScenes: TScene[] | null = null;

	constructor(
		private definitionId: string,
		private updates: UpdateOneshotInput,
	) {
		super();
	}

	execute(): void {
		const editor = EditorCore.getInstance();
		const scenes = editor.scenes.getScenes();
		this.savedScenes = [...scenes];

		editor.oneshot.updateDefinition(this.definitionId, this.updates);
	}

	undo(): void {
		if (this.savedScenes) {
			const editor = EditorCore.getInstance();
			editor.scenes.setScenes({ scenes: this.savedScenes });
		}
	}
}
