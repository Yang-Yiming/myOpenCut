"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogBody,
	DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEditor } from "@/hooks/use-editor";
import { useOneshotStore } from "@/stores/oneshot-store";
import { useSoundsStore } from "@/stores/sounds-store";
import type { OneshotAudioSource } from "@/types/oneshot";
import type { SoundEffect } from "@/types/sounds";
import type { MediaAsset } from "@/types/assets";
import { CreateOneshotCommand, UpdateOneshotCommand } from "@/lib/commands";
import { OneshotWaveformEditor } from "./oneshot-waveform-editor";

const ONESHOT_COLORS = [
	"#ef4444", // red
	"#f97316", // orange
	"#eab308", // yellow
	"#22c55e", // green
	"#06b6d4", // cyan
	"#3b82f6", // blue
	"#8b5cf6", // violet
	"#ec4899", // pink
];

export function OneshotDefinitionDialog() {
	const editor = useEditor();
	const {
		isCreatingOneshot,
		editingOneshotId,
		cancelCreatingOneshot,
		cancelEditingOneshot,
		audioBuffer,
		setAudioBuffer,
		isLoadingAudio,
		setIsLoadingAudio,
	} = useOneshotStore();

	const { topSoundEffects, savedSounds, loadSavedSounds } = useSoundsStore();

	const isOpen = isCreatingOneshot || editingOneshotId !== null;
	const mode = isCreatingOneshot ? "create" : "edit";

	const existingDefinition = editingOneshotId
		? editor.oneshot.getDefinition(editingOneshotId)
		: undefined;

	// Form state
	const [name, setName] = useState("");
	const [color, setColor] = useState(ONESHOT_COLORS[0]);
	const [audioSource, setAudioSource] = useState<OneshotAudioSource | null>(null);
	const [trimStart, setTrimStart] = useState(0);
	const [trimEnd, setTrimEnd] = useState(0);
	const [cuePoint, setCuePoint] = useState(0);
	const [audioDuration, setAudioDuration] = useState(0);

	// Load saved sounds when dialog opens
	useEffect(() => {
		if (isOpen) {
			loadSavedSounds();
		}
	}, [isOpen, loadSavedSounds]);

	// Initialize form when dialog opens
	useEffect(() => {
		if (isOpen) {
			if (existingDefinition) {
				setName(existingDefinition.name);
				setColor(existingDefinition.color);
				setAudioSource(existingDefinition.audioSource);
				setTrimStart(existingDefinition.trimStart);
				setTrimEnd(existingDefinition.trimEnd);
				setCuePoint(existingDefinition.cuePoint);
				setAudioDuration(existingDefinition.audioDuration);
				// Load audio buffer for existing definition
				loadAudioFromUrl(existingDefinition.audioSource.url);
			} else {
				setName("");
				setColor(ONESHOT_COLORS[Math.floor(Math.random() * ONESHOT_COLORS.length)]);
				setAudioSource(null);
				setTrimStart(0);
				setTrimEnd(0);
				setCuePoint(0);
				setAudioDuration(0);
				setAudioBuffer(null);
			}
		}
	}, [isOpen, existingDefinition, setAudioBuffer]);

	const loadAudioFromUrl = useCallback(async (url: string) => {
		setIsLoadingAudio(true);
		try {
			const response = await fetch(url);
			const arrayBuffer = await response.arrayBuffer();
			const audioContext = new AudioContext();
			const buffer = await audioContext.decodeAudioData(arrayBuffer);
			setAudioBuffer(buffer);
			return buffer;
		} catch (error) {
			console.error("Failed to load audio:", error);
			return null;
		} finally {
			setIsLoadingAudio(false);
		}
	}, [setAudioBuffer, setIsLoadingAudio]);

	const handleSelectSound = async (sound: SoundEffect) => {
		const url = sound.previewUrl;
		if (!url) return;

		const buffer = await loadAudioFromUrl(url);
		if (buffer) {
			const source: OneshotAudioSource = {
				type: "library",
				soundId: sound.id,
				url,
				name: sound.name,
			};
			setAudioSource(source);
			setAudioDuration(buffer.duration);
			setTrimStart(0);
			setTrimEnd(buffer.duration);
			setCuePoint(0);
			if (!name) {
				setName(sound.name);
			}
		}
	};

	const handleSelectAsset = async (asset: MediaAsset) => {
		if (!asset.file) return;

		setIsLoadingAudio(true);
		try {
			const arrayBuffer = await asset.file.arrayBuffer();
			const audioContext = new AudioContext();
			const buffer = await audioContext.decodeAudioData(arrayBuffer);
			setAudioBuffer(buffer);

			// Create a blob URL for the file
			const url = asset.url || URL.createObjectURL(asset.file);

			const source: OneshotAudioSource = {
				type: "upload",
				fileId: asset.id,
				url,
				name: asset.name,
			};
			setAudioSource(source);
			setAudioDuration(buffer.duration);
			setTrimStart(0);
			setTrimEnd(buffer.duration);
			setCuePoint(0);
			if (!name) {
				setName(asset.name.replace(/\.[^/.]+$/, "")); // Remove file extension
			}
		} catch (error) {
			console.error("Failed to load audio asset:", error);
		} finally {
			setIsLoadingAudio(false);
		}
	};

	const handleClose = () => {
		if (isCreatingOneshot) {
			cancelCreatingOneshot();
		} else {
			cancelEditingOneshot();
		}
	};

	const handleSave = () => {
		if (!name.trim()) {
			alert("Please enter a name for the oneshot");
			return;
		}

		if (!audioSource) {
			alert("Please select an audio source");
			return;
		}

		const data = {
			name: name.trim(),
			color,
			audioSource,
			trimStart,
			trimEnd,
			cuePoint,
			audioDuration,
		};

		if (mode === "create") {
			editor.command.execute(new CreateOneshotCommand(data));
		} else if (editingOneshotId) {
			editor.command.execute(new UpdateOneshotCommand(editingOneshotId, data));
		}

		handleClose();
	};

	return (
		<Dialog open={isOpen} onOpenChange={handleClose}>
			<DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
				<DialogHeader>
					<DialogTitle>
						{mode === "create" ? "Create" : "Edit"} Oneshot
					</DialogTitle>
				</DialogHeader>

				<DialogBody className="gap-4 flex-1 overflow-hidden flex flex-col">
					{/* Name and Color */}
					<div className="flex gap-4">
						<div className="flex-1 space-y-2">
							<Label htmlFor="name">Name</Label>
							<Input
								id="name"
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder="e.g., Kick Drum"
							/>
						</div>
						<div className="space-y-2">
							<Label>Color</Label>
							<div className="flex gap-1">
								{ONESHOT_COLORS.map((c) => (
									<button
										key={c}
										type="button"
										className={`w-6 h-6 rounded-full border-2 ${
											color === c ? "border-white" : "border-transparent"
										}`}
										style={{ backgroundColor: c }}
										onClick={() => setColor(c)}
									/>
								))}
							</div>
						</div>
					</div>

					{/* Audio Source Selection or Waveform Editor */}
					{!audioSource ? (
						<AudioSourceSelector
							onSelectSound={handleSelectSound}
							onSelectAsset={handleSelectAsset}
							topSounds={topSoundEffects}
							savedSounds={savedSounds}
							audioAssets={editor.media.getAssets().filter((a) => a.type === "audio")}
							isLoading={isLoadingAudio}
						/>
					) : (
						<div className="flex-1 flex flex-col min-h-0">
							<div className="flex items-center justify-between mb-2">
								<Label>Audio: {audioSource.name}</Label>
								<Button
									variant="outline"
									size="sm"
									onClick={() => {
										setAudioSource(null);
										setAudioBuffer(null);
									}}
								>
									Change Audio
								</Button>
							</div>
							{audioBuffer && (
								<OneshotWaveformEditor
									audioBuffer={audioBuffer}
									trimStart={trimStart}
									trimEnd={trimEnd}
									cuePoint={cuePoint}
									onTrimStartChange={setTrimStart}
									onTrimEndChange={setTrimEnd}
									onCuePointChange={setCuePoint}
								/>
							)}
						</div>
					)}
				</DialogBody>

				<DialogFooter>
					<Button variant="outline" onClick={handleClose}>
						Cancel
					</Button>
					<Button onClick={handleSave} disabled={!audioSource}>
						{mode === "create" ? "Create" : "Save"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function AudioSourceSelector({
	onSelectSound,
	onSelectAsset,
	topSounds,
	savedSounds,
	audioAssets,
	isLoading,
}: {
	onSelectSound: (sound: SoundEffect) => void;
	onSelectAsset: (asset: MediaAsset) => void;
	topSounds: SoundEffect[];
	savedSounds: Array<{ id: number; name: string; previewUrl?: string; duration: number }>;
	audioAssets: MediaAsset[];
	isLoading: boolean;
}) {
	return (
		<div className="flex-1 flex flex-col min-h-0">
			<Label className="mb-2">Select Audio Source</Label>
			<Tabs defaultValue="assets" className="flex-1 flex flex-col min-h-0">
				<TabsList>
					<TabsTrigger value="assets">My Assets</TabsTrigger>
					<TabsTrigger value="saved">Saved Sounds</TabsTrigger>
					<TabsTrigger value="library">Sound Library</TabsTrigger>
				</TabsList>

				<TabsContent value="assets" className="flex-1 mt-2 min-h-0">
					<ScrollArea className="h-[200px] border rounded-md p-2">
						{audioAssets.length === 0 ? (
							<p className="text-sm text-muted-foreground text-center py-4">
								No audio files in your project. Upload audio files in the Media tab.
							</p>
						) : (
							<div className="space-y-1">
								{audioAssets.map((asset) => (
									<AssetItem
										key={asset.id}
										asset={asset}
										onSelect={onSelectAsset}
										isLoading={isLoading}
									/>
								))}
							</div>
						)}
					</ScrollArea>
				</TabsContent>

				<TabsContent value="saved" className="flex-1 mt-2 min-h-0">
					<ScrollArea className="h-[200px] border rounded-md p-2">
						{savedSounds.length === 0 ? (
							<p className="text-sm text-muted-foreground text-center py-4">
								No saved sounds. Save sounds from the library first.
							</p>
						) : (
							<div className="space-y-1">
								{savedSounds.map((sound) => (
									<SoundItem
										key={sound.id}
										sound={{
											id: sound.id,
											name: sound.name,
											previewUrl: sound.previewUrl,
											duration: sound.duration,
										} as SoundEffect}
										onSelect={onSelectSound}
										isLoading={isLoading}
									/>
								))}
							</div>
						)}
					</ScrollArea>
				</TabsContent>

				<TabsContent value="library" className="flex-1 mt-2 min-h-0">
					<ScrollArea className="h-[200px] border rounded-md p-2">
						{topSounds.length === 0 ? (
							<p className="text-sm text-muted-foreground text-center py-4">
								Loading sounds...
							</p>
						) : (
							<div className="space-y-1">
								{topSounds.slice(0, 20).map((sound) => (
									<SoundItem
										key={sound.id}
										sound={sound}
										onSelect={onSelectSound}
										isLoading={isLoading}
									/>
								))}
							</div>
						)}
					</ScrollArea>
				</TabsContent>
			</Tabs>
		</div>
	);
}

function SoundItem({
	sound,
	onSelect,
	isLoading,
}: {
	sound: SoundEffect;
	onSelect: (sound: SoundEffect) => void;
	isLoading: boolean;
}) {
	return (
		<button
			type="button"
			className="w-full text-left px-3 py-2 rounded hover:bg-muted/50 flex items-center justify-between"
			onClick={() => onSelect(sound)}
			disabled={isLoading}
		>
			<span className="text-sm truncate">{sound.name}</span>
			<span className="text-xs text-muted-foreground">
				{sound.duration?.toFixed(1)}s
			</span>
		</button>
	);
}

function AssetItem({
	asset,
	onSelect,
	isLoading,
}: {
	asset: MediaAsset;
	onSelect: (asset: MediaAsset) => void;
	isLoading: boolean;
}) {
	return (
		<button
			type="button"
			className="w-full text-left px-3 py-2 rounded hover:bg-muted/50 flex items-center justify-between"
			onClick={() => onSelect(asset)}
			disabled={isLoading}
		>
			<span className="text-sm truncate">{asset.name}</span>
			<span className="text-xs text-muted-foreground">
				{asset.duration?.toFixed(1)}s
			</span>
		</button>
	);
}
