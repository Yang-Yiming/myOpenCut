import { Command } from "@/lib/commands/base-command";
import type { TimelineTrack } from "@/types/timeline";
import { EditorCore } from "@/core";

export class ToggleAudioLoopCommand extends Command {
	private savedState: TimelineTrack[] | null = null;

	constructor(private elements: { trackId: string; elementId: string }[]) {
		super();
	}

	execute(): void {
		const editor = EditorCore.getInstance();
		this.savedState = editor.timeline.getTracks();

		const audioElements = this.elements.filter(({ trackId, elementId }) => {
			const track = this.savedState?.find((t) => t.id === trackId);
			const element = track?.elements.find((e) => e.id === elementId);
			return element && element.type === "audio";
		});

		if (audioElements.length === 0) {
			return;
		}

		const shouldEnableLoop = audioElements.some(({ trackId, elementId }) => {
			const track = this.savedState?.find((t) => t.id === trackId);
			const element = track?.elements.find((e) => e.id === elementId);
			return element && element.type === "audio" && !element.loop;
		});

		const updatedTracks = this.savedState.map((track) => {
			const newElements = track.elements.map((element) => {
				const shouldUpdate = audioElements.some(
					({ trackId, elementId }) =>
						track.id === trackId && element.id === elementId,
				);
				return shouldUpdate &&
					element.type === "audio" &&
					element.loop !== shouldEnableLoop
					? { ...element, loop: shouldEnableLoop }
					: element;
			});
			return { ...track, elements: newElements } as typeof track;
		});

		editor.timeline.updateTracks(updatedTracks);
	}

	undo(): void {
		if (this.savedState) {
			const editor = EditorCore.getInstance();
			editor.timeline.updateTracks(this.savedState);
		}
	}
}
