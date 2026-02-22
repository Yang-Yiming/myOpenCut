# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.
For full project details, see the `Docs/` directory.

## Project Overview

OpenCut — free, open-source, privacy-focused video editor (web/desktop/mobile). Next.js 16 + React 19 + TypeScript 5.8 monorepo managed by Turborepo.

## Documentation

- **[Docs/ARCHITECTURE.md](Docs/ARCHITECTURE.md)** — Monorepo structure, tech stack, services, state management, dev commands, env setup
- **[Docs/PROGRESS.md](Docs/PROGRESS.md)** — Development progress and commit history
- **[Docs/PLAN.md](Docs/PLAN.md)** — Feature completion status and roadmap

Read these when you need context on architecture, progress, or plans.

## Package Manager

**Use Bun. Not npm. Not yarn.**

- Enforced via `"packageManager": "bun@1.2.18"` in package.json
- Quick start: `cd apps/web && bun install && bun dev`

## Keeping Docs Updated

After making feature changes, update CLAUDE.md and relevant Docs/ files if the change affects architecture, adds new pitfalls, or completes a planned feature.

## Agent Reminders (Pitfalls & Gotchas)

### MUST: Run `tsc --noEmit` After Every Change
TypeScript errors silently prevent changes from taking effect in the dev server (Turbopack). If you make changes and the user says "it's not working / nothing changed", the first thing to check is whether the code compiles. Run:
```bash
npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | head -40
```
Note: `oneshot-manager.ts` has a pre-existing `string | undefined` vs `string | null` error in `resolveAudioUrl` — ignore it.

### Discriminated Union Narrowing Through Property Chains
TypeScript does NOT narrow discriminated unions through property access chains. This is a common trap with types like `SidechainSource`:
```typescript
// BAD — TS error: 'trackId' does not exist on type SidechainSource
if (config.source.type === "track") {
  const id = config.source.trackId; // TS2339
}

// GOOD — extract first, then narrow
const { source } = config;
if (source.type === "track") {
  const id = source.trackId; // OK
}
```

### Storage Service: Explicit Field Listing
`services/storage/service.ts` serializes scenes by **explicitly listing every field** (not using spread). When adding a new field to `TScene` in `types/timeline.ts`, you MUST manually add it to BOTH:
1. **Save** (~`saveProject` method, the `serializedScenes` map)
2. **Load** (~`loadProject` method, the `scenes` map)

Forgetting either side means the field silently disappears on save or load. This has caused data loss bugs before (e.g. `sidechainConfigs` was missing from both save and load).

### `collectAudioElements` Returns `loop: boolean | undefined`
When mapping results from `collectAudioElements()` into typed arrays that expect `loop: boolean`, always use `el.loop ?? false`. The `loop` field on audio elements in `types/timeline.ts` is `loop?: boolean` (optional).

### Sidechain Architecture
- **Source**: `SidechainSource` is a discriminated union (`{ type: "track"; trackId } | { type: "oneshot"; definitionId }`). Always narrow before accessing variant-specific fields.
- **Targets**: A sidechain config can target both tracks (`targetTrackIds`) AND oneshot definitions (`targetOneshotDefinitionIds`). Both must be checked/updated together.
- **Persistence**: `sidechainConfigs` lives on `TScene` (per-scene). The storage service has migration logic to convert old `sourceTrackId: string` format to the new `source: SidechainSource` union.
- **Cache invalidation**: `SidechainManager` subscribes to `editor.scenes` changes to auto-clear envelope cache on scene switch. The `updateConfig` method invalidates on `updates.source` (not the old `updates.sourceTrackId`).
- **Playback**: `AudioManager.oneshotGainNodes` tracks active oneshot gain nodes for real-time sidechain ducking. Cleaned up in `stopPlayback()`.

### Playback Cache Lifecycle
Several managers use a `prepareForPlayback()` / `clearPlaybackCache()` pattern to snapshot data at playback start and avoid per-tick scene reads. `AudioManager.startPlayback()` calls all `prepareForPlayback()` methods; `stopPlayback()` calls all `clearPlaybackCache()` methods. When adding new per-tick lookups, follow this pattern:
- **SidechainManager**: Builds `Map<targetId, SidechainEnvelope[]>` lookup tables so `getSidechainGainForTrack/ForOneshot` does `Map.get()` instead of filtering configs each tick.
- **AutomationManager**: Snapshots markers, states, and elementTimeRanges so `getEffectiveVolumeForTrack` skips per-tick track/element traversal.
- **OneshotManager**: Builds a sorted marker index (by `audioStartTime`) so `getMarkersInTimeWindow` uses binary search instead of O(markers × definitions).

### Unified Clock Source
`PlaybackManager` supports an external clock source via `setClockSource()` / `clearClockSource()`. During audio playback, `AudioManager` sets the clock source to `AudioContext.currentTime`-derived time, so the visual timeline and audio share the same clock. If the audio clock stalls for >200ms, `PlaybackManager` automatically falls back to `performance.now()` delta accumulation.

### AudioContext Reuse for Decoding
`OneshotManager` and `SidechainManager` each reuse a single `AudioContext` (via `getDecodeContext()`) for `decodeAudioData` calls. Do NOT create `new AudioContext()` per decode — browsers limit to 6-8 contexts and excess ones silently fail.

### Oneshot Audio in Export
Export must pass `OneshotManager.getCachedAudioBuffer()` results via the `oneshotAudioBuffers` / `cachedBuffers` param to `collectOneshotAudioElements`. Blob URLs for uploaded oneshots go stale, so the cached `AudioBuffer` from playback is the primary source; fetch/file-read is fallback only. The cache is populated when the user previews playback (`OneshotManager.loadAudioBuffer()`). If export runs without prior playback, the fallback resolves uploads via `mediaAssets` file and library sounds via HTTP fetch.
