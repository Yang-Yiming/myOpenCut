import { Command } from "@/lib/commands/base-command";
import { EditorCore } from "@/core";
import type { TScene } from "@/types/timeline";

interface RangeMarkerData {
	type: "range";
	stateId: string;
	trackId: string;
	elementId: string;
}

interface PointMarkerData {
	type: "point";
	stateId: string;
	time: number;
}

type MarkerData = RangeMarkerData | PointMarkerData;

export class AddAutomationMarkerCommand extends Command {
	private markerId: string | null = null;
	private savedScenes: TScene[] | null = null;

	constructor(private markerData: MarkerData) {
		super();
	}

	execute(): void {
		const editor = EditorCore.getInstance();
		const scenes = editor.scenes.getScenes();
		this.savedScenes = [...scenes];

		if (this.markerData.type === "range") {
			this.markerId = editor.automation.addRangeMarker(
				this.markerData.stateId,
				this.markerData.trackId,
				this.markerData.elementId,
			);
		} else {
			this.markerId = editor.automation.addPointMarker(
				this.markerData.stateId,
				this.markerData.time,
			);
		}
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
