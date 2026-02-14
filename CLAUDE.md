# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OpenCut is a free, open-source video editor for web, desktop, and mobile. It's a privacy-focused alternative to CapCut where videos stay on the user's device. The project uses Next.js 16 with Turbopack, React 19, and a monorepo structure managed by Turborepo.

## Development Commands

### Quick Start (Most Common)
```bash
cd apps/web
bun install
bun dev
```

The application will be available at http://localhost:3000

### From Project Root
```bash
# Development
bun run dev:web          # Start web app dev server
bun run dev:tools        # Start tools dev server

# Build
bun run build:web        # Build web app
bun run build:tools      # Build tools

# Linting & Formatting
bun run lint:web         # Lint web app
bun run lint:web:fix     # Lint and auto-fix
bun run format:web       # Format renderer code

# Testing
bun test                 # Run tests
```

### From apps/web Directory
```bash
bun dev                  # Start dev server with Turbopack
bun build                # Build for production
bun start                # Start production server
bun lint                 # Run Biome linter
bun lint:fix             # Lint and auto-fix
bun format               # Format code with Biome

# Database
bun run db:generate      # Generate Drizzle migrations
bun run db:migrate       # Run migrations
bun run db:push:local    # Push schema to local DB
bun run db:push:prod     # Push schema to production DB
```

## Architecture

### Monorepo Structure
- **apps/web/** - Main Next.js application (primary workspace)
- **apps/tools/** - Development tools
- **packages/env/** - Environment variable validation (Zod schemas)
- **packages/ui/** - Shared UI components

### Web App Structure (apps/web/src/)
- **app/** - Next.js App Router pages and layouts
  - **editor/[project_id]/** - Main video editor page
- **components/** - React components
  - **editor/** - Editor-specific components (timeline, panels, dialogs)
  - **ui/** - Reusable UI components (Radix UI based)
- **stores/** - Zustand state management
  - `editor-store.ts` - Core editor state
  - `timeline-store.ts` - Timeline state
  - `panel-store.ts` - Panel layout state
  - `keybindings-store.ts` - Keyboard shortcuts
  - `assets-panel-store.tsx` - Asset management
  - `sounds-store.ts`, `stickers-store.ts`, `text-properties-store.ts`
- **services/** - Core business logic
  - **renderer/** - Video rendering engine
  - **storage/** - Local storage management
  - **transcription/** - Audio transcription
  - **video-cache/** - Video caching
- **hooks/** - Custom React hooks
- **lib/** - Utility functions and API logic
- **types/** - TypeScript type definitions
- **constants/** - Application constants
- **core/** - Core functionality
- **data/** - Static data
- **utils/** - Helper utilities

### Editor Layout
The editor uses a resizable panel layout with four main areas:
1. **Left Panel (AssetsPanel)** - Media assets and resources
2. **Center Panel (PreviewPanel)** - Video preview window
3. **Right Panel (PropertiesPanel)** - Selected element properties
4. **Bottom Panel (Timeline)** - Multi-track timeline editor

## Environment Setup

### Required Environment Variables
All environment variables in `apps/web/.env.local` are **required** and validated by Zod schemas in `packages/env/src/web.ts`.

**Critical:** All URL-type variables must be valid URLs (including protocol). Invalid URLs will cause startup errors.

### Initial Setup
```bash
cd apps/web
cp .env.example .env.local
```

### Minimal Working Configuration
For local development without external services, ensure these variables have valid URL formats:
- `MODAL_TRANSCRIPTION_URL` - Must be a valid URL (e.g., `http://localhost:8080`)
- `NEXT_PUBLIC_MARBLE_API_URL` - Must be a valid URL
- `UPSTASH_REDIS_REST_URL` - Must be a valid URL
- `DATABASE_URL` - Must start with `postgres://` or `postgresql://`

### Common Setup Issues
1. **Invalid URL format**: If you see `ZodError: Invalid URL`, check that all URL variables have proper format (include `http://` or `https://`)
2. **React version mismatch**: If you see React version errors, delete `node_modules` and `bun.lock`, then run `bun install`

## Tech Stack

### Core Technologies
- **Next.js 16** with App Router and Turbopack
- **React 19** with Server Components
- **TypeScript 5.8**
- **Bun** as package manager and runtime

### Key Libraries
- **State Management**: Zustand
- **UI Components**: Radix UI primitives
- **Styling**: Tailwind CSS 4 with tailwindcss-animate
- **Forms**: React Hook Form + Zod validation
- **Database**: Drizzle ORM with PostgreSQL
- **Auth**: Better Auth
- **Video Processing**: FFmpeg.js (@ffmpeg/ffmpeg)
- **Audio**: WaveSurfer.js
- **Drag & Drop**: @hello-pangea/dnd
- **Animations**: Motion (Framer Motion)
- **Code Quality**: Biome (linting & formatting)

## State Management Architecture

The application uses Zustand for state management with multiple specialized stores:

- **editor-store.ts**: Core editor state (current project, selected elements)
- **timeline-store.ts**: Timeline playback and navigation
- **panel-store.ts**: Resizable panel sizes and layout persistence
- **keybindings-store.ts**: Keyboard shortcut management
- **assets-panel-store.tsx**: Media asset management and uploads
- **sounds-store.ts**: Audio library and sound effects
- **stickers-store.ts**: Sticker library management
- **text-properties-store.ts**: Text element properties

Each store is independent and can be imported directly where needed.

## Video Rendering Architecture

The video rendering system is located in `src/services/renderer/`. This is a critical component that handles:
- Video composition and layering
- Effects and transitions
- Export functionality

**Note**: The preview panel and export functionality are currently being refactored with a new binary rendering approach. Avoid making changes to these areas unless coordinated with maintainers.

## Contributing Guidelines

⚠️ **Important**: The project is NOT currently accepting feature PRs while building out the core editor.

### Contribution Process
1. Open an issue first to discuss your proposed changes
2. Wait for maintainer approval
3. Only then start coding

### Focus Areas (Safe to Contribute)
- Timeline functionality improvements
- Project management features
- Performance optimizations
- Bug fixes
- UI improvements outside the preview panel

### Areas to Avoid
- Preview panel enhancements (fonts, stickers, effects)
- Export functionality
- Rendering engine changes

Critical bug fixes may be accepted on a case-by-case basis.

## Package Manager

This project uses **Bun** as the package manager. Do not use npm or yarn.

- Package manager is enforced via `"packageManager": "bun@1.2.18"` in package.json
- Bun is required for workspace protocol support (`workspace:*`)
- All scripts should be run with `bun` command

## Database

The project uses Drizzle ORM with PostgreSQL:
- Schema definitions are in the database migration files
- Use `bun run db:generate` to create new migrations
- Use `bun run db:migrate` to apply migrations
- Use `bun run db:push:local` for local schema changes during development

## Code Quality

- **Linter**: Biome (not ESLint)
- **Formatter**: Biome (not Prettier)
- Configuration: `biome.json` in project root
- Run `bun lint:fix` or `bun format` before committing

## Agent Reminders (Pitfalls & Gotchas)

### MUST: Run `tsc --noEmit` After Every Change
TypeScript errors silently prevent changes from taking effect in the dev server (Turbopack). If you make changes and the user says "it's not working / nothing changed", the first thing to check is whether the code compiles. Run:
```bash
npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | head -40
```
Note: `oneshot-manager.ts:261` has a pre-existing `string | undefined` vs `string | null` error — ignore it.

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

