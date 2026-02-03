import { Command } from "@/lib/commands/base-command";
import { EditorCore } from "@/core";
import type { TScene } from "@/types/timeline";

export class RemoveAutomationMarkerCommand extends Command {
	private savedScenes: TScene[] | null = null;

	constructor(private markerId: string) {
		super();
	}

	execute(): void {
		const editor = EditorCore.getInstance();
		const scenes = editor.scenes.getScenes();
		this.savedScenes = [...scenes];

		editor.automation.removeMarker(this.markerId);
	}

	undo(): void {
		if (this.savedScenes) {
			const editor = EditorCore.getInstance();
			editor.scenes.setScenes({ scenes: this.savedScenes });
		}
	}
}
