"use client";

import { useEditor } from "@/hooks/use-editor";
import { useState, useEffect } from "react";

export function AutomationMarkerBadge({
	trackId,
	elementId,
}: {
	trackId: string;
	elementId: string;
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

	const markers = editor.automation.getMarkersForElement(trackId, elementId);

	if (markers.length === 0) return null;

	return (
		<div
			className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium shadow-sm"
			title={`${markers.length} automation marker(s)`}
		>
			A
		</div>
	);
}
