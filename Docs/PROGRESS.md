# OpenCut Development Progress

## Summary

22 commits by Yang-Yiming from Feb 3–22, 2026, building out the audio engine and export subsystems.

## Oneshot Audio System (8 commits)

One-shot audio clips triggered at specific timeline points, with a dedicated DJ-like editing panel.

| Date | Commit | Description |
|------|--------|-------------|
| Feb 4 | `9b10f18` | Initial oneshot feature + v3→v4 storage migration |
| Feb 5 | `526b583` | Fix saving bug in oneshot |
| Feb 6 | `e5c3cf6` | Add indicator in oneshot edit panel |
| Feb 6 | `73c6e38` | DJ-like editing flow in oneshot panel |
| Feb 10 | `6c3a070` | Global oneshot mode (Shift+Tab toggle) |
| Feb 14 | `139a14c` | Playback perf: cache lookups, unified clock, AudioContext reuse |
| Feb 22 | `45f1097` | Volume control for oneshots |
| Feb 22 | `c35268f` | Fix oneshot audio silent in export (cached AudioBuffers) |

## Sidechain Compression (2 commits)

Extended sidechain ducking to support oneshot sources/targets alongside tracks.

| Date | Commit | Description |
|------|--------|-------------|
| Feb 14 | `4fe6227` | Oneshot source/target support, persistence, scene cache invalidation |
| Feb 14 | `139a14c` | (shared) Performance: unified clock, cache lookups |

## Automation System (3 commits)

Volume automation with timeline markers and visual point editing.

| Date | Commit | Description |
|------|--------|-------------|
| Feb 3 | `2668159` | Add automation system for audio volume control |
| Feb 3 | `eef10a5` | UI enhancement, state persistence, minor bugs |
| Feb 6 | `d0477f7` | Adjust icon sequence, add scroll to automation subtabs |

## Timeline States (3 commits)

Named states on the timeline for marking sections.

| Date | Commit | Description |
|------|--------|-------------|
| Feb 4 | `39121fd` | Add state UI on timeline |
| Feb 4 | `1176c9d` | Pressing H without entering state mode logic |
| Feb 4 | `2831ed7` | Fix state bug |

## Variant Export (3 commits)

Export video at different speeds/pitches as variants.

| Date | Commit | Description |
|------|--------|-------------|
| Feb 5 | `b007db5` | Add variant export feature |
| Feb 10 | `e1c98d1` | Stable pitch mode for variant export |
| Feb 22 | `9e41484` | Fix video speed not applied in variant export |

## Audio Track Features (2 commits)

| Date | Commit | Description |
|------|--------|-------------|
| Feb 3 | `e6a005c` | Fix mute-one-track issue |
| Feb 4 | `c6925eb` | Add audio loop feature for timeline clips |

## UI / Bug Fixes (2 commits)

| Date | Commit | Description |
|------|--------|-------------|
| Feb 4 | `a129db3` | Add missing ghost variant to Button, fix getTrackById |
| Feb 21 | `f86e8f0` | Fix left panel unclickable after closing edit dialog |
