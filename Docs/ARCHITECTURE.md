# OpenCut Architecture

## Project Overview

OpenCut is a free, open-source, privacy-focused video editor for web, desktop, and mobile. Alternative to CapCut — all processing stays on-device. Built with Next.js 16 (Turbopack), React 19, TypeScript 5.8, monorepo managed by Turborepo.

## Monorepo Structure

```
myOpenCut/
├── apps/web/          # Main Next.js application (primary workspace)
├── apps/tools/        # Development tools
├── packages/env/      # Environment variable validation (Zod schemas)
├── packages/ui/       # Shared UI components (Radix-based)
├── biome.json         # Biome linter/formatter config
├── turbo.json         # Turborepo task pipeline
└── package.json       # Root workspace config (Bun 1.2.18)
```

## Tech Stack

| Category | Technology |
|----------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| UI | React 19, Radix UI primitives |
| Language | TypeScript 5.8 |
| Runtime | Bun |
| State | Zustand |
| Styling | Tailwind CSS 4 + tailwindcss-animate |
| Forms | React Hook Form + Zod |
| Database | Drizzle ORM + PostgreSQL |
| Auth | Better Auth |
| Video | @ffmpeg/ffmpeg |
| Audio | WaveSurfer.js |
| DnD | @hello-pangea/dnd |
| Animation | Motion (Framer Motion) |
| Code Quality | Biome (linter + formatter) |

## Web App Structure (apps/web/src/)

| Directory | Purpose |
|-----------|---------|
| `app/` | Next.js App Router pages (`editor/[project_id]/` is the main page) |
| `components/editor/` | Editor chrome: header, panels, timeline, dialogs |
| `components/ui/` | Reusable Radix-based UI components |
| `stores/` | Zustand state stores (see below) |
| `services/` | Core business logic (see below) |
| `hooks/` | Custom React hooks |
| `lib/` | Utilities, commands, media helpers, timeline logic |
| `types/` | TypeScript type definitions (`timeline.ts` is central) |
| `constants/`, `core/`, `data/`, `utils/` | Supporting modules |

## Editor Layout

Four resizable panels:
1. **Left** — AssetsPanel (media assets, resources)
2. **Center** — PreviewPanel (video preview)
3. **Right** — PropertiesPanel (selected element properties)
4. **Bottom** — Timeline (multi-track editor)

## State Management (Zustand Stores)

| Store | Purpose |
|-------|---------|
| `editor-store.ts` | Core state: project, selected elements, scenes |
| `timeline-store.ts` | Playback position, navigation, zoom |
| `panel-store.ts` | Panel sizes, layout persistence |
| `keybindings-store.ts` | Keyboard shortcut management |
| `assets-panel-store.tsx` | Media asset management, uploads |
| `sounds-store.ts` | Audio library, sound effects |
| `stickers-store.ts` | Sticker library |
| `text-properties-store.ts` | Text element properties |
| `automation-store.ts` | Audio volume automation markers/states |
| `oneshot-store.ts` | One-shot audio definitions and markers |
| `sidechain-store.ts` | Sidechain compression configs |

Each store is independent and imported directly where needed.

## Services

### Renderer (`services/renderer/`)
Node-based rendering pipeline:
- `scene-builder.ts` → converts timeline data into render node tree
- `nodes/` → node types: video, image, text, sticker, color, blur-background (all extend `base-node.ts`)
- `canvas-renderer.ts` → renders node tree to canvas
- `scene-exporter.ts` → exports rendered frames to video

### Storage (`services/storage/`)
- `service.ts` — save/load projects (explicit field serialization, not spread)
- `migrations/` — schema migration chain: v0→v1→v2→v3
- IndexedDB + OPFS adapters for persistence

### Other Services
- `transcription/` — audio transcription (with web worker)
- `video-cache/` — video frame caching

## Development Commands

```bash
# Quick start
cd apps/web && bun install && bun dev    # → http://localhost:3000

# From project root
bun run dev:web / build:web / lint:web:fix / format:web / test

# From apps/web/
bun dev / build / start / lint / lint:fix / format
bun run db:generate / db:migrate / db:push:local / db:push:prod
```

## Environment Setup

All env vars in `apps/web/.env.local` validated by Zod (`packages/env/src/web.ts`).

```bash
cd apps/web && cp .env.example .env.local
```

Required URL vars: `MODAL_TRANSCRIPTION_URL`, `NEXT_PUBLIC_MARBLE_API_URL`, `UPSTASH_REDIS_REST_URL`, `DATABASE_URL` (postgres://).

## Code Quality

Biome (not ESLint/Prettier). Config: `biome.json`. Run `bun lint:fix` / `bun format` before committing.

## Contributing

Not accepting feature PRs during core editor buildout. Safe areas: timeline, project management, perf, bugs, UI outside preview. Avoid: preview panel, export, rendering engine.
