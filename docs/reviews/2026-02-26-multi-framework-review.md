---
generated_by: Claude Opus 4.6
generation_date: 2026-02-26
model_version: claude-opus-4-6
purpose: code_review
status: draft
human_reviewer: matthewvivian
tags: [multi-framework, code-review]
---

# Multi-Framework Adapter Implementation — Code Review

## Summary

The multi-framework adapter implementation is **well-executed**. The extraction from a monolithic `src/index.ts` into three thin adapters (`astro.ts`, `vite.ts`, `express.ts`) is clean, and the middleware decoupling from Vite types to native `http` types was the right architectural move. The shared core (`ReviewStorage` + `createMiddleware`) is genuinely framework-agnostic now.

**Key strengths:**
- Zero breaking changes — the `import inlineReview from 'review-loop'` path is fully preserved
- Middleware uses only `http.IncomingMessage`/`http.ServerResponse` — no framework coupling
- Each adapter is 15–55 lines with no shared abstraction layer (correctly avoids premature DRY)
- Build outputs all correct: `.js`, `.d.ts`, and `.js.map` for every entry point
- 417 tests pass, lint is clean, build is clean
- `package.json` exports map is well-structured with proper `types` and `import` conditions
- Documentation (README, spec, CLAUDE.md) all updated consistently

**Verification results:**
- `npm run build` — all outputs produced (see Build Outputs section)
- `npm test` — 417 tests pass (28 test files, including 14 new adapter tests)
- `npm run lint` — clean
- Path resolution for `client.js` — verified correct for both Vite and Express adapters

---

## Issues

### Critical

None found.

### Important

#### I-1: `InlineReviewOptions` type not re-exported from `/vite` and `/express` entry points

**Files:** `src/integrations/vite.ts`, `src/integrations/express.ts`

Both the Vite and Express adapters import `InlineReviewOptions` from `../types.js` but do not re-export it. Users who want to type their options must import from the main entry point:

```typescript
// This works
import type { InlineReviewOptions } from 'review-loop';

// This does NOT work (type not exported)
import type { InlineReviewOptions } from 'review-loop/vite';
```

