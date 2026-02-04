"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { PlayIcon, PauseIcon } from "@hugeicons/core-free-icons";

interface OneshotWaveformEditorProps {
	audioBuffer: AudioBuffer;
	trimStart: number;
	trimEnd: number;
	cuePoint: number;
	onTrimStartChange: (value: number) => void;
	onTrimEndChange: (value: number) => void;
	onCuePointChange: (value: number) => void;
}

export function OneshotWaveformEditor({
	audioBuffer,
	trimStart,
	trimEnd,
	cuePoint,
	onTrimStartChange,
	onTrimEndChange,
	onCuePointChange,
}: OneshotWaveformEditorProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const [isPlaying, setIsPlaying] = useState(false);
	const [dragging, setDragging] = useState<"trimStart" | "trimEnd" | "cuePoint" | null>(null);
	const audioContextRef = useRef<AudioContext | null>(null);
	const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

	const duration = audioBuffer.duration;

	// Draw waveform
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const dpr = window.devicePixelRatio || 1;
		const rect = canvas.getBoundingClientRect();
		canvas.width = rect.width * dpr;
		canvas.height = rect.height * dpr;
		ctx.scale(dpr, dpr);

		const width = rect.width;
		const height = rect.height;

		// Clear canvas
		ctx.fillStyle = "#1a1a1a";
		ctx.fillRect(0, 0, width, height);

		// Draw waveform
		const channelData = audioBuffer.getChannelData(0);
		const samplesPerPixel = Math.floor(channelData.length / width);

		ctx.beginPath();
		ctx.strokeStyle = "#4a4a4a";
		ctx.lineWidth = 1;

		for (let x = 0; x < width; x++) {
			const startSample = x * samplesPerPixel;
			let min = 0;
			let max = 0;

			for (let i = 0; i < samplesPerPixel; i++) {
				const sample = channelData[startSample + i] || 0;
				if (sample < min) min = sample;
				if (sample > max) max = sample;
			}

			const yMin = (1 - max) * (height / 2);
			const yMax = (1 - min) * (height / 2);

			ctx.moveTo(x, yMin);
			ctx.lineTo(x, yMax);
		}
		ctx.stroke();

		// Draw active region (between trimStart and trimEnd)
		const trimStartX = (trimStart / duration) * width;
		const trimEndX = (trimEnd / duration) * width;

		// Dim inactive regions
		ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
		ctx.fillRect(0, 0, trimStartX, height);
		ctx.fillRect(trimEndX, 0, width - trimEndX, height);

		// Draw trim markers
		ctx.fillStyle = "#22c55e";
		ctx.fillRect(trimStartX - 2, 0, 4, height);
		ctx.fillRect(trimEndX - 2, 0, 4, height);

		// Draw cue point marker
		const cueX = (cuePoint / duration) * width;
		ctx.fillStyle = "#f97316";
		ctx.fillRect(cueX - 2, 0, 4, height);

		// Draw cue point triangle at top
		ctx.beginPath();
		ctx.moveTo(cueX - 8, 0);
		ctx.lineTo(cueX + 8, 0);
		ctx.lineTo(cueX, 12);
		ctx.closePath();
		ctx.fill();

	}, [audioBuffer, trimStart, trimEnd, cuePoint, duration]);

	// Handle mouse events for dragging
	const getTimeFromX = useCallback((clientX: number) => {
		const canvas = canvasRef.current;
		if (!canvas) return 0;
		const rect = canvas.getBoundingClientRect();
		const x = clientX - rect.left;
		return Math.max(0, Math.min(duration, (x / rect.width) * duration));
	}, [duration]);

	const handleMouseDown = useCallback((e: React.MouseEvent) => {
		const time = getTimeFromX(e.clientX);
		const threshold = duration * 0.02; // 2% of duration

		// Check which marker is closest
		const distToTrimStart = Math.abs(time - trimStart);
		const distToTrimEnd = Math.abs(time - trimEnd);
		const distToCue = Math.abs(time - cuePoint);

		const minDist = Math.min(distToTrimStart, distToTrimEnd, distToCue);

		if (minDist > threshold) return;

		if (minDist === distToTrimStart) {
			setDragging("trimStart");
		} else if (minDist === distToTrimEnd) {
			setDragging("trimEnd");
		} else {
			setDragging("cuePoint");
		}
	}, [getTimeFromX, trimStart, trimEnd, cuePoint, duration]);

	const handleMouseMove = useCallback((e: React.MouseEvent) => {
		if (!dragging) return;

		const time = getTimeFromX(e.clientX);

		if (dragging === "trimStart") {
			onTrimStartChange(Math.min(time, trimEnd - 0.01));
		} else if (dragging === "trimEnd") {
			onTrimEndChange(Math.max(time, trimStart + 0.01));
		} else if (dragging === "cuePoint") {
			// Cue point must be within trim range
			onCuePointChange(Math.max(trimStart, Math.min(trimEnd, time)));
		}
	}, [dragging, getTimeFromX, trimStart, trimEnd, onTrimStartChange, onTrimEndChange, onCuePointChange]);

	const handleMouseUp = useCallback(() => {
		setDragging(null);
	}, []);

	// Preview playback
	const handlePlayPreview = useCallback(() => {
		if (isPlaying) {
			sourceNodeRef.current?.stop();
			setIsPlaying(false);
			return;
		}

		if (!audioContextRef.current) {
			audioContextRef.current = new AudioContext();
		}

		const ctx = audioContextRef.current;
		const source = ctx.createBufferSource();
		source.buffer = audioBuffer;
		source.connect(ctx.destination);

		const sliceDuration = trimEnd - trimStart;
		source.start(0, trimStart, sliceDuration);

		source.onended = () => {
			setIsPlaying(false);
		};

		sourceNodeRef.current = source;
		setIsPlaying(true);
	}, [isPlaying, audioBuffer, trimStart, trimEnd]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			sourceNodeRef.current?.stop();
		};
	}, []);

	const sliceDuration = trimEnd - trimStart;
	const cueOffset = cuePoint - trimStart;

	return (
		<div className="flex flex-col gap-2">
			<div
				ref={containerRef}
				className="relative border rounded-md overflow-hidden cursor-crosshair"
				onMouseDown={handleMouseDown}
				onMouseMove={handleMouseMove}
				onMouseUp={handleMouseUp}
				onMouseLeave={handleMouseUp}
			>
				<canvas
					ref={canvasRef}
					className="w-full h-32"
				/>
			</div>

			<div className="flex items-center justify-between">
				<Button
					variant="outline"
					size="sm"
					onClick={handlePlayPreview}
				>
					<HugeiconsIcon icon={isPlaying ? PauseIcon : PlayIcon} className="h-4 w-4 mr-1" />
					{isPlaying ? "Stop" : "Preview"}
				</Button>

				<div className="flex gap-4 text-xs text-muted-foreground">
					<span>Slice: {sliceDuration.toFixed(2)}s</span>
					<span>Cue offset: {cueOffset.toFixed(2)}s</span>
				</div>
			</div>

			<div className="grid grid-cols-3 gap-2 text-xs">
				<div className="flex flex-col items-center p-2 bg-muted/30 rounded">
					<span className="text-muted-foreground">Trim Start</span>
					<span className="font-mono text-green-500">{trimStart.toFixed(3)}s</span>
				</div>
				<div className="flex flex-col items-center p-2 bg-muted/30 rounded">
					<span className="text-muted-foreground">Cue Point</span>
					<span className="font-mono text-orange-500">{cuePoint.toFixed(3)}s</span>
				</div>
				<div className="flex flex-col items-center p-2 bg-muted/30 rounded">
					<span className="text-muted-foreground">Trim End</span>
					<span className="font-mono text-green-500">{trimEnd.toFixed(3)}s</span>
				</div>
			</div>
		</div>
	);
}
