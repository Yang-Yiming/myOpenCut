"use client";

import { useEditor } from "@/hooks/use-editor";
import { useState, useEffect, useRef, useMemo } from "react";
import { useTimelineScroll } from "@/contexts/timeline-scroll-context";

interface AutomationMarkerBadgeProps {
	trackId: string;
	elementId: string;
	elementLeft: number;
	elementWidth: number;
}

export function AutomationMarkerBadge({
	trackId,
	elementId,
	elementLeft,
	elementWidth,
}: AutomationMarkerBadgeProps) {
	const editor = useEditor();
	const [, forceUpdate] = useState({});
	const badgeRef = useRef<HTMLDivElement>(null);
	const [badgeWidth, setBadgeWidth] = useState(0);
	const { scrollLeft } = useTimelineScroll();

	// Subscribe to automation changes
	useEffect(() => {
		const unsubscribe = editor.automation.subscribe(() => {
			forceUpdate({});
		});
		return unsubscribe;
	}, [editor.automation]);

	const markers = editor.automation.getMarkersForElement(trackId, elementId);

	// Get display text based on automation state names
	const displayText = useMemo(() => {
		if (markers.length === 0) return "";

		const names = [
			...new Set(
				markers
					.map((m) => editor.automation.getState(m.stateId)?.name)
					.filter(Boolean),
			),
		];

		if (names.length === 0) return "A";
		if (names.length === 1) return names[0];
		return `${names[0]} +${names.length - 1}`;
	}, [markers, editor.automation]);

	// Measure badge width after render
	useEffect(() => {
		if (badgeRef.current) {
			setBadgeWidth(badgeRef.current.offsetWidth);
		}
	}, [displayText]);

	if (markers.length === 0) return null;

	// Calculate sticky position
	const calculateBadgePosition = () => {
		const elementRight = elementLeft + elementWidth;
		const visibleLeft = Math.max(elementLeft, scrollLeft);
		const visibleWidth = elementRight - visibleLeft;

		// Hide if visible width < badge width (with some padding)
		if (visibleWidth < badgeWidth + 8) {
			return { visible: false, left: 0 };
		}

		// Normal position if left edge is visible
		if (elementLeft >= scrollLeft) {
			return { visible: true, left: 4 };
		}

		// Sticky position when left edge is scrolled out
		const stickyLeft = Math.min(
			scrollLeft - elementLeft + 4,
			elementWidth - badgeWidth - 4,
		);
		return { visible: true, left: stickyLeft };
	};

	const { visible, left } = calculateBadgePosition();

	if (!visible) return null;

	return (
		<div
			ref={badgeRef}
			className="absolute top-1 bg-primary text-primary-foreground rounded-sm px-1.5 py-0.5 text-[10px] font-medium shadow-sm whitespace-nowrap z-20 pointer-events-none"
			style={{ left: `${left}px` }}
			title={`${markers.length} automation marker(s)`}
		>
			{displayText}
		</div>
	);
}
