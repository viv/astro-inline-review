---
generated_by: Claude Sonnet 4.6
generation_date: 2026-02-23
model_version: claude-sonnet-4-6
purpose: implementation_plan
status: implemented
human_reviewer: matthewvivian
implementation_tracking: complete
tags: [framework-agnostic, vite, express, adapters, architecture]
related_issue: "#17 — Support multiple web frameworks beyond Astro"
---

# Engineering Plan: Multi-Framework Adapters (Issue #17)

## Problem

The tool is distributed as an Astro integration only. The Astro-specific code is confined to `src/index.ts` (~50 lines), but because no other entry points are published, teams using Vite, SvelteKit, Nuxt, Next.js, Remix, or plain Express cannot adopt the tool without wrapping it themselves.

The core layers — REST API middleware, browser annotation overlay, JSON storage, and MCP server — have no dependency on Astro at all. This is a publishing and integration-surface problem, not an architecture problem.

## Coupling Audit

| Layer | File(s) | Astro/Vite coupling | Notes |
|-------|---------|---------------------|-------|
| Astro integration | `src/index.ts` | Full | Astro hooks, `injectScript`, `updateConfig` |
| REST middleware | `src/server/middleware.ts` | Types only | `import type { Connect } from 'vite'` — type-only, no runtime dep |
| Storage | `src/server/storage.ts` | None | Pure Node.js |
| Client bundle | `src/client/` | None | Pure browser JS |
| MCP server | `src/mcp/` | None | Pure Node.js |
| Shared types/logic | `src/shared/` | None | Pure TypeScript |

The `Connect` type import in `middleware.ts` represents the only non-Astro coupling outside `src/index.ts`. Since `vite` ships `Connect` types and is already a transitive dependency (via `astro`), this is a non-issue at runtime. For the Express adapter, the same middleware function will work without modification — Express is Connect-compatible.

## Approach

Introduce two new adapter entry points alongside the existing Astro integration:

1. **Vite plugin** (`review-loop/vite`) — dev-only Vite plugin; covers SvelteKit, Nuxt 3, Remix (Vite mode), and plain Vite apps with a one-line config change
2. **Express/Connect middleware** (`review-loop/express`) — explicit mount + HTML injection helper; covers server-rendered Node apps and any Connect-compatible server

The existing Astro integration (`review-loop`) is unchanged and remains the primary entry point. All three adapters share the same `ReviewStorage` and `createMiddleware` internals.

A package rename (`inline-review`) is out of scope for this issue but worth noting as a future consideration if non-Astro adoption is strong.

## Adapter Specifications

### Vite Plugin (`src/integrations/vite.ts`)

```typescript
import type { Plugin } from 'vite';
import { resolve } from 'node:path';
import { ReviewStorage } from '../server/storage.js';
import { createMiddleware } from '../server/middleware.js';

export interface InlineReviewViteOptions {
  storagePath?: string;
}

export function inlineReview(options: InlineReviewViteOptions = {}): Plugin {
  let storage: ReviewStorage;

  return {
    name: 'inline-review',
    apply: 'serve',               // dev-only — zero production cost
    configResolved(config) {
      const root = config.root;
      const storagePath = options.storagePath
        ? resolve(options.storagePath)
        : resolve(root, 'inline-review.json');
      storage = new ReviewStorage(storagePath);
    },
    configureServer(server) {
      server.middlewares.use(createMiddleware(storage));
    },
    transformIndexHtml() {
      // Inject client via virtual module — avoids hardcoding dist paths
      return [{
        tag: 'script',
        attrs: { type: 'module' },
        children: `import 'review-loop/client';`,
        injectTo: 'body',
      }];
    },
  };
}
```

**Usage (vite.config.ts):**
```typescript
import { inlineReview } from 'review-loop/vite';
export default { plugins: [inlineReview()] };
```

The `apply: 'serve'` guard ensures the plugin activates only during `vite dev` and is a no-op in `vite build`. The `transformIndexHtml` hook injects the client module into every HTML response, mirroring what Astro's `injectScript('page', ...)` does.

### Express/Connect Adapter (`src/integrations/express.ts`)

Express apps own their HTML responses directly, so automatic script injection is only possible via an HTML-rewriting middleware. The adapter provides both the API middleware and an optional HTML injection middleware:

```typescript
import { resolve } from 'node:path';
import type http from 'node:http';
import { ReviewStorage } from '../server/storage.js';
import { createMiddleware } from '../server/middleware.js';

export interface InlineReviewExpressOptions {
  storagePath?: string;
  root?: string;
}

export interface InlineReviewExpressInstance {
  /** Mount on your Express app to enable the REST API and serve the client bundle */
  apiMiddleware: (req: http.IncomingMessage, res: http.ServerResponse, next: () => void) => void;
  /** Optional: mount to auto-inject the client <script> into all text/html responses */
  htmlMiddleware: (req: http.IncomingMessage, res: http.ServerResponse, next: () => void) => void;
}

export function inlineReview(options: InlineReviewExpressOptions = {}): InlineReviewExpressInstance {
  const storagePath = options.storagePath
    ? resolve(options.storagePath)
    : resolve(options.root ?? process.cwd(), 'inline-review.json');

  const storage = new ReviewStorage(storagePath);
  const apiMiddleware = createMiddleware(storage);
  const htmlMiddleware = createHtmlInjectionMiddleware();

  return { apiMiddleware, htmlMiddleware };
}
```

