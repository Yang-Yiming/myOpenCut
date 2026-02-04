import { Command } from "@/lib/commands/base-command";
import { EditorCore } from "@/core";
import type { TScene } from "@/types/timeline";
import type { CreateOneshotMarkerInput } from "@/types/oneshot";

export class CreateOneshotMarkerCommand extends Command {
	private markerId: string | null = null;
	private savedScenes: TScene[] | null = null;

	constructor(private data: CreateOneshotMarkerInput) {
		super();
	}

	execute(): void {
		const editor = EditorCore.getInstance();
		const scenes = editor.scenes.getScenes();
		this.savedScenes = [...scenes];

		this.markerId = editor.oneshot.addMarker(this.data);
	}

	undo(): void {
		if (this.savedScenes) {
			const editor = EditorCore.getInstance();
			editor.scenes.setScenes({ scenes: this.savedScenes });
		}
	}

	getMarkerId(): string | null {
		return this.markerId;
	}
}
