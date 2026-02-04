import { Command } from "@/lib/commands/base-command";
import { EditorCore } from "@/core";
import type { TScene } from "@/types/timeline";
import type { CreateOneshotInput } from "@/types/oneshot";

export class CreateOneshotCommand extends Command {
	private definitionId: string | null = null;
	private savedScenes: TScene[] | null = null;

	constructor(private data: CreateOneshotInput) {
		super();
	}

	execute(): void {
		const editor = EditorCore.getInstance();
		const scenes = editor.scenes.getScenes();
		this.savedScenes = [...scenes];

		this.definitionId = editor.oneshot.createDefinition(this.data);
	}

	undo(): void {
		if (this.savedScenes) {
			const editor = EditorCore.getInstance();
			editor.scenes.setScenes({ scenes: this.savedScenes });
		}
	}

	getDefinitionId(): string | null {
		return this.definitionId;
	}
}