This matters because a Vite-only or Express-only user may never install `astro` (it's an optional peer dep), and importing from the root entry point will produce a TypeScript error since `dist/index.d.ts` references `AstroIntegration` from `astro`.

**Recommendation:** Add `export type { InlineReviewOptions } from '../types.js';` to both `vite.ts` and `express.ts`. This allows framework-specific users to get the options type from their own entry point without needing the Astro type declarations.

#### I-2: Root `index.d.ts` has hard dependency on `astro` types

**File:** `dist/index.d.ts`

The generated declaration file has `import { AstroIntegration } from 'astro'` at the top. If a Vite-only user happens to import from `'review-loop'` (e.g. for the `InlineReviewOptions` type, since it's only exported there — see I-1), TypeScript will error because `astro` is not installed.

This is partially mitigated by the optional peer dep declaration, but it means `InlineReviewOptions` is effectively inaccessible to non-Astro users without installing Astro's type declarations. Fixing I-1 resolves this for practical purposes.

#### I-3: Astro adapter re-export test uses identity comparison that may not hold post-build

**File:** `tests/integrations/astro.test.ts`, line 20

```typescript
it('is re-exported from the main entry point', async () => {
  const main = await import('../../src/index.js');
  expect(main.default).toBe(inlineReview);
});
```

This test asserts `main.default === inlineReview` (identity via `toBe`). It works in source because `src/index.ts` uses `export { default }` which is a live binding re-export. However, after `tsup` bundles the code, `dist/index.js` inlines the Astro adapter code rather than re-exporting it — meaning this identity guarantee would not hold if the test ran against built output.

This is not currently a problem (tests run against source), but it's worth noting. The test verifies the source-level contract, not the published package contract. Consider changing to `toEqual` or testing the shape instead, which would be resilient to bundling.

### Minor

#### M-1: Inconsistent `client.js` path resolution patterns between Vite and Express adapters

**Files:** `src/integrations/vite.ts` (line 37-38), `src/integrations/express.ts` (line 31-32)

The Vite adapter uses:
```typescript
const thisFile = fileURLToPath(import.meta.url);
clientJsPath = resolve(thisFile, '..', '..', 'client.js');
```

The Express adapter uses:
```typescript
const __dirname = dirname(fileURLToPath(import.meta.url));
const clientJsPath = resolve(__dirname, '..', 'client.js');
```

Both produce the correct result (`dist/client.js`), but the Vite version relies on `resolve` treating a file path's `..` as if it were `dirname` — which works because `resolve('/a/b/file.js', '..')` yields `/a/b`, but is less obvious than explicitly calling `dirname` first. The Express version is clearer.

**Recommendation:** Adopt the Express pattern (`dirname` then `resolve`) in the Vite adapter for consistency and clarity.

#### M-2: Vite adapter error handling on `client.js` read returns 404 directly, Express calls `next()`

**Files:** `src/integrations/vite.ts` (line 54-57), `src/integrations/express.ts` (line 45-46)

When the bundled `client.js` cannot be read:
- **Vite adapter**: responds with `res.writeHead(404); res.end('Client script not found');`
- **Express adapter**: calls `next()` (falls through to other middleware)

The Express approach is more idiomatic for middleware stacks — falling through allows a downstream handler to potentially serve the file or produce a more contextual error. The Vite approach is fine for a Vite plugin (since there's typically nothing else to serve the file), but the inconsistency could confuse someone reading both adapters side-by-side.

**Recommendation:** Minor, but consider documenting the rationale or aligning the behaviour. The current state is defensible — just worth a brief comment explaining why they differ.

#### M-3: Express adapter uses `process.cwd()` for default storage path; Vite and Astro use project root

**Files:** `src/integrations/express.ts` (line 26), `src/integrations/vite.ts` (line 32), `src/integrations/astro.ts` (line 25)

Default storage path resolution:
- **Astro**: `config.root` (Astro config)
- **Vite**: `server.config.root` (Vite config)
- **Express**: `process.cwd()`

This is a sensible default for Express (no config object provides a project root), but it behaves differently if the Express app is started from a different directory than the project root. Worth documenting that `storagePath` should be set explicitly in Express projects where `cwd` may differ from the project root.

#### M-4: Vite plugin name differs from Astro plugin name

**Files:** `src/integrations/vite.ts` (line 23), `src/integrations/astro.ts` (line 34)

- Vite standalone plugin: `name: 'inline-review'`
- Astro's inner Vite plugin: `name: 'review-loop-middleware'`

If a user accidentally includes both the Astro integration and the Vite plugin, there would be no name collision warning from Vite because the names differ. This is not necessarily wrong (Vite does not enforce unique plugin names anyway), but a shared prefix like `inline-review` or `review-loop` would make it easier to spot in debug output. Low priority.

### Nit

#### N-1: Middleware JSDoc comment still says "Vite dev server middleware"

**File:** `src/server/middleware.ts` (line 72)

```typescript
/**
 * Creates Vite dev server middleware that serves the REST API.
```

Now that the middleware is framework-agnostic and used by all three adapters, this JSDoc should say something like "Creates HTTP middleware that serves the REST API" rather than referencing Vite specifically.

#### N-2: Default vs named export inconsistency between adapters

**Files:** `src/integrations/vite.ts`, `src/integrations/express.ts`

- Vite: `export default function inlineReviewVite(...)` — usage: `import inlineReview from 'review-loop/vite'`
- Express: `export function inlineReview(...)` — usage: `import { inlineReview } from 'review-loop/express'`

The README documents both correctly, and the engineering plan notes this as a deliberate choice (Express returns an object with two functions rather than a single value, so a named export is more natural). The inconsistency is understandable but worth noting — some users may find it surprising that the import style changes between adapters.

This is documented in the README with clear code examples, so the practical impact is low.

#### N-3: `as const` assertion in Vite `transformIndexHtml` is unnecessary

**File:** `src/integrations/vite.ts` (line 72)

```typescript
injectTo: 'body' as const,
```

The `as const` is redundant here because the object is returned from a function whose return type already constrains the value. TypeScript infers the literal type correctly without it. Harmless but unnecessary.

#### N-4: Express test directory cleanup is not complete

**File:** `tests/integrations/express.test.ts` (lines 8, 62-74)

The test creates `TEST_DIR` (a temporary directory) and `TEST_FILE` within it, but `afterEach` only cleans up the file, not the directory. The directory is unique per test run (includes `Date.now()`), so it won't cause test interference, but it does leave behind empty directories in the system temp folder.

**Recommendation:** Add directory cleanup in an `afterAll` hook, or use a `vi.afterAll(() => rmdirSync(TEST_DIR, { recursive: true }))`.

---

## Build Outputs

All expected outputs are produced:

| File | Size | Purpose |
|------|------|---------|
| `dist/index.js` | 1.17 KB | Astro adapter (re-exports from astro.ts) |
| `dist/index.d.ts` | 505 B | Astro adapter types |
| `dist/integrations/vite.js` | 1.59 KB | Vite plugin adapter |
| `dist/integrations/vite.d.ts` | 489 B | Vite plugin types |
| `dist/integrations/express.js` | 1.05 KB | Express adapter |
| `dist/integrations/express.d.ts` | 842 B | Express adapter types |
| `dist/client.js` | 87.74 KB | Browser client bundle |
| `dist/mcp/server.js` | (existing) | MCP server |
| `dist/chunk-IBA2DLDS.js` | 16.12 KB | Shared chunk (ReviewStorage + createMiddleware) |
| `dist/types-CvYf1EWr.d.ts` | 243 B | Shared InlineReviewOptions type |

The shared chunk (`chunk-IBA2DLDS.js`) is a nice outcome of tsup's code-splitting — the three server-side entry points all share `ReviewStorage` and `createMiddleware` without duplication.

---

## Edge Cases Examined

### Vite user also has Astro installed

If a user has both `astro` and `vite` installed and accidentally uses the Vite plugin instead of the Astro integration:
- The Vite plugin will work correctly (it's a standalone Vite plugin)
- Client injection happens via `transformIndexHtml` instead of `injectScript`
- The `astro:page-load` listener in the client will never fire (the event doesn't exist outside Astro), but it's a no-op listener — zero cost, zero errors
- **No conflict** — this scenario is safe

### `astro:page-load` in non-Astro environments

The client script registers `document.addEventListener('astro:page-load', ...)` unconditionally. In non-Astro frameworks:
- The event is never dispatched
- The listener silently does nothing
- No errors, no performance impact
- This is the correct design — removing the listener conditionally would add complexity for zero benefit

### Express without explicit `storagePath`

If an Express app's `process.cwd()` is not the project root (e.g. started from a parent directory, or within a monorepo workspace), the default `inline-review.json` path may not match where the MCP server expects it. The README should note this (see M-3). Users working in monorepos should pass `storagePath` explicitly.

---

## Recommendations

1. **Fix I-1** (Important): Re-export `InlineReviewOptions` from the Vite and Express entry points. This is a one-line change in each file and unblocks non-Astro users from accessing the options type.

2. **Fix N-1** (Nit): Update the middleware JSDoc to remove the Vite-specific reference.

3. **Consider I-3** (Important): Change the Astro re-export test to use `toEqual` or shape-checking rather than identity comparison, so it's resilient to bundler behaviour changes.

4. **Consider M-1** (Minor): Align the `client.js` path resolution pattern between adapters for consistency.

5. **Consider M-3** (Minor): Add a note in the Express README section about `process.cwd()` behaviour and recommending explicit `storagePath` in monorepo setups.

---

## Verdict

The implementation is solid and ready to merge with minor follow-up items. The architecture is clean, the breaking-change risk is zero, and the test coverage is adequate. The issues identified are all minor or nit-level except for I-1 (missing type re-export), which should be addressed before publishing to npm to avoid frustrating non-Astro users.
