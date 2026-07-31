# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

短剧开发平台 (Short Drama Platform) — AI-driven short drama generation tool built with Next.js 16 + React 19 + TypeScript. It generates scripts, scenes, and video content programmatically.

**Stack**: Next.js 16.2.11, React 19.2.4, TypeScript 5, Tailwind CSS v4, Zustand 5, SQLite (sql.js), FFmpeg

## Commands

```bash
npm run dev -- --webpack   # Start dev server (use --webpack flag — Turbopack not supported on win32)
npm run build              # Production build
npm run start              # Start production server
npm run lint               # ESLint
npm run test               # Vitest
```

## Architecture

### Key directories

| Directory | Purpose |
|-----------|---------|
| `src/app/` | Next.js App Router entry: `layout.tsx`, `page.tsx`, `globals.css` |
| `src/components/project/` | Main page components: `Home.tsx` (landing), `Workspace.tsx` (project workspace) |
| `src/components/pipeline/` | Video generation pipeline UI: `PipelineControl.tsx` |
| `src/components/script/` | Script generation: `ScriptChat.tsx` |
| `src/components/common/` | Shared components: `ProtectedMedia.tsx` (auth-gated images) |
| `src/store/` | Zustand store: projects, episodes, scenes, pipeline state |
| `src/services/` | API clients, business logic, DB, video merging, security |

### Data flow

- **State**: Zustand (`src/store/index.ts`) — global app state (projects, episodes, scenes, pipeline)
- **API**: `src/services/api.client.ts` (REST), `src/services/agnes.client.ts` (AI generation)
- **Auth**: LocalStorage API key + `src/services/security.service.ts`
- **DB**: `src/services/db.service.ts` — SQLite via sql.js, stores projects/episodes/scenes

### CI/CD (GitHub Actions)

Workflows in `.github/workflows/`:
- `deploy-dev.yml` / `deploy-prod.yml` — SSH deploy to servers
- On deploy, generates `public/commits.json` (git log) and `public/contributors.json` (git shortlog)
- `preview-deploy.yml` — PR preview deployments

### Design system

Refer to `STYLE.md` for V5 design tokens (warm beige #FAF7F2, terracotta accent #C7512E). CSS variables in `src/app/globals.css`. Do NOT hardcode colors — use `var(--color-*)` variables. Tailwind v4 via `@import "tailwindcss"` (no `@apply` legacy syntax).

## Key patterns

- All pages are `'use client'` — no RSC/server components
- `'@/'` path alias maps to `src/`
- x86_64 Windows + Node 22 + Webpack (Turbopack/SWC not supported)
- `ProtectedImage` component — no `style` prop, use `className`
- Git remotes: `origin` = user fork, `upstream` = fish-es main repo
