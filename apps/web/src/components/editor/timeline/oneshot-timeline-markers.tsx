"use client";

import { useEditor } from "@/hooks/use-editor";
import { useState, useEffect } from "react";
import { DeleteOneshotMarkerCommand } from "@/lib/commands";
import { TIMELINE_CONSTANTS } from "@/constants/timeline-constants";

export function OneshotTimelineMarkers({
	zoomLevel,
}: {
	zoomLevel: number;
}) {
	const editor = useEditor();
	const [, forceUpdate] = useState({});

	// Subscribe to oneshot changes
	useEffect(() => {
		const unsubscribe = editor.oneshot.subscribe(() => {
			forceUpdate({});
		});
		return unsubscribe;
	}, [editor.oneshot]);

	const markers = editor.oneshot.getMarkers();

	const handleRemoveMarker = (markerId: string) => {
		editor.command.execute(new DeleteOneshotMarkerCommand(markerId));
	};

	const getDefinition = (oneshotId: string) => {
		return editor.oneshot.getDefinition(oneshotId);
	};

	return (
		<>
			{markers.map((marker) => {
				const definition = getDefinition(marker.oneshotId);
				if (!definition) return null;

				return (
					<div
						key={marker.id}
						className="absolute top-0 bottom-0 w-0.5 cursor-pointer hover:opacity-80 transition-opacity"
						style={{
							left: `${marker.time * TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel}px`,
							backgroundColor: definition.color,
						}}
						onClick={() => handleRemoveMarker(marker.id)}
						title={`${definition.name} - Click to remove`}
					>
						<div
							className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-background"
							style={{ backgroundColor: definition.color }}
						/>
						<div
							className="absolute top-4 left-1/2 -translate-x-1/2 text-white rounded-sm px-1.5 py-0.5 text-[10px] font-medium shadow-sm whitespace-nowrap"
							style={{ backgroundColor: definition.color }}
						>
							{definition.name.slice(0, 8)}
						</div>
					</div>
				);
			})}
		</>
	);
}
