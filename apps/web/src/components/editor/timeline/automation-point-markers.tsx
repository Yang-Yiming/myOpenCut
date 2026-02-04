"use client";

import { useEditor } from "@/hooks/use-editor";
import { useState, useEffect } from "react";
import type { PointMarker } from "@/types/automation";
import { RemoveAutomationMarkerCommand } from "@/lib/commands";
import { TIMELINE_CONSTANTS } from "@/constants/timeline-constants";

export function AutomationPointMarkers({
	zoomLevel,
}: {
	zoomLevel: number;
}) {
	const editor = useEditor();
	const [, forceUpdate] = useState({});

	// Subscribe to automation changes
	useEffect(() => {
		const unsubscribe = editor.automation.subscribe(() => {
			forceUpdate({});
		});
		return unsubscribe;
	}, [editor.automation]);

	const markers = editor.automation
		.getMarkers()
		.filter((m) => m.type === "point") as PointMarker[];

	const handleRemoveMarker = (markerId: string) => {
		editor.command.execute(new RemoveAutomationMarkerCommand(markerId));
	};

	const getStateName = (stateId: string) => {
		return editor.automation.getState(stateId)?.name || "A";
	};

	return (
		<>
			{markers.map((marker) => (
				<div
					key={marker.id}
					className="absolute top-0 bottom-0 w-0.5 bg-primary cursor-pointer hover:bg-primary/80 transition-colors"
					style={{
						left: `${marker.time * TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel}px`,
					}}
					onClick={() => handleRemoveMarker(marker.id)}
					title="Click to remove automation marker"
				>
					<div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-primary rounded-full border-2 border-background" />
					<div className="absolute top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground rounded-sm px-1.5 py-0.5 text-[10px] font-medium shadow-sm whitespace-nowrap">
						{getStateName(marker.stateId)}
					</div>
				</div>
			))}
		</>
	);
}
