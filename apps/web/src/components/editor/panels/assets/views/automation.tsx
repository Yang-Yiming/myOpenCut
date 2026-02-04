"use client";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
	Tabs,
	TabsList,
	TabsTrigger,
	TabsContent,
} from "@/components/ui/tabs";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HugeiconsIcon } from "@hugeicons/react";
import { PlusSignIcon, MoreVerticalIcon } from "@hugeicons/core-free-icons";
import { useEditor } from "@/hooks/use-editor";
import { useAutomationStore } from "@/stores/automation-store";
import type { AutomationState } from "@/types/automation";
import {
	DeleteAutomationStateCommand,
	RemoveAutomationMarkerCommand,
} from "@/lib/commands";
import { useState, useEffect } from "react";
import { AutomationStateDialog } from "@/components/editor/dialogs/automation-state-dialog";
import { AutomationStateSelectionDialog } from "@/components/editor/dialogs/automation-state-selection-dialog";
import { getTrackDisplayName } from "@/lib/timeline/track-utils";
import { OneshotView } from "./oneshot-view";

export function AutomationView() {
	const { startCreatingState } = useAutomationStore();

	return (
		<div className="flex h-full flex-col">
			{/* Tabs */}
			<Tabs defaultValue="state" className="flex h-full flex-col">
				<div className="px-3 pt-4 pb-2">
					<TabsList className="w-full">
						<TabsTrigger value="state" className="flex-1">
							State
						</TabsTrigger>
						<TabsTrigger value="oneshot" className="flex-1">
							Oneshot
						</TabsTrigger>
					</TabsList>
				</div>

				<Separator className="my-2" />

				{/* State Tab Content */}
				<TabsContent value="state" className="flex-1 flex flex-col mt-0">
					{/* Header with Create button */}
					<div className="px-3 pb-2">
						<Button onClick={startCreatingState} className="w-full">
							<HugeiconsIcon icon={PlusSignIcon} />
							Create State
						</Button>
					</div>

					<Separator className="my-4" />

					{/* States list */}
					<ScrollArea className="flex-1 px-5">
						<AutomationStatesList />
					</ScrollArea>
				</TabsContent>

				{/* Oneshot Tab Content */}
				<TabsContent value="oneshot" className="flex-1 flex flex-col mt-0">
					<OneshotView />
				</TabsContent>
			</Tabs>

			{/* Dialog for creating/editing states */}
			<AutomationStateDialog />

			{/* Dialog for selecting state when pressing H without mark mode */}
			<AutomationStateSelectionDialog />
		</div>
	);
}

function AutomationStatesList() {
	const editor = useEditor();
	const [, forceUpdate] = useState({});

	// Subscribe to automation changes
	useEffect(() => {
		const unsubscribe = editor.automation.subscribe(() => {
			forceUpdate({});
		});
		return unsubscribe;
	}, [editor.automation]);

	const states = editor.automation.getStates();

	if (states.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
				<p className="text-sm">No automation states yet</p>
				<p className="text-xs mt-1">Create a state to get started</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-3 pb-4">
			{states.map((state) => (
				<AutomationStateCard key={state.id} state={state} />
			))}
		</div>
	);
}

function AutomationStateCard({ state }: { state: AutomationState }) {
	const editor = useEditor();
	const { isMarkModeActive, activeMarkStateId, enterMarkMode, exitMarkMode } =
		useAutomationStore();
	const { startEditingState } = useAutomationStore();
	const isActive = isMarkModeActive && activeMarkStateId === state.id;
	const allTracks = editor.timeline.getTracks();

	const handleDelete = () => {
		if (confirm(`Delete automation state "${state.name}"?`)) {
			editor.command.execute(new DeleteAutomationStateCommand(state.id));
		}
	};

	const handleEdit = () => {
		startEditingState(state.id);
	};

	const handleToggleMarkMode = () => {
		if (isActive) {
			exitMarkMode();
		} else {
			enterMarkMode(state.id);
		}
	};

	return (
		<div className="border rounded-lg p-3 bg-card">
			<div className="flex items-start justify-between gap-2">
				<div className="flex-1 min-w-0">
					<h4 className="font-medium text-sm truncate">{state.name}</h4>
					{state.description && (
						<p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
							{state.description}
						</p>
					)}
					<p className="text-xs text-muted-foreground mt-1">
						{state.operations.length} operation(s)
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
					{isActive ? "✓ Mark Mode Active" : "Enter Mark Mode"}
				</Button>
			</div>

			{/* Operations list */}
			<div className="mt-3 space-y-1">
				{state.operations.map((op) => {
					const track = allTracks.find((t) => t.id === op.trackId);
					const trackDisplayName = track
						? getTrackDisplayName(track, allTracks)
						: `Track ${op.trackId}`;

					return (
						<div
							key={op.id}
							className="text-xs bg-muted/50 rounded px-2 py-1.5 flex items-center justify-between"
						>
							<span className="text-muted-foreground">{trackDisplayName}:</span>
							<span className="font-medium">{op.value}% volume</span>
						</div>
					);
				})}
			</div>

			{/* Markers list */}
			<AutomationMarkersList stateId={state.id} />
		</div>
	);
}

function AutomationMarkersList({ stateId }: { stateId: string }) {
	const editor = useEditor();
	const markers = editor.automation
		.getMarkers()
		.filter((m) => m.stateId === stateId);

	if (markers.length === 0) return null;

	const handleRemoveMarker = (markerId: string) => {
		editor.command.execute(new RemoveAutomationMarkerCommand(markerId));
	};

	const formatTime = (seconds: number) => {
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, "0")}`;
	};

	return (
		<div className="mt-3 pt-3 border-t">
			<p className="text-xs font-medium mb-2 text-muted-foreground">
				Applied to:
			</p>
			<div className="space-y-1">
				{markers.map((marker) => (
					<div
						key={marker.id}
						className="flex items-center justify-between text-xs bg-muted/30 rounded px-2 py-1.5"
					>
						<span className="text-muted-foreground">
							{marker.type === "range"
								? `Clip on track ${marker.trackId}`
								: `Time ${formatTime(marker.time)}`}
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
		</div>
	);
}
