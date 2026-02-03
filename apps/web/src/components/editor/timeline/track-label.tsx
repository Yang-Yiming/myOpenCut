"use client";

import { useState, useRef, useEffect } from "react";
import { useEditor } from "@/hooks/use-editor";
import { RenameTrackCommand } from "@/lib/commands";
import { getTrackDisplayName } from "@/lib/timeline/track-utils";
import type { TimelineTrack } from "@/types/timeline";
import { cn } from "@/utils/ui";

interface TrackLabelProps {
	track: TimelineTrack;
	allTracks: TimelineTrack[];
}

export function TrackLabel({ track, allTracks }: TrackLabelProps) {
	const editor = useEditor();
	const [isEditing, setIsEditing] = useState(false);
	const [editValue, setEditValue] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);

	const displayName = getTrackDisplayName(track, allTracks);

	useEffect(() => {
		if (isEditing && inputRef.current) {
			inputRef.current.focus();
			inputRef.current.select();
		}
	}, [isEditing]);

	const handleStartEdit = () => {
		setEditValue(track.name);
		setIsEditing(true);
	};

	const handleSave = () => {
		const trimmedValue = editValue.trim();
		if (trimmedValue && trimmedValue !== track.name) {
			editor.command.execute(new RenameTrackCommand(track.id, trimmedValue));
		}
		setIsEditing(false);
	};

	const handleCancel = () => {
		setIsEditing(false);
		setEditValue("");
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			e.preventDefault();
			handleSave();
		} else if (e.key === "Escape") {
			e.preventDefault();
			handleCancel();
		}
	};

	if (isEditing) {
		return (
			<input
				ref={inputRef}
				type="text"
				value={editValue}
				onChange={(e) => setEditValue(e.target.value)}
				onBlur={handleSave}
				onKeyDown={handleKeyDown}
				className={cn(
					"bg-background border-primary w-full rounded border px-1 py-0.5 text-xs",
					"focus:outline-none focus:ring-1 focus:ring-primary",
				)}
				maxLength={50}
			/>
		);
	}

	return (
		<span
			className="text-muted-foreground cursor-pointer truncate text-xs hover:text-foreground"
			onClick={handleStartEdit}
			title={`${displayName} (click to rename)`}
		>
			{displayName}
		</span>
	);
}
