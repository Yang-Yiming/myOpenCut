import type { AudioElement } from "@/types/timeline";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useEditor } from "@/hooks/use-editor";
import {
	PropertyItem,
	PropertyItemLabel,
	PropertyItemValue,
} from "./property-item";

export function AudioProperties({
	element,
	trackId,
}: {
	element: AudioElement;
	trackId: string;
}) {
	const editor = useEditor();

	const handleLoopToggle = () => {
		editor.timeline.toggleAudioLoop({
			elements: [{ trackId, elementId: element.id }],
		});
	};

	return (
		<div className="space-y-4 p-5">
			<div className="space-y-3">
				<h3 className="text-sm font-medium">Audio Settings</h3>
				<PropertyItem>
					<PropertyItemLabel>
						<Label htmlFor="loop-audio">Loop Audio</Label>
					</PropertyItemLabel>
					<PropertyItemValue>
						<Switch
							id="loop-audio"
							checked={element.loop ?? false}
							onCheckedChange={handleLoopToggle}
						/>
					</PropertyItemValue>
				</PropertyItem>
				{element.loop && (
					<p className="text-xs text-muted-foreground">
						Audio will repeat until the end of the timeline
					</p>
				)}
			</div>
		</div>
	);
}
