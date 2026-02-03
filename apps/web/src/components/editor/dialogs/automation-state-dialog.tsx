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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { HugeiconsIcon } from "@hugeicons/react";
import { PlusSignIcon, Delete02Icon } from "@hugeicons/core-free-icons";
import { useEditor } from "@/hooks/use-editor";
import { useAutomationStore } from "@/stores/automation-store";
import type { AudioVolumeOperation, AutomationState } from "@/types/automation";
import {
	CreateAutomationStateCommand,
	UpdateAutomationStateCommand,
} from "@/lib/commands";
import { nanoid } from "nanoid";
import { getTrackDisplayName } from "@/lib/timeline/track-utils";

export function AutomationStateDialog() {
	const editor = useEditor();
	const {
		isCreatingState,
		editingStateId,
		cancelCreatingState,
		cancelEditingState,
	} = useAutomationStore();

	const isOpen = isCreatingState || editingStateId !== null;
	const mode = isCreatingState ? "create" : "edit";

	const existingState = editingStateId
		? editor.automation.getState(editingStateId)
		: undefined;

	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [operations, setOperations] = useState<AudioVolumeOperation[]>([]);

	// Initialize form when dialog opens
	useEffect(() => {
		if (isOpen) {
			if (existingState) {
				setName(existingState.name);
				setDescription(existingState.description || "");
				setOperations([...existingState.operations]);
			} else {
				setName("");
				setDescription("");
				setOperations([]);
			}
		}
	}, [isOpen, existingState]);

	const handleClose = () => {
		if (isCreatingState) {
			cancelCreatingState();
		} else {
			cancelEditingState();
		}
	};

	const handleSave = () => {
		if (!name.trim()) {
			alert("Please enter a name for the automation state");
			return;
		}

		if (operations.length === 0) {
			alert("Please add at least one operation");
			return;
		}

		const stateData = {
			name: name.trim(),
			description: description.trim() || undefined,
			operations,
		};

		if (mode === "create") {
			editor.command.execute(new CreateAutomationStateCommand(stateData));
		} else if (editingStateId) {
			editor.command.execute(
				new UpdateAutomationStateCommand(editingStateId, stateData),
			);
		}

		handleClose();
	};

	const addOperation = () => {
		const audioTracks = editor.timeline
			.getTracks()
			.filter((t) => t.type === "audio");

		if (audioTracks.length === 0) {
			alert("No audio tracks available. Add an audio track first.");
			return;
		}

		const newOperation: AudioVolumeOperation = {
			id: nanoid(),
			type: "audio-volume",
			trackId: audioTracks[0].id,
			value: 50,
		};

		setOperations([...operations, newOperation]);
	};

	const updateOperation = (index: number, updated: AudioVolumeOperation) => {
		const newOperations = [...operations];
		newOperations[index] = updated;
		setOperations(newOperations);
	};

	const removeOperation = (index: number) => {
		setOperations(operations.filter((_, i) => i !== index));
	};

	return (
		<Dialog open={isOpen} onOpenChange={handleClose}>
			<DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>
						{mode === "create" ? "Create" : "Edit"} Automation State
					</DialogTitle>
				</DialogHeader>

				<DialogBody className="gap-4">
					{/* Name input */}
					<div className="space-y-2">
						<Label htmlFor="name">Name</Label>
						<Input
							id="name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="e.g., Lower Background Music"
						/>
					</div>

					{/* Description input */}
					<div className="space-y-2">
						<Label htmlFor="description">Description (optional)</Label>
						<Textarea
							id="description"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder="Describe what this automation does..."
							rows={2}
						/>
					</div>

					{/* Operations */}
					<div className="space-y-2">
						<Label>Operations</Label>
						<div className="space-y-2">
							{operations.map((op, idx) => (
								<OperationEditor
									key={op.id}
									operation={op}
									onChange={(updated) => updateOperation(idx, updated)}
									onRemove={() => removeOperation(idx)}
								/>
							))}
						</div>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={addOperation}
							className="w-full"
						>
							<HugeiconsIcon icon={PlusSignIcon} />
							Add Operation
						</Button>
					</div>
				</DialogBody>

				<DialogFooter>
					<Button variant="outline" onClick={handleClose}>
						Cancel
					</Button>
					<Button onClick={handleSave}>
						{mode === "create" ? "Create" : "Save"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function OperationEditor({
	operation,
	onChange,
	onRemove,
}: {
	operation: AudioVolumeOperation;
	onChange: (updated: AudioVolumeOperation) => void;
	onRemove: () => void;
}) {
	const editor = useEditor();
	const audioTracks = editor.timeline
		.getTracks()
		.filter((t) => t.type === "audio");
	const allTracks = editor.timeline.getTracks();

	return (
		<div className="flex gap-2 items-center p-3 border rounded-lg bg-muted/30">
			{/* Track selector */}
			<div className="flex-1">
				<Select
					value={operation.trackId}
					onValueChange={(trackId) => onChange({ ...operation, trackId })}
				>
					<SelectTrigger className="w-full">
						<SelectValue placeholder="Select track" />
					</SelectTrigger>
					<SelectContent>
						{audioTracks.map((track) => (
							<SelectItem key={track.id} value={track.id}>
								{getTrackDisplayName(track, allTracks)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			{/* Volume slider */}
			<div className="flex-1 flex items-center gap-2">
				<Slider
					value={[operation.value]}
					onValueChange={([value]) => onChange({ ...operation, value })}
					min={0}
					max={100}
					step={1}
					className="flex-1"
				/>
				<span className="text-sm font-medium w-12 text-right">
					{operation.value}%
				</span>
			</div>

			{/* Remove button */}
			<Button
				variant="ghost"
				size="sm"
				onClick={onRemove}
				className="h-8 w-8 p-0"
			>
				<HugeiconsIcon icon={Delete02Icon} className="h-4 w-4" />
			</Button>
		</div>
	);
}
