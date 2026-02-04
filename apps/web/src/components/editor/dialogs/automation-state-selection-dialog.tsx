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
import { useEditor } from "@/hooks/use-editor";
import { useAutomationStore } from "@/stores/automation-store";
import { useElementSelection } from "@/hooks/timeline/element/use-element-selection";
import { AddAutomationMarkerCommand } from "@/lib/commands";
import { HugeiconsIcon } from "@hugeicons/react";
import { PlusSignIcon } from "@hugeicons/core-free-icons";

export function AutomationStateSelectionDialog() {
	const editor = useEditor();
	const { selectedElements } = useElementSelection();
	const {
		isStateSelectionOpen,
		closeStateSelection,
		enterMarkMode,
		startCreatingState,
	} = useAutomationStore();

	const [states, setStates] = useState(editor.automation.getStates());

	useEffect(() => {
		const unsubscribe = editor.automation.subscribe(() => {
			setStates(editor.automation.getStates());
		});
		return unsubscribe;
	}, [editor.automation]);

	const handleSelectState = (stateId: string) => {
		if (selectedElements.length > 0) {
			// Mark selected clips directly
			for (const { trackId, elementId } of selectedElements) {
				editor.command.execute(
					new AddAutomationMarkerCommand({
						type: "range",
						stateId,
						trackId,
						elementId,
					}),
				);
			}
		} else {
			// Mark current timeline position
			const currentTime = editor.playback.getCurrentTime();
			editor.command.execute(
				new AddAutomationMarkerCommand({
					type: "point",
					stateId,
					time: currentTime,
				}),
			);
		}
		closeStateSelection();
	};

	const handleCreateNew = () => {
		closeStateSelection();
		startCreatingState();
	};

	return (
		<Dialog open={isStateSelectionOpen} onOpenChange={closeStateSelection}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>Select Automation State</DialogTitle>
				</DialogHeader>

				<DialogBody className="gap-2">
					{states.length === 0 ? (
						<p className="text-muted-foreground text-sm text-center py-4">
							No automation states created yet.
						</p>
					) : (
						<div className="flex flex-col gap-1">
							{states.map((state) => (
								<Button
									key={state.id}
									variant="ghost"
									className="justify-start h-auto py-3 px-4"
									onClick={() => handleSelectState(state.id)}
								>
									<div className="flex flex-col items-start gap-0.5">
										<span className="font-medium">{state.name}</span>
										{state.description && (
											<span className="text-muted-foreground text-xs">
												{state.description}
											</span>
										)}
									</div>
								</Button>
							))}
						</div>
					)}
				</DialogBody>

				<DialogFooter>
					<Button variant="outline" onClick={closeStateSelection}>
						Cancel
					</Button>
					<Button onClick={handleCreateNew}>
						<HugeiconsIcon icon={PlusSignIcon} />
						Create New
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
