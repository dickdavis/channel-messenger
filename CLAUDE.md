# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Channel Messenger is a personal chat interface for communicating with Claude Code sessions. Built with SvelteKit 2 (Svelte 5 with runes mode) and deployed to Cloudflare Workers with D1 (SQLite) as the database. Authentication is via GitHub OAuth, and API access uses HMAC-signed bearer tokens.

## Commands

- `bun run dev` — start dev server (requires `.dev.vars` and `wrangler.toml`)
- `bun run build` — production build
- `bun run check` — type-check (svelte-kit sync + svelte-check)
- `bun run test` — run tests (`bun test --conditions browser`)
- `bun run test -- src/lib/components/InputArea.test.ts` — run a single test file
- `bun run lint` — lint with ts-standard
- `bun run format` — auto-fix lint issues
- `bun run db:migrate` — apply D1 migrations locally
- `bun run db:reset` — nuke local DB and re-apply migrations

## Architecture

**Two authentication paths** coexist in `hooks.server.ts`:
- **Browser sessions**: HMAC-signed cookies (created via GitHub OAuth flow in `/auth/*` routes). Used by the UI and internal routes.
- **API tokens**: Bearer tokens verified against hashed values in the `api_keys` table. Used by `/api/*` routes (the MCP server interface).

Both auth paths resolve to `locals.user` or `locals.apiUser` respectively.

**Route split**: The app has parallel route sets for the same resources:
- `/api/sessions/*` — external API (bearer token auth, used by Claude Code sessions)
- `/sessions/*` — internal browser routes (cookie auth, used by the SvelteKit UI)

**Database**: Single D1 database with four tables: `users`, `sessions`, `api_keys`, `messages`. Migrations live in `migrations/`. Environment bindings are typed in `src/app.d.ts` under `App.Platform`.

**Testing**: Bun test runner with a custom Svelte compiler plugin (`src/tests/svelte-loader.ts`) that compiles `.svelte` files on the fly. Uses `@testing-library/svelte` and `happy-dom`. Tests are colocated next to components as `*.test.ts`.

## Code Style

- Linter is **ts-standard** (TypeScript Standard Style) — no semicolons, single quotes, 2-space indent.
- Svelte components use **runes mode** (`$state`, `$props`, `$effect`, etc.) — this is enforced in `svelte.config.js`.
- All platform env vars are accessed via `event.platform.env` (Cloudflare Workers pattern), not `process.env`.
