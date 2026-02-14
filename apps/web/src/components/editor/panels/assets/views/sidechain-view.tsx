"use client";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HugeiconsIcon } from "@hugeicons/react";
import { PlusSignIcon, MoreVerticalIcon } from "@hugeicons/core-free-icons";
import { useEditor } from "@/hooks/use-editor";
import { useSidechainStore } from "@/stores/sidechain-store";
import type { SidechainConfig } from "@/types/sidechain";
import {
	DeleteSidechainCommand,
	UpdateSidechainCommand,
} from "@/lib/commands";
import { useState, useEffect, useRef, useCallback } from "react";
import { SidechainConfigDialog } from "@/components/editor/dialogs/sidechain-config-dialog";
import { getTrackDisplayName } from "@/lib/timeline/track-utils";

export function SidechainView() {
	const { startCreating } = useSidechainStore();

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="px-3 pb-2">
				<Button onClick={startCreating} className="w-full">
					<HugeiconsIcon icon={PlusSignIcon} />
					Create Sidechain
				</Button>
			</div>

			<ScrollArea className="flex-1 min-h-0 px-5">
				<SidechainList />
			</ScrollArea>

			<SidechainConfigDialog />
		</div>
	);
}

function SidechainList() {
	const editor = useEditor();
	const [, forceUpdate] = useState({});

	useEffect(() => {
		const unsubscribe = editor.sidechain.subscribe(() => {
			forceUpdate({});
		});
		return unsubscribe;
	}, [editor.sidechain]);

	const configs = editor.sidechain.getConfigs();

	if (configs.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
				<p className="text-sm">No sidechain configs yet</p>
				<p className="text-xs mt-1">Create a sidechain to duck audio tracks</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-3 pb-4">
			{configs.map((config) => (
				<SidechainCard key={config.id} config={config} />
			))}
		</div>
	);
}

function SidechainCard({ config }: { config: SidechainConfig }) {
	const editor = useEditor();
	const { startEditing } = useSidechainStore();
	const allTracks = editor.timeline.getTracks();

	let sourceName: string;
	const { source } = config;
	if (source.type === "track") {
		const sourceTrack = allTracks.find((t) => t.id === source.trackId);
		sourceName = sourceTrack
			? getTrackDisplayName(sourceTrack, allTracks)
			: "Unknown";
	} else {
		const def = editor.oneshot.getDefinition(source.definitionId);
		sourceName = def ? `Oneshot: ${def.name}` : "Unknown";
	}

	const targetCount =
		config.targetTrackIds.length +
		(config.targetOneshotDefinitionIds?.length ?? 0);

	const handleDelete = () => {
		if (confirm(`Delete sidechain "${config.name}"?`)) {
			editor.command.execute(new DeleteSidechainCommand(config.id));
		}
	};

	const handleToggleEnabled = (checked: boolean) => {
		editor.command.execute(
			new UpdateSidechainCommand(config.id, { enabled: checked }),
		);
	};

	return (
		<div className="border rounded-lg p-3 bg-card">
			<div className="flex items-start justify-between gap-2">
				<div className="flex-1 min-w-0">
					<h4 className="font-medium text-sm truncate">{config.name}</h4>
					<p className="text-xs text-muted-foreground mt-0.5">
						Source: {sourceName}
					</p>
					<p className="text-xs text-muted-foreground">
						{targetCount} target(s)
					</p>
				</div>

				<div className="flex items-center gap-1">
					<Switch
						checked={config.enabled}
						onCheckedChange={handleToggleEnabled}
					/>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="sm" className="h-8 w-8 p-0">
								<HugeiconsIcon icon={MoreVerticalIcon} className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onClick={() => startEditing(config.id)}>
								Edit
							</DropdownMenuItem>
							<DropdownMenuItem onClick={handleDelete} className="text-destructive">
								Delete
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>

			{/* Params summary */}
			<div className="mt-2 grid grid-cols-3 gap-1">
				<ParamBadge label="Thresh" value={`${config.params.threshold}dB`} />
				<ParamBadge label="Ratio" value={`${config.params.ratio}:1`} />
				<ParamBadge label="Depth" value={`${config.params.depth}dB`} />
			</div>

			{/* Envelope preview */}
			<EnvelopePreview configId={config.id} />
		</div>
	);
}

function ParamBadge({ label, value }: { label: string; value: string }) {
	return (
		<div className="text-xs bg-muted/50 rounded px-1.5 py-1 text-center">
			<span className="text-muted-foreground">{label}: </span>
			<span className="font-medium">{value}</span>
		</div>
	);
}

function EnvelopePreview({ configId }: { configId: string }) {
	const editor = useEditor();
	const canvasRef = useRef<HTMLCanvasElement>(null);

	const drawEnvelope = useCallback(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const envelope = editor.sidechain.getCachedEnvelope(configId);
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const { width, height } = canvas;
		ctx.clearRect(0, 0, width, height);

		if (!envelope || envelope.gainValues.length === 0) {
			ctx.fillStyle = "rgba(128, 128, 128, 0.3)";
			ctx.fillRect(0, 0, width, height);
			ctx.fillStyle = "rgba(128, 128, 128, 0.6)";
			ctx.font = "10px sans-serif";
			ctx.textAlign = "center";
			ctx.fillText("No envelope data", width / 2, height / 2 + 3);
			return;
		}

		const values = envelope.gainValues;
		const step = values.length / width;

		// Draw background
		ctx.fillStyle = "rgba(128, 128, 128, 0.1)";
		ctx.fillRect(0, 0, width, height);

		// Draw gain curve
		ctx.beginPath();
		ctx.moveTo(0, height);

		for (let x = 0; x < width; x++) {
			const idx = Math.floor(x * step);
			const gain = idx < values.length ? values[idx] : 1;
			const y = height - gain * height;
			ctx.lineTo(x, y);
		}

		ctx.lineTo(width, height);
		ctx.closePath();
		ctx.fillStyle = "rgba(59, 130, 246, 0.3)";
		ctx.fill();

		// Draw gain line
		ctx.beginPath();
		for (let x = 0; x < width; x++) {
			const idx = Math.floor(x * step);
			const gain = idx < values.length ? values[idx] : 1;
			const y = height - gain * height;
			if (x === 0) ctx.moveTo(x, y);
			else ctx.lineTo(x, y);
		}
		ctx.strokeStyle = "rgba(59, 130, 246, 0.8)";
		ctx.lineWidth = 1;
		ctx.stroke();
	}, [editor.sidechain, configId]);

	useEffect(() => {
		drawEnvelope();
		const unsubscribe = editor.sidechain.subscribe(drawEnvelope);
		return unsubscribe;
	}, [editor.sidechain, drawEnvelope]);

	return (
		<canvas
			ref={canvasRef}
			width={240}
			height={40}
			className="mt-2 w-full rounded border bg-background"
			style={{ height: 40 }}
		/>
	);
}
