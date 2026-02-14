import { Command } from "@/lib/commands/base-command";
import { EditorCore } from "@/core";
import type { TScene } from "@/types/timeline";
import type { UpdateSidechainInput } from "@/types/sidechain";

export class UpdateSidechainCommand extends Command {
	private savedScenes: TScene[] | null = null;

	constructor(
		private configId: string,
		private updates: UpdateSidechainInput,
	) {
		super();
	}

	execute(): void {
		const editor = EditorCore.getInstance();
		const scenes = editor.scenes.getScenes();
		this.savedScenes = [...scenes];

		editor.sidechain.updateConfig(this.configId, this.updates);
	}

	undo(): void {
		if (this.savedScenes) {
			const editor = EditorCore.getInstance();
			editor.scenes.setScenes({ scenes: this.savedScenes });
		}
	}
}
