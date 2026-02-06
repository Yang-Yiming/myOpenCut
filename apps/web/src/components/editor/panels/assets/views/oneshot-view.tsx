"use client";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HugeiconsIcon } from "@hugeicons/react";
import { PlusSignIcon, MoreVerticalIcon, ArrowDown01Icon, ArrowUp01Icon } from "@hugeicons/core-free-icons";
import { useEditor } from "@/hooks/use-editor";
import { useOneshotStore } from "@/stores/oneshot-store";
import type { OneshotDefinition } from "@/types/oneshot";
import { DeleteOneshotCommand, DeleteOneshotMarkerCommand } from "@/lib/commands";
import { useState, useEffect } from "react";
import { OneshotDefinitionDialog } from "@/components/editor/dialogs/oneshot-definition-dialog";
import { OneshotSelectionDialog } from "@/components/editor/dialogs/oneshot-selection-dialog";

export function OneshotView() {
	const { startCreatingOneshot } = useOneshotStore();

	return (
		<div className="flex h-full min-h-0 flex-col">
			{/* Header with Create button */}
			<div className="px-3 pb-2">
				<Button onClick={startCreatingOneshot} className="w-full">
					<HugeiconsIcon icon={PlusSignIcon} />
					Create Oneshot
				</Button>
			</div>

			{/* Oneshots list */}
			<ScrollArea className="flex-1 min-h-0 px-5">
				<OneshotsList />
			</ScrollArea>

			{/* Dialog for creating/editing oneshots */}
			<OneshotDefinitionDialog />

			{/* Dialog for selecting oneshot when pressing O without mark mode */}
			<OneshotSelectionDialog />
		</div>
	);
}

function OneshotsList() {
	const editor = useEditor();
	const [, forceUpdate] = useState({});

	// Subscribe to oneshot changes
	useEffect(() => {
		const unsubscribe = editor.oneshot.subscribe(() => {
			forceUpdate({});
		});
		return unsubscribe;
	}, [editor.oneshot]);

	const definitions = editor.oneshot.getDefinitions();

	if (definitions.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
				<p className="text-sm">No oneshots yet</p>
				<p className="text-xs mt-1">Create a oneshot to get started</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-3 pb-4">
			{definitions.map((definition) => (
				<OneshotCard key={definition.id} definition={definition} />
			))}
		</div>
	);
}

function OneshotCard({ definition }: { definition: OneshotDefinition }) {
	const editor = useEditor();
	const { isMarkModeActive, activeOneshotId, enterMarkMode, exitMarkMode } =
		useOneshotStore();
	const { startEditingOneshot } = useOneshotStore();
	const isActive = isMarkModeActive && activeOneshotId === definition.id;

	const handleDelete = () => {
		if (confirm(`Delete oneshot "${definition.name}"?`)) {
			editor.command.execute(new DeleteOneshotCommand(definition.id));
		}
	};

	const handleEdit = () => {
		startEditingOneshot(definition.id);
	};

	const handleToggleMarkMode = () => {
		if (isActive) {
			exitMarkMode();
		} else {
			enterMarkMode(definition.id);
		}
	};

	const sliceDuration = definition.trimEnd - definition.trimStart;

	return (
		<div className="border rounded-lg p-3 bg-card">
			<div className="flex items-start justify-between gap-2">
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2">
						<div
							className="w-3 h-3 rounded-full flex-shrink-0"
							style={{ backgroundColor: definition.color }}
						/>
						<h4 className="font-medium text-sm truncate">{definition.name}</h4>
					</div>
					<p className="text-xs text-muted-foreground mt-1">
						{definition.audioSource.name}
					</p>
					<p className="text-xs text-muted-foreground">
						{sliceDuration.toFixed(2)}s slice, cue at {definition.cuePoint.toFixed(2)}s
					</p>
				</div>

				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" size="sm" className="h-8 w-8 p-0">
							<HugeiconsIcon icon={MoreVerticalIcon} className="h-4 w-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onClick={handleEdit}>Edit</DropdownMenuItem>
						<DropdownMenuItem onClick={handleDelete} className="text-destructive">
							Delete
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			{/* Mark Mode button */}
			<div className="mt-3">
				<Button
					variant={isActive ? "default" : "outline"}
					size="sm"
					onClick={handleToggleMarkMode}
					className="w-full"
				>
					{isActive ? "Exit Mark Mode" : "Enter Mark Mode (O)"}
				</Button>
			</div>

			{/* Markers list */}
			<OneshotMarkersList definitionId={definition.id} />
		</div>
	);
}

function OneshotMarkersList({ definitionId }: { definitionId: string }) {
	const editor = useEditor();
	const markers = editor.oneshot.getMarkersForDefinition(definitionId);
	const [isCollapsed, setIsCollapsed] = useState(true);

	if (markers.length === 0) return null;

	const handleRemoveMarker = (markerId: string) => {
		editor.command.execute(new DeleteOneshotMarkerCommand(markerId));
	};

	const formatTime = (seconds: number) => {
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		const ms = Math.floor((seconds % 1) * 100);
		return `${mins}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
	};

	return (
		<div className="mt-3 pt-3 border-t">
			<button
				type="button"
				onClick={() => setIsCollapsed(!isCollapsed)}
				className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground w-full"
			>
				<HugeiconsIcon
					icon={isCollapsed ? ArrowDown01Icon : ArrowUp01Icon}
					className="h-3 w-3"
				/>
				Markers ({markers.length})
			</button>
			{!isCollapsed && (
				<div className="space-y-1 mt-2">
					{markers.map((marker) => (
						<div
							key={marker.id}
							className="flex items-center justify-between text-xs bg-muted/30 rounded px-2 py-1.5"
						>
							<span className="text-muted-foreground">
								{formatTime(marker.time)}
							</span>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => handleRemoveMarker(marker.id)}
								className="h-6 px-2 text-xs"
							>
								Remove
							</Button>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
