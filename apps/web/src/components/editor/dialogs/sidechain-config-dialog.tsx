"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogBody,
	DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useEditor } from "@/hooks/use-editor";
import { useSidechainStore } from "@/stores/sidechain-store";
import {
	CreateSidechainCommand,
	UpdateSidechainCommand,
} from "@/lib/commands";
import {
	DEFAULT_SIDECHAIN_PARAMS,
	type SidechainParams,
	type SidechainSource,
} from "@/types/sidechain";
import { getTrackDisplayName } from "@/lib/timeline/track-utils";
import { canTracktHaveAudio } from "@/lib/timeline";

export function SidechainConfigDialog() {
	const editor = useEditor();
	const { isCreating, editingConfigId, cancelCreating, cancelEditing } =
		useSidechainStore();

	const isOpen = isCreating || editingConfigId !== null;
	const isEditing = editingConfigId !== null;

	const existingConfig = isEditing
		? editor.sidechain.getConfig(editingConfigId)
		: undefined;

	const [name, setName] = useState("");
	const [sourceType, setSourceType] = useState<"track" | "oneshot">("track");
	const [sourceTrackId, setSourceTrackId] = useState("");
	const [sourceOneshotId, setSourceOneshotId] = useState("");
	const [targetTrackIds, setTargetTrackIds] = useState<string[]>([]);
	const [targetOneshotDefinitionIds, setTargetOneshotDefinitionIds] = useState<string[]>([]);
	const [enabled, setEnabled] = useState(true);
	const [params, setParams] = useState<SidechainParams>({
		...DEFAULT_SIDECHAIN_PARAMS,
	});

	// Reset form when dialog opens
	useEffect(() => {
		if (isOpen) {
			if (existingConfig) {
				setName(existingConfig.name);
				if (existingConfig.source.type === "track") {
					setSourceType("track");
					setSourceTrackId(existingConfig.source.trackId);
					setSourceOneshotId("");
				} else {
					setSourceType("oneshot");
					setSourceOneshotId(existingConfig.source.definitionId);
					setSourceTrackId("");
				}
				setTargetTrackIds([...existingConfig.targetTrackIds]);
				setTargetOneshotDefinitionIds([...(existingConfig.targetOneshotDefinitionIds ?? [])]);
				setEnabled(existingConfig.enabled);
				setParams({ ...existingConfig.params });
			} else {
				setName("");
				setSourceType("track");
				setSourceTrackId("");
				setSourceOneshotId("");
				setTargetTrackIds([]);
				setTargetOneshotDefinitionIds([]);
				setEnabled(true);
				setParams({ ...DEFAULT_SIDECHAIN_PARAMS });
			}
		}
	}, [isOpen, existingConfig]);

	const handleClose = () => {
		if (isEditing) {
			cancelEditing();
		} else {
			cancelCreating();
		}
	};

	const handleSave = () => {
		const hasSource = sourceType === "track" ? !!sourceTrackId : !!sourceOneshotId;
		const hasTargets = targetTrackIds.length > 0 || targetOneshotDefinitionIds.length > 0;
		if (!name.trim() || !hasSource || !hasTargets) return;

		const source: SidechainSource =
			sourceType === "track"
				? { type: "track", trackId: sourceTrackId }
				: { type: "oneshot", definitionId: sourceOneshotId };

		if (isEditing && editingConfigId) {
			editor.command.execute(
				new UpdateSidechainCommand(editingConfigId, {
					name: name.trim(),
					source,
					targetTrackIds,
					targetOneshotDefinitionIds,
					params,
					enabled,
				}),
			);
		} else {
			editor.command.execute(
				new CreateSidechainCommand({
					name: name.trim(),
					source,
					targetTrackIds,
					targetOneshotDefinitionIds,
					params,
					enabled,
				}),
			);
		}

		handleClose();
	};

	const allTracks = editor.timeline.getTracks();
	const audioTracks = allTracks.filter((t) => canTracktHaveAudio(t));
	const oneshotDefinitions = editor.oneshot.getDefinitions();

	const handleTargetTrackToggle = (trackId: string, checked: boolean) => {
		if (checked) {
			setTargetTrackIds((prev) => [...prev, trackId]);
		} else {
			setTargetTrackIds((prev) => prev.filter((id) => id !== trackId));
		}
	};

	const handleTargetOneshotToggle = (defId: string, checked: boolean) => {
		if (checked) {
			setTargetOneshotDefinitionIds((prev) => [...prev, defId]);
		} else {
			setTargetOneshotDefinitionIds((prev) => prev.filter((id) => id !== defId));
		}
	};

	const hasSource = sourceType === "track" ? sourceTrackId.length > 0 : sourceOneshotId.length > 0;
	const hasTargets = targetTrackIds.length > 0 || targetOneshotDefinitionIds.length > 0;
	const canSave = name.trim().length > 0 && hasSource && hasTargets;

	// Filter out the current oneshot source from target oneshot list
	const targetableOneshotDefs = oneshotDefinitions.filter(
		(d) => !(sourceType === "oneshot" && d.id === sourceOneshotId),
	);

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
			<DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
				<DialogHeader>
					<DialogTitle>
						{isEditing ? "Edit Sidechain" : "Create Sidechain"}
					</DialogTitle>
				</DialogHeader>

				<DialogBody className="gap-4 flex-1 overflow-y-auto flex flex-col">
					{/* Name */}
					<div className="space-y-2">
						<Label>Name</Label>
						<Input
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="e.g. Kick Ducking"
						/>
					</div>

					{/* Source Type Selector */}
					<div className="space-y-2">
						<Label>Source Type (trigger)</Label>
						<div className="flex gap-2">
							<Button
								variant={sourceType === "track" ? "default" : "outline"}
								size="sm"
								onClick={() => setSourceType("track")}
							>
								Track
							</Button>
							<Button
								variant={sourceType === "oneshot" ? "default" : "outline"}
								size="sm"
								onClick={() => setSourceType("oneshot")}
								disabled={oneshotDefinitions.length === 0}
							>
								Oneshot
							</Button>
						</div>
					</div>

					{/* Source Selection */}
					<div className="space-y-2">
						<Label>
							{sourceType === "track" ? "Source Track" : "Source Oneshot"}
						</Label>
						{sourceType === "track" ? (
							<Select value={sourceTrackId} onValueChange={setSourceTrackId}>
								<SelectTrigger>
									<SelectValue placeholder="Select source track" />
								</SelectTrigger>
								<SelectContent>
									{audioTracks.map((track) => (
										<SelectItem key={track.id} value={track.id}>
											{getTrackDisplayName(track, allTracks)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						) : (
							<Select value={sourceOneshotId} onValueChange={setSourceOneshotId}>
								<SelectTrigger>
									<SelectValue placeholder="Select oneshot definition" />
								</SelectTrigger>
								<SelectContent>
									{oneshotDefinitions.map((def) => (
										<SelectItem key={def.id} value={def.id}>
											{def.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}
					</div>

					{/* Target Tracks */}
					<div className="space-y-2">
						<Label>Target Tracks (ducked)</Label>
						<div className="space-y-1.5 rounded border p-2">
							{audioTracks
								.filter((t) => !(sourceType === "track" && t.id === sourceTrackId))
								.map((track) => (
									<label
										key={track.id}
										className="flex items-center gap-2 text-sm cursor-pointer"
									>
										<Checkbox
											checked={targetTrackIds.includes(track.id)}
											onCheckedChange={(checked) =>
												handleTargetTrackToggle(track.id, !!checked)
											}
										/>
										{getTrackDisplayName(track, allTracks)}
									</label>
								))}
							{audioTracks.filter((t) => !(sourceType === "track" && t.id === sourceTrackId)).length === 0 && (
								<p className="text-xs text-muted-foreground">
									No audio tracks available
								</p>
							)}
						</div>
					</div>

					{/* Target Oneshots */}
					{targetableOneshotDefs.length > 0 && (
						<div className="space-y-2">
							<Label>Target Oneshots (ducked)</Label>
							<div className="space-y-1.5 rounded border p-2">
								{targetableOneshotDefs.map((def) => (
									<label
										key={def.id}
										className="flex items-center gap-2 text-sm cursor-pointer"
									>
										<Checkbox
											checked={targetOneshotDefinitionIds.includes(def.id)}
											onCheckedChange={(checked) =>
												handleTargetOneshotToggle(def.id, !!checked)
											}
										/>
										{def.name}
									</label>
								))}
							</div>
						</div>
					)}

					{/* Parameters */}
					<div className="space-y-3">
						<Label>Compression Parameters</Label>

						<ParamSlider
							label="Threshold"
							value={params.threshold}
							min={-60}
							max={0}
							step={1}
							unit="dB"
							onChange={(v) => setParams((p) => ({ ...p, threshold: v }))}
						/>

						<ParamSlider
							label="Ratio"
							value={params.ratio}
							min={1}
							max={20}
							step={0.5}
							unit=":1"
							onChange={(v) => setParams((p) => ({ ...p, ratio: v }))}
						/>

						<ParamSlider
							label="Attack"
							value={params.attack}
							min={0.001}
							max={0.5}
							step={0.001}
							unit="s"
							onChange={(v) => setParams((p) => ({ ...p, attack: v }))}
						/>

						<ParamSlider
							label="Release"
							value={params.release}
							min={0.01}
							max={2.0}
							step={0.01}
							unit="s"
							onChange={(v) => setParams((p) => ({ ...p, release: v }))}
						/>

						<ParamSlider
							label="Depth"
							value={params.depth}
							min={-60}
							max={0}
							step={1}
							unit="dB"
							onChange={(v) => setParams((p) => ({ ...p, depth: v }))}
						/>
					</div>

					{/* Enable toggle */}
					<div className="flex items-center justify-between">
						<Label>Enabled</Label>
						<Switch checked={enabled} onCheckedChange={setEnabled} />
					</div>

					{/* Envelope Preview */}
					<EnvelopePreviewCanvas
						configId={editingConfigId}
						params={params}
						sourceType={sourceType}
						sourceTrackId={sourceTrackId}
						sourceOneshotId={sourceOneshotId}
					/>
				</DialogBody>

				<DialogFooter>
					<Button variant="outline" onClick={handleClose}>
						Cancel
					</Button>
					<Button onClick={handleSave} disabled={!canSave}>
						{isEditing ? "Save" : "Create"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function ParamSlider({
	label,
	value,
	min,
	max,
	step,
	unit,
	onChange,
}: {
	label: string;
	value: number;
	min: number;
	max: number;
	step: number;
	unit: string;
	onChange: (value: number) => void;
}) {
	return (
		<div className="space-y-1">
			<div className="flex items-center justify-between text-xs">
				<span className="text-muted-foreground">{label}</span>
				<span className="font-medium tabular-nums">
					{value}
					{unit}
				</span>
			</div>
			<Slider
				value={[value]}
				min={min}
				max={max}
				step={step}
				onValueChange={([v]) => onChange(v)}
			/>
		</div>
	);
}

function EnvelopePreviewCanvas({
	configId,
	params,
	sourceType,
	sourceTrackId,
	sourceOneshotId,
}: {
	configId: string | null;
	params: SidechainParams;
	sourceType: "track" | "oneshot";
	sourceTrackId: string;
	sourceOneshotId: string;
}) {
	const editor = useEditor();
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const { isComputingEnvelope, setComputingEnvelope } = useSidechainStore();

	const hasSource = sourceType === "track" ? !!sourceTrackId : !!sourceOneshotId;

	const handlePreview = useCallback(async () => {
		if (!hasSource) return;

		setComputingEnvelope(true);
		try {
			const { computeSidechainEnvelope } = await import(
				"@/lib/sidechain/compute-envelope"
			);
			const duration = editor.timeline.getTotalDuration();

			let elements: Array<{
				buffer: AudioBuffer;
				startTime: number;
				trimStart: number;
				duration: number;
				loop: boolean;
			}>;

			if (sourceType === "track") {
				const tracks = editor.timeline.getTracks();
				const sourceTrack = tracks.find((t) => t.id === sourceTrackId);
				if (!sourceTrack) return;

				const mediaAssets = editor.media.getAssets();
				const { collectAudioElements, createAudioContext } =
					await import("@/lib/media/audio");
				const audioContext = createAudioContext();
				const audioElements = await collectAudioElements({
					tracks: [sourceTrack],
					mediaAssets,
					audioContext,
				});

				elements = audioElements.map((el) => ({
					buffer: el.buffer,
					startTime: el.startTime,
					trimStart: el.trimStart,
					duration: el.duration,
					loop: el.loop ?? false,
				}));
			} else {
				const buffer = await editor.oneshot.loadAudioBuffer(sourceOneshotId);
				if (!buffer) return;

				const definition = editor.oneshot.getDefinition(sourceOneshotId);
				if (!definition) return;

				const markers = editor.oneshot.getMarkersForDefinition(sourceOneshotId);
				const sliceDuration = definition.trimEnd - definition.trimStart;

				elements = markers.map((marker) => {
					const audioStartTime = editor.oneshot.getAudioStartTimeForMarker(marker);
					return {
						buffer,
						startTime: audioStartTime ?? marker.time,
						trimStart: definition.trimStart,
						duration: sliceDuration,
						loop: false,
					};
				});
			}

			const envelope = computeSidechainEnvelope(elements, duration, params);
			drawEnvelope(canvasRef.current, envelope);
		} catch (error) {
			console.error("Failed to preview envelope:", error);
		} finally {
			setComputingEnvelope(false);
		}
	}, [configId, params, sourceType, sourceTrackId, sourceOneshotId, editor, hasSource, setComputingEnvelope]);

	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between">
				<Label>Envelope Preview</Label>
				<Button
					variant="outline"
					size="sm"
					onClick={handlePreview}
					disabled={!hasSource || isComputingEnvelope}
				>
					{isComputingEnvelope ? "Computing..." : "Preview"}
				</Button>
			</div>
			<canvas
				ref={canvasRef}
				width={400}
				height={60}
				className="w-full rounded border bg-background"
				style={{ height: 60 }}
			/>
		</div>
	);
}

function drawEnvelope(
	canvas: HTMLCanvasElement | null,
	envelope: { gainValues: Float32Array; duration: number; sampleRate: number },
) {
	if (!canvas) return;

	const ctx = canvas.getContext("2d");
	if (!ctx) return;

	const { width, height } = canvas;
	ctx.clearRect(0, 0, width, height);

	const values = envelope.gainValues;
	if (values.length === 0) return;

	const step = values.length / width;

	// Background
	ctx.fillStyle = "rgba(128, 128, 128, 0.1)";
	ctx.fillRect(0, 0, width, height);

	// Fill area
	ctx.beginPath();
	ctx.moveTo(0, height);
	for (let x = 0; x < width; x++) {
		const idx = Math.floor(x * step);
		const gain = idx < values.length ? values[idx] : 1;
		ctx.lineTo(x, height - gain * height);
	}
	ctx.lineTo(width, height);
	ctx.closePath();
	ctx.fillStyle = "rgba(59, 130, 246, 0.3)";
	ctx.fill();

	// Line
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
}
