"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogBody,
	DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEditor } from "@/hooks/use-editor";
import { useOneshotStore } from "@/stores/oneshot-store";
import { CreateOneshotMarkerCommand } from "@/lib/commands";
import type { OneshotDefinition } from "@/types/oneshot";

export function OneshotSelectionDialog() {
	const editor = useEditor();
	const { isOneshotSelectionOpen, closeOneshotSelection } = useOneshotStore();
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [, forceUpdate] = useState({});

	// Subscribe to oneshot changes
	useEffect(() => {
		const unsubscribe = editor.oneshot.subscribe(() => {
			forceUpdate({});
		});
		return unsubscribe;
	}, [editor.oneshot]);

	const definitions = editor.oneshot.getDefinitions();

	const handleClose = () => {
		setSelectedId(null);
		closeOneshotSelection();
	};

	const handleMark = () => {
		if (!selectedId) return;

		const currentTime = editor.playback.getCurrentTime();
		editor.command.execute(
			new CreateOneshotMarkerCommand({
				oneshotId: selectedId,
				time: currentTime,
			}),
		);

		handleClose();
	};

	return (
		<Dialog open={isOneshotSelectionOpen} onOpenChange={handleClose}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>Select Oneshot to Mark</DialogTitle>
				</DialogHeader>

				<DialogBody>
					{definitions.length === 0 ? (
						<p className="text-sm text-muted-foreground text-center py-4">
							No oneshots created yet. Create a oneshot first.
						</p>
					) : (
						<ScrollArea className="h-[300px]">
							<div className="space-y-2">
								{definitions.map((def) => (
									<OneshotSelectionItem
										key={def.id}
										definition={def}
										isSelected={selectedId === def.id}
										onSelect={() => setSelectedId(def.id)}
									/>
								))}
							</div>
						</ScrollArea>
					)}
				</DialogBody>

				<DialogFooter>
					<Button variant="outline" onClick={handleClose}>
						Cancel
					</Button>
					<Button onClick={handleMark} disabled={!selectedId}>
						Mark at Playhead
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function OneshotSelectionItem({
	definition,
	isSelected,
	onSelect,
}: {
	definition: OneshotDefinition;
	isSelected: boolean;
	onSelect: () => void;
}) {
	const sliceDuration = definition.trimEnd - definition.trimStart;

	return (
		<button
			type="button"
			className={`w-full text-left p-3 rounded-lg border transition-colors ${
				isSelected
					? "border-primary bg-primary/10"
					: "border-transparent hover:bg-muted/50"
			}`}
			onClick={onSelect}
		>
			<div className="flex items-center gap-2">
				<div
					className="w-3 h-3 rounded-full flex-shrink-0"
					style={{ backgroundColor: definition.color }}
				/>
				<span className="font-medium text-sm">{definition.name}</span>
			</div>
			<p className="text-xs text-muted-foreground mt-1 ml-5">
				{sliceDuration.toFixed(2)}s slice
			</p>
		</button>
	);
}
