---
generated_by: Claude Opus 4.6
generation_date: 2026-02-27
model_version: claude-opus-4-6
purpose: implementation_plan
status: draft
human_reviewer: matthewvivian
tags: [nextjs, adapter, framework-support, architecture]
related_issue: "Follow-up to #17 — Next.js adapter"
---

# Engineering Plan: Next.js Adapter

## Problem

The multi-framework work (#17) added Vite and Express adapters, covering Astro, all Vite-based frameworks (SvelteKit, Nuxt, Remix), and Express/Connect. The notable gap is **Next.js**, which uses Turbopack (not Vite) and has no plugin system comparable to Vite's `configureServer` + `transformIndexHtml`.

Next.js is the most popular React meta-framework and a significant portion of the target audience. Without a dedicated adapter, Next.js users would need to either set up a custom server with the Express adapter (losing Turbopack benefits) or wire things up manually.

## Next.js Architecture Constraints

Unlike Vite-based frameworks, Next.js:

1. **Uses Turbopack** (Rust-based bundler) — no Vite plugin API, no `configureServer` hook
2. **Manages its own dev server** — cannot be replaced or extended with arbitrary middleware
3. **Has no `transformIndexHtml` equivalent** — no hook to inject scripts into HTML responses
4. **Routes API endpoints via file-based Route Handlers** — `app/api/*/route.ts`

This means the adapter pattern must be fundamentally different from Vite/Express.

## Approach

The Next.js adapter provides two exports that users wire into their project:

1. **Route Handler factory** — creates `GET`, `POST`, `PATCH`, `DELETE` exports for `app/api/__inline-review/[...route]/route.ts`
2. **React component** — `<InlineReviewScript />` for the root layout, conditionally renders the client `<script>` tag in dev only

This is a "guided setup" pattern (similar to how NextAuth, tRPC, and Prisma integrate with Next.js) rather than a zero-config plugin.

### Why not a custom server?

Next.js supports custom servers (`createServer`), but:
- Loses Turbopack/HMR optimisations
- Next.js docs discourage it for most use cases
- Defeats the purpose of a framework-native adapter

### Why not middleware.ts / proxy.ts?

Next.js middleware runs on the Edge Runtime, which doesn't support Node.js APIs (`fs`, `path`, `crypto`) needed by `ReviewStorage`. The API must run in the Node.js runtime via Route Handlers.

## Adapter Design

### Entry point: `review-loop/nextjs`

```typescript
// src/integrations/nextjs.ts

import { resolve } from 'node:path';
import { ReviewStorage } from '../server/storage.js';
import { createMiddleware } from '../server/middleware.js';
import type { InlineReviewOptions } from '../types.js';

export type { InlineReviewOptions } from '../types.js';

interface NextRouteHandlers {
  GET: (request: Request) => Promise<Response>;
  POST: (request: Request) => Promise<Response>;
  PATCH: (request: Request) => Promise<Response>;
  DELETE: (request: Request) => Promise<Response>;
}

/**
 * Creates Next.js Route Handler exports for the inline-review REST API.
 *
 * Usage in app/api/__inline-review/[...route]/route.ts:
 *   export const { GET, POST, PATCH, DELETE } = createHandler();
 */
export function createHandler(options: InlineReviewOptions = {}): NextRouteHandlers {
  const storagePath = options.storagePath
    ? resolve(options.storagePath)
    : resolve(process.cwd(), 'inline-review.json');
  const storage = new ReviewStorage(storagePath);
  const middleware = createMiddleware(storage);

  // Adapt Connect-style middleware to Web Fetch API (Request → Response)
  async function handleRequest(request: Request): Promise<Response> {
    // Dev-only guard
    if (process.env.NODE_ENV !== 'development') {
      return new Response('Not Found', { status: 404 });
    }

    // Convert Web Request to Node-compatible objects for the shared middleware
    // ... (adapter logic to bridge Request/Response APIs)
  }

  return {
    GET: handleRequest,
    POST: handleRequest,
    PATCH: handleRequest,
    DELETE: handleRequest,
  };
}
```

### Client component: `review-loop/nextjs/script`

```tsx
// src/integrations/nextjs-script.tsx

'use client';

import Script from 'next/script';

/**
 * Injects the inline-review client script in development only.
 *
 * Usage in app/layout.tsx:
 *   import { InlineReviewScript } from 'review-loop/nextjs/script';
 *   // ... in JSX: <InlineReviewScript />
 */
export function InlineReviewScript() {
  if (process.env.NODE_ENV !== 'development') return null;
  return <Script src="/api/__inline-review/client.js" strategy="afterInteractive" />;
}
```

**Alternative (no JSX dependency):** Provide a plain `<script>` string or a helper that users paste into their layout, avoiding a React/JSX build dependency in the package. This is the simpler approach:

```typescript
// src/integrations/nextjs.ts (additional export)

/**
 * Returns the script tag HTML string for manual injection.
 * Only returns content in development; returns empty string in production.
 */
export function getClientScriptTag(): string {
  if (process.env.NODE_ENV !== 'development') return '';
  return '<script type="module" src="/api/__inline-review/client.js"></script>';
}
```

## Key Technical Challenge: Request/Response Bridge

The shared middleware (`createMiddleware`) uses Connect-style `(req: IncomingMessage, res: ServerResponse, next)` signatures. Next.js Route Handlers use the Web Fetch API (`Request` → `Response`).

Two options:

### Option A: Adapt at the Next.js layer

Write a thin bridge in `nextjs.ts` that converts `Request` → mock `IncomingMessage` and captures `ServerResponse` output → `Response`. This keeps the shared middleware unchanged.

```typescript
function webToNode(request: Request): { req: http.IncomingMessage; body: Buffer } {
  // Convert headers, method, URL, body from Web Request to Node equivalents
}

function captureResponse(): { res: http.ServerResponse; getResponse: () => Response } {
  // Create a mock ServerResponse that captures writeHead + end calls
  // Return a function that builds a Web Response from the captured data
}
```

### Option B: Add a Web-native middleware variant

Add a second function in `middleware.ts` that works directly with `Request`/`Response`. This duplicates some routing logic but avoids the conversion overhead.

**Recommendation:** Option A. The conversion is straightforward (we already mock these objects in tests), keeps the middleware DRY, and the overhead is negligible for a dev-only tool.

## User Setup

### 1. Install

```bash
npm install -D review-loop
```

### 2. Create the API route

```typescript
// app/api/__inline-review/[...route]/route.ts
import { createHandler } from 'review-loop/nextjs';

export const { GET, POST, PATCH, DELETE } = createHandler();
```

### 3. Add the client script to the root layout

```tsx
// app/layout.tsx
import { InlineReviewScript } from 'review-loop/nextjs/script';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        {children}
        <InlineReviewScript />
      </body>
    </html>
  );
}
```

### 4. Connect MCP (same as all frameworks)

`.mcp.json` setup is identical — the MCP server reads `inline-review.json` directly.

## Production Safety

- Route Handlers return 404 when `NODE_ENV !== 'development'`
- `InlineReviewScript` renders `null` in production
- The route file still exists in the production bundle but does nothing — this is the standard Next.js pattern (same as NextAuth, tRPC)
- Tree-shaking removes dead imports in production builds

## Changes by Layer

### New files

| File | Purpose |
|------|---------|
| `src/integrations/nextjs.ts` | Route Handler factory + helper exports |
| `src/integrations/nextjs-script.tsx` | React client component for script injection |
| `tests/integrations/nextjs.test.ts` | Adapter tests |

### Modified files

| File | Change |
|------|--------|
| `package.json` | Add `./nextjs` and `./nextjs/script` exports, add `next` optional peer dep |
| `tsup.config.ts` | Add Next.js adapter entry points |
| `vitest.config.ts` | Already has `integrations` test project |
| `README.md` | Add Next.js quickstart section |
| `CLAUDE.md` | Add Next.js adapter to key file paths |
| `docs/spec/specification.md` | Add Next.js row to adapter model table |

## Open Questions

1. **JSX build dependency**: Should the package include a JSX component (`nextjs-script.tsx`), or is a plain string helper sufficient? The JSX component is more ergonomic but requires a React JSX transform in the build pipeline (tsup supports this). The string helper avoids the dependency entirely.

2. **Client bundle serving**: The Route Handler needs to serve `dist/client.js` at `/api/__inline-review/client.js`. This requires resolving the file path from the installed package — same pattern as the Express adapter's `clientMiddleware`, but via a Route Handler `GET` response.

3. **Next.js version support**: Target Next.js 14+ (App Router) or also support Pages Router? Recommendation: App Router only (14+) — Pages Router is legacy and declining in adoption.

4. **Package naming**: Currently `review-loop/nextjs`. If non-Astro adoption grows, a package rename to `inline-review` may be warranted (out of scope for this plan).

## Test Plan

| Test | What to verify |
|------|----------------|
| `createHandler()` returns object with GET/POST/PATCH/DELETE functions | Shape test |
| Route handlers return 404 in production mode | Dev-only guard |
| GET `/annotations` returns annotation list | API integration via bridge |
| POST `/annotations` creates an annotation | Write path via bridge |
| Client script component renders in dev, returns null in prod | Conditional rendering |
| `getClientScriptTag()` returns script tag in dev, empty in prod | Helper function |

## Implementation Sessions

### Session 1 — Request/Response bridge + Route Handler factory

**Entry state:** Multi-framework adapters merged on `main`.

**Tasks:**
1. Implement Web Request → Node IncomingMessage bridge in `src/integrations/nextjs.ts`
2. Implement Node ServerResponse → Web Response capture
3. Implement `createHandler()` factory
4. Add client bundle serving via the `[...route]` catch-all
5. Write unit tests for the bridge and handler
6. Verify build with `npm run build`

**Exit state:** `createHandler()` works with mocked Request objects. All tests pass.

### Session 2 — Client component + documentation

**Entry state:** Session 1 committed.

**Tasks:**
1. Implement `InlineReviewScript` component (or string helper — decide based on open question #1)
2. Add `./nextjs` and `./nextjs/script` to `package.json` exports
3. Update README with Next.js quickstart
4. Update spec and CLAUDE.md
5. Write component tests
6. Full test suite + build verification

**Exit state:** Complete Next.js adapter with documentation. All tests pass.

### Session 3 — Manual testing + review

**Entry state:** Session 2 committed.

**Tasks:**
1. Create minimal Next.js example in `examples/nextjs/`
2. Manual verification of annotation overlay in Next.js dev server
3. Independent code review
4. Address findings

**Exit state:** Verified, reviewed Next.js adapter ready for release.