**Usage (Express app):**
```typescript
import express from 'express';
import { inlineReview } from 'review-loop/express';

const app = express();
if (process.env.NODE_ENV !== 'production') {
  const { apiMiddleware, htmlMiddleware } = inlineReview({ root: __dirname });
  app.use(apiMiddleware);
  app.use(htmlMiddleware); // optional — or add <script> tag manually
}
```

The `htmlMiddleware` intercepts responses with `Content-Type: text/html` and appends a `<script type="module" src="/__inline-review/client.js">` tag before `</body>`. The client bundle is served by `apiMiddleware` at that URL.

## Changes by Layer

### 1. New files

| File | Purpose |
|------|---------|
| `src/integrations/astro.ts` | Astro adapter extracted from `src/index.ts` |
| `src/integrations/vite.ts` | New Vite plugin adapter |
| `src/integrations/express.ts` | New Express/Connect adapter |

### 2. `src/index.ts`

Refactored to import and re-export from `src/integrations/astro.ts`. No behaviour change — preserves the current public API exactly.

```typescript
export { default } from './integrations/astro.js';
```

### 3. `src/integrations/astro.ts`

The current contents of `src/index.ts`, extracted verbatim. No logic changes.

### 4. `src/server/middleware.ts`

Minor: extract a `serveClientBundle` route so the Express adapter can serve the client JS at `/__inline-review/client.js`. The Astro and Vite adapters use their own asset pipeline and don't need this.

### 5. `package.json`

Add new exports and update peer dependencies:

```json
{
  "exports": {
    ".":          { "types": "./dist/index.d.ts",                  "import": "./dist/index.js" },
    "./client":   { "import": "./dist/client.js" },
    "./mcp":      { "import": "./dist/mcp/server.js" },
    "./vite":     { "types": "./dist/integrations/vite.d.ts",      "import": "./dist/integrations/vite.js" },
    "./express":  { "types": "./dist/integrations/express.d.ts",   "import": "./dist/integrations/express.js" }
  },
  "peerDependencies": {
    "astro": "^5.0.0",
    "vite": "^5.0.0 || ^6.0.0"
  },
  "peerDependenciesMeta": {
    "astro": { "optional": true },
    "vite":  { "optional": true }
  }
}
```

Making both peer deps optional means users only install what they need. The `astro` peer dep was already present; `vite` is added as optional since the Vite plugin and Express adapter both require it for types.

### 6. `tsup.config.ts` (or equivalent build config)

Add `src/integrations/vite.ts` and `src/integrations/express.ts` as additional entry points.

### 7. `docs/spec/specification.md`

Add a new section covering the adapter model: how each adapter wires up the middleware and injects the client, and what users need to do for each framework.

## Test Plan

| Test file | What to test |
|-----------|-------------|
| `tests/integrations/vite.test.ts` (new) | Plugin registers middleware on Vite dev server, `apply: 'serve'` guard, `transformIndexHtml` injects script tag, storage path resolution |
| `tests/integrations/express.test.ts` (new) | `apiMiddleware` mounts correctly, `htmlMiddleware` injects script into HTML responses, does not inject into non-HTML responses, production guard |
| `tests/integrations/astro.test.ts` (new) | Existing Astro integration behaviour preserved after extraction (smoke test) |
| Existing tests | All 370 existing tests must continue to pass unchanged |

## Implementation Sessions

### Session 1 — Extract Astro adapter, add Vite plugin

**Entry state:** All tests passing on `main`.

**Tasks:**
1. Create `src/integrations/astro.ts` (copy of current `src/index.ts` logic)
2. Refactor `src/index.ts` to re-export from `src/integrations/astro.ts`
3. Implement `src/integrations/vite.ts`
4. Add `./vite` to `package.json` exports
5. Add `vite` as optional peer dependency
6. Add `src/integrations/vite.ts` to build entry points
7. Write tests for the Vite plugin
8. Run full test suite and verify build

**Exit state:** `review-loop/vite` works in a plain Vite app. All existing tests pass.

---

### Session 2 — Express/Connect adapter

**Entry state:** Session 1 committed and passing.

**Tasks:**
1. Implement `src/integrations/express.ts` with `apiMiddleware` and `htmlMiddleware`
2. Implement client bundle serving in `src/server/middleware.ts` (or a new helper)
3. Add `./express` to `package.json` exports
4. Add `src/integrations/express.ts` to build entry points
5. Write tests for Express adapter (use `node:http` test server, no Express required for tests)
6. Run full test suite and verify build

**Exit state:** `review-loop/express` works in a Connect-compatible Node.js app. All existing tests pass.

---

### Session 3 — Documentation, spec, and review

**Entry state:** Sessions 1 and 2 committed and passing.

**Tasks:**
1. Update `docs/spec/specification.md` — add adapter model section
2. Update `README.md` — installation and usage for Vite and Express
3. Add framework-specific usage examples to `docs/guides/`
4. Independent code review
5. Address review findings
6. Update this engineering plan to `status: implemented`
