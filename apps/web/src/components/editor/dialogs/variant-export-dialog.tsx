"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogBody,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { PropertyGroup } from "@/components/editor/panels/properties/property-item";
import { useEditor } from "@/hooks/use-editor";
import { Download, Video, Music, Type, Smile } from "lucide-react";
import type { TimelineTrack, TrackType } from "@/types/timeline";
import type {
	TimeRemapConfig,
	TrackTimeBehavior,
	TrackRemapConfig,
	MarkerTriggerBehavior,
	MarkerPlaybackBehavior,
	TimeRemapPreset,
} from "@/types/time-remap";
import {
	TIME_REMAP_PRESETS,
	createConfigFromPreset,
	getDefaultTimeRemapConfig,
} from "@/types/time-remap";
import { getRemappedDuration } from "@/lib/time-remap";
import { getExportMimeType, getExportFileExtension } from "@/lib/export";
import type { ExportFormat, ExportQuality, ExportResult } from "@/types/export";
import { DEFAULT_EXPORT_OPTIONS } from "@/constants/export-constants";

const TIME_SCALE_OPTIONS = [
	{ value: "0.25", label: "0.25x (4x duration)" },
	{ value: "0.5", label: "0.5x (2x duration)" },
	{ value: "0.75", label: "0.75x" },
	{ value: "1", label: "1x (Original)" },
	{ value: "1.5", label: "1.5x" },
	{ value: "2", label: "2x (0.5x duration)" },
	{ value: "4", label: "4x (0.25x duration)" },
];

const TRACK_BEHAVIOR_OPTIONS: { value: TrackTimeBehavior; label: string }[] = [
	{ value: "stretch", label: "Stretch" },
	{ value: "pitch-preserve", label: "Pitch Preserve" },
	{ value: "loop", label: "Loop" },
	{ value: "fixed", label: "Fixed" },
];

const TRIGGER_BEHAVIOR_OPTIONS: { value: MarkerTriggerBehavior; label: string }[] = [
	{ value: "stretch", label: "Follow Scale" },
	{ value: "original", label: "Original Time" },
];

const PLAYBACK_BEHAVIOR_OPTIONS: { value: MarkerPlaybackBehavior; label: string }[] = [
	{ value: "stretch", label: "Follow Scale" },
	{ value: "original", label: "Original Speed" },
];

function getTrackIcon(type: TrackType) {
	switch (type) {
		case "video":
			return <Video className="size-4" />;
		case "audio":
			return <Music className="size-4" />;
		case "text":
			return <Type className="size-4" />;
		case "sticker":
			return <Smile className="size-4" />;
	}
}

function formatDuration(seconds: number): string {
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return `${mins}:${secs.toString().padStart(2, "0")}`;
}

interface VariantExportDialogProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
}

