---
generated_by: Claude Opus 4.6
generation_date: 2026-02-26
model_version: claude-opus-4-6
purpose: implementation_plan
status: implemented
human_reviewer: matthewvivian
tags: [multi-framework, vite, express, adapters, architecture]
---

# Multi-Framework Adapters (Issue #17)

## Problem

review-loop was Astro-only despite having no fundamental Astro dependency in its core — the REST API middleware, browser annotation overlay, JSON storage, and MCP server are all framework-agnostic. The only Astro-specific code was ~55 lines in `src/index.ts`.

Users of Vite-based frameworks (SvelteKit, Nuxt, Remix) and Express/Connect servers couldn't use the tool without adopting Astro.

## Approach

Extract the Astro adapter, decouple the middleware from Vite types, and add thin adapters for Vite and Express. Each adapter is 15-50 lines and shares `ReviewStorage` + `createMiddleware` directly — no shared setup abstraction needed.

### Phase 1: Extract Astro adapter, decouple middleware

- Moved `src/index.ts` to `src/integrations/astro.ts`
- `src/index.ts` now re-exports from `./integrations/astro.js` (zero breaking change)
- Replaced `import type { Connect } from 'vite'` in middleware with native `http` types
- Exported `MiddlewareHandler` type for adapter use

### Phase 2: Vite plugin adapter

- Created `src/integrations/vite.ts` — standalone Vite `Plugin`
- `apply: 'serve'` ensures dev-only
- `configureServer` registers API middleware, serves client.js at `/__inline-review/client.js`, unwatches storage
- `transformIndexHtml` injects client script tag
- Export: `review-loop/vite`

### Phase 3: Express/Connect adapter

- Created `src/integrations/express.ts` — returns `{ apiMiddleware, clientMiddleware }`
- No auto-HTML-injection — users add one `<script>` tag manually
- `clientMiddleware` serves bundled client.js from the package's dist directory
- Export: `review-loop/express`

## Key Design Decisions

1. **No shared setup function** — each adapter is thin enough that a shared abstraction adds indirection without DRY benefit
2. **`transformIndexHtml` for Vite** — standard Vite mechanism, works with all Vite-based frameworks
3. **No auto-HTML-injection for Express** — fragile to implement; explicit `<script>` tag is one line and reliable
4. **`astro:page-load` listener stays in client** — never fires in non-Astro frameworks, zero cost
5. **Zero breaking changes** — `import inlineReview from 'review-loop'` continues to work identically

## Verification

- `npm run build` — all dist outputs produced (index.js, client.js, mcp/server.js, integrations/vite.js, integrations/express.js)
- `npm test` — 417 tests pass (14 new adapter tests)
- `npm run lint` — clean
- Type declarations generated for all exports
