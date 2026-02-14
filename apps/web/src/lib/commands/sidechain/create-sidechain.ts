import { Command } from "@/lib/commands/base-command";
import { EditorCore } from "@/core";
import type { TScene } from "@/types/timeline";
import type { CreateSidechainInput } from "@/types/sidechain";

export class CreateSidechainCommand extends Command {
	private configId: string | null = null;
	private savedScenes: TScene[] | null = null;

	constructor(private data: CreateSidechainInput) {
		super();
	}

	execute(): void {
		const editor = EditorCore.getInstance();
		const scenes = editor.scenes.getScenes();
		this.savedScenes = [...scenes];

		this.configId = editor.sidechain.createConfig(this.data);
	}

	undo(): void {
		if (this.savedScenes) {
			const editor = EditorCore.getInstance();
			editor.scenes.setScenes({ scenes: this.savedScenes });
		}
	}

	getConfigId(): string | null {
		return this.configId;
	}
}