export function VariantExportDialog({
	isOpen,
	onOpenChange,
}: VariantExportDialogProps) {
	const editor = useEditor();
	const activeProject = editor.project.getActive();
	const tracks = editor.timeline.getTracks();
	const originalDuration = editor.timeline.getTotalDuration();

	const [timeScale, setTimeScale] = useState(0.5);
	const [trackConfigs, setTrackConfigs] = useState<TrackRemapConfig[]>([]);
	const [automationTrigger, setAutomationTrigger] = useState<MarkerTriggerBehavior>("stretch");
	const [automationPlayback, setAutomationPlayback] = useState<MarkerPlaybackBehavior>("original");
	const [oneshotTrigger, setOneshotTrigger] = useState<MarkerTriggerBehavior>("stretch");
	const [oneshotPlayback, setOneshotPlayback] = useState<MarkerPlaybackBehavior>("original");
	const [selectedPreset, setSelectedPreset] = useState<string>("slow-motion-bgm-loop");

	const [isExporting, setIsExporting] = useState(false);
	const [progress, setProgress] = useState(0);
	const [exportResult, setExportResult] = useState<ExportResult | null>(null);
	const cancelRequestedRef = useRef(false);

	// Initialize track configs when dialog opens
	useEffect(() => {
		if (isOpen && tracks.length > 0) {
			const preset = TIME_REMAP_PRESETS.find((p) => p.id === selectedPreset);
			if (preset) {
				applyPreset(preset);
			} else {
				const defaultConfig = getDefaultTimeRemapConfig(
					tracks.map((t) => ({ id: t.id, type: t.type }))
				);
				setTrackConfigs(defaultConfig.trackConfigs);
			}
		}
	}, [isOpen, tracks.length]);

	const applyPreset = (preset: TimeRemapPreset) => {
		setTimeScale(preset.config.timeScale);
		setAutomationTrigger(preset.config.automationMarkerConfig.triggerBehavior);
		setAutomationPlayback(preset.config.automationMarkerConfig.playbackBehavior);
		setOneshotTrigger(preset.config.oneshotMarkerConfig.triggerBehavior);
		setOneshotPlayback(preset.config.oneshotMarkerConfig.playbackBehavior);

		const newTrackConfigs = tracks.map((track) => ({
			trackId: track.id,
			behavior:
				track.type === "audio"
					? preset.config.defaultAudioBehavior
					: preset.config.defaultVideoBehavior,
		}));
		setTrackConfigs(newTrackConfigs);
	};

	const handlePresetChange = (presetId: string) => {
		setSelectedPreset(presetId);
		const preset = TIME_REMAP_PRESETS.find((p) => p.id === presetId);
		if (preset) {
			applyPreset(preset);
		}
	};

	const handleTrackBehaviorChange = (trackId: string, behavior: TrackTimeBehavior) => {
		setTrackConfigs((prev) =>
			prev.map((tc) => (tc.trackId === trackId ? { ...tc, behavior } : tc))
		);
		setSelectedPreset("custom");
	};

	const newDuration = getRemappedDuration(originalDuration, timeScale);

	const buildTimeRemapConfig = (): TimeRemapConfig => ({
		timeScale,
		trackConfigs,
		automationMarkerConfig: {
			triggerBehavior: automationTrigger,
			playbackBehavior: automationPlayback,
		},
		oneshotMarkerConfig: {
			triggerBehavior: oneshotTrigger,
			playbackBehavior: oneshotPlayback,
		},
	});

	const handleExport = async () => {
		if (!activeProject) return;

		cancelRequestedRef.current = false;
		setIsExporting(true);
		setProgress(0);
		setExportResult(null);

		const timeRemapConfig = buildTimeRemapConfig();

		const result = await editor.project.export({
			options: {
				format: DEFAULT_EXPORT_OPTIONS.format,
				quality: DEFAULT_EXPORT_OPTIONS.quality,
				fps: activeProject.settings.fps,
				includeAudio: true,
				timeRemapConfig,
				onProgress: ({ progress }) => setProgress(progress),
				onCancel: () => cancelRequestedRef.current,
			},
		});

		setIsExporting(false);

		if (result.cancelled) {
			setExportResult(null);
			setProgress(0);
			return;
		}

		setExportResult(result);

		if (result.success && result.buffer) {
			const format = DEFAULT_EXPORT_OPTIONS.format;
			const mimeType = getExportMimeType({ format });
			const extension = getExportFileExtension({ format });
			const blob = new Blob([result.buffer], { type: mimeType });
			const url = URL.createObjectURL(blob);

			const a = document.createElement("a");
			a.href = url;
			a.download = `${activeProject.metadata.name}_${timeScale}x${extension}`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);

			onOpenChange(false);
			setExportResult(null);
			setProgress(0);
		}
	};

	const handleCancel = () => {
		cancelRequestedRef.current = true;
	};

	return (
		<Dialog open={isOpen} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>Variant Export (Time Remap)</DialogTitle>
				</DialogHeader>

				<DialogBody className="gap-4 max-h-[60vh] overflow-y-auto">
					{/* Duration Info */}
					<div className="flex justify-between text-sm text-muted-foreground">
						<span>Original: {formatDuration(originalDuration)}</span>
						<span>New: {formatDuration(newDuration)}</span>
					</div>

					{/* Time Scale */}
					<div className="flex items-center gap-3">
						<Label className="w-24">Time Scale</Label>
						<Select
							value={timeScale.toString()}
							onValueChange={(v) => {
								setTimeScale(Number.parseFloat(v));
								setSelectedPreset("custom");
							}}
						>
							<SelectTrigger className="flex-1">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{TIME_SCALE_OPTIONS.map((opt) => (
									<SelectItem key={opt.value} value={opt.value}>
										{opt.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{/* Preset */}
					<div className="flex items-center gap-3">
						<Label className="w-24">Preset</Label>
						<Select value={selectedPreset} onValueChange={handlePresetChange}>
							<SelectTrigger className="flex-1">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{TIME_REMAP_PRESETS.map((preset) => (
									<SelectItem key={preset.id} value={preset.id}>
										{preset.name}
									</SelectItem>
								))}
								<SelectItem value="custom">Custom</SelectItem>
							</SelectContent>
						</Select>
					</div>

					{/* Track Behaviors */}
					<PropertyGroup title="Track Behaviors" defaultExpanded={true}>
						<div className="space-y-2">
							{tracks.map((track) => {
								const config = trackConfigs.find((tc) => tc.trackId === track.id);
								return (
									<div key={track.id} className="flex items-center gap-2">
										<div className="flex items-center gap-2 flex-1 min-w-0">
											{getTrackIcon(track.type)}
											<span className="text-sm truncate">{track.name}</span>
										</div>
										<Select
											value={config?.behavior ?? "stretch"}
											onValueChange={(v) =>
												handleTrackBehaviorChange(track.id, v as TrackTimeBehavior)
											}
										>
											<SelectTrigger className="w-32">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{TRACK_BEHAVIOR_OPTIONS.map((opt) => (
													<SelectItem key={opt.value} value={opt.value}>
														{opt.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								);
							})}
						</div>
					</PropertyGroup>

					{/* Marker Behaviors */}
					<PropertyGroup title="Marker Behaviors" defaultExpanded={false}>
						<div className="space-y-3">
							<div className="text-xs text-muted-foreground">Automation</div>
							<div className="flex items-center gap-2">
								<Label className="text-xs w-16">Trigger</Label>
								<Select
									value={automationTrigger}
									onValueChange={(v) => {
										setAutomationTrigger(v as MarkerTriggerBehavior);
										setSelectedPreset("custom");
									}}
								>
									<SelectTrigger className="flex-1">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{TRIGGER_BEHAVIOR_OPTIONS.map((opt) => (
											<SelectItem key={opt.value} value={opt.value}>
												{opt.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="flex items-center gap-2">
								<Label className="text-xs w-16">Playback</Label>
								<Select
									value={automationPlayback}
									onValueChange={(v) => {
										setAutomationPlayback(v as MarkerPlaybackBehavior);
										setSelectedPreset("custom");
									}}
								>
									<SelectTrigger className="flex-1">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{PLAYBACK_BEHAVIOR_OPTIONS.map((opt) => (
											<SelectItem key={opt.value} value={opt.value}>
												{opt.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							<div className="text-xs text-muted-foreground mt-2">Oneshot</div>
							<div className="flex items-center gap-2">
								<Label className="text-xs w-16">Trigger</Label>
								<Select
									value={oneshotTrigger}
									onValueChange={(v) => {
										setOneshotTrigger(v as MarkerTriggerBehavior);
										setSelectedPreset("custom");
									}}
								>
									<SelectTrigger className="flex-1">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{TRIGGER_BEHAVIOR_OPTIONS.map((opt) => (
											<SelectItem key={opt.value} value={opt.value}>
												{opt.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="flex items-center gap-2">
								<Label className="text-xs w-16">Playback</Label>
								<Select
									value={oneshotPlayback}
									onValueChange={(v) => {
										setOneshotPlayback(v as MarkerPlaybackBehavior);
										setSelectedPreset("custom");
									}}
								>
									<SelectTrigger className="flex-1">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{PLAYBACK_BEHAVIOR_OPTIONS.map((opt) => (
											<SelectItem key={opt.value} value={opt.value}>
												{opt.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>
					</PropertyGroup>

					{/* Export Progress */}
					{isExporting && (
						<div className="space-y-2">
							<div className="flex items-center justify-between text-sm">
								<span>{Math.round(progress * 100)}%</span>
								<span>100%</span>
							</div>
							<Progress value={progress * 100} />
						</div>
					)}

					{/* Export Error */}
					{exportResult && !exportResult.success && (
						<div className="text-sm text-destructive">
							Export failed: {exportResult.error}
						</div>
					)}
				</DialogBody>

				<DialogFooter>
					{isExporting ? (
						<Button variant="outline" onClick={handleCancel}>
							Cancel
						</Button>
					) : (
						<>
							<Button variant="outline" onClick={() => onOpenChange(false)}>
								Cancel
							</Button>
							<Button onClick={handleExport} className="gap-2">
								<Download className="size-4" />
								Export Variant
							</Button>
						</>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
