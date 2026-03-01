# Architecture Review: review-loop

**Date:** 2026-02-22
**Reviewer:** arch-reviewer (automated)
**Scope:** Full system architecture — client, server, MCP, build, types, data flow

---

## Executive Summary

review-loop has a clean, well-partitioned architecture that effectively serves its purpose as a dev-only annotation overlay. The three-tier build (server integration, browser client, MCP server) maps directly to three distinct runtime contexts with appropriate boundaries. The codebase is small enough that its current patterns are proportionate — most findings are forward-looking concerns rather than present-day problems.

**Key strengths:**
- Sharp dev-only boundary via `command !== 'dev'` guard
- Clean separation of client/server/MCP concerns
- Shared type definitions avoid drift
- Write queue prevents concurrent file corruption
- Shadow DOM isolates UI from host site styles
- MCP tool registration pattern is clean and extensible

**Key concerns:**
- Read-modify-write race condition between MCP and browser clients
- Duplicated export logic across client and shared modules
- localStorage cache has no invalidation strategy
- JSON file storage has inherent scaling limitations
- Mediator pattern uses mutable assignment rather than proper wiring

---

## System Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                    Astro Dev Server                       │
│                                                          │
│  ┌─────────────┐    ┌───────────────┐    ┌───────────┐  │
│  │  index.ts   │───▶│  Vite Plugin  │───▶│ Middleware │  │
│  │ (integration│    │  (configures  │    │ (REST API) │  │
│  │  entry)     │    │   dev server) │    │            │  │
│  └──────┬──────┘    └───────────────┘    └─────┬──────┘  │
│         │                                      │         │
│         │ injectScript('page')                 │         │
│         ▼                                      ▼         │
│  ┌─────────────┐                      ┌──────────────┐   │
│  │ Client      │  ◀── fetch() ──────▶ │ ReviewStorage│   │
│  │ (browser)   │                      │ (JSON file)  │   │
│  └─────────────┘                      └──────┬───────┘   │
│                                              │           │
└──────────────────────────────────────────────┼───────────┘
                                               │
                              ┌─────────────────┘
                              │ Direct file I/O
                              ▼
                      ┌──────────────┐
                      │ MCP Server   │ (separate process)
                      │ (stdio)      │
                      │              │
                      │ ReviewStorage│
                      └──────────────┘
```

---

## 1. Separation of Concerns

### Severity: Info

The system has three well-defined boundaries:

| Layer | Runtime | Entry Point | Responsibility |
|-------|---------|-------------|----------------|
| **Integration** | Node.js (Astro) | `src/index.ts` | Lifecycle hook, wiring |
| **Server** | Node.js (Vite middleware) | `src/server/middleware.ts` | REST API, storage |
| **Client** | Browser | `src/client/index.ts` | UI, highlights, selection |
| **MCP** | Node.js (standalone CLI) | `src/mcp/server.ts` | Agent tool interface |
| **Shared** | Both | `src/shared/types.ts`, `src/shared/export.ts` | Types, export generation |

**Strengths:**
- Each layer can be reasoned about independently
- The integration entry point (`src/index.ts`) is just 48 lines — purely wiring, no logic
- Client has its own `api.ts` abstraction hiding HTTP details from UI code
- MCP tools are individual files with `register()` functions — easy to add/remove

**Observation:** The `shared/` directory correctly captures cross-cutting concerns (types, export). This is a good pattern — it prevents the client and server from importing each other's code.

---

## 2. Data Flow and Annotation Lifecycle

### Severity: Medium — Read-Modify-Write Race Condition

**Normal lifecycle (browser):**
```
User action → Client (annotator.ts) → api.ts → fetch() → Middleware → Storage.read()
                                                                         ↓
                                                                    Storage.write()
                                                                         ↓
Client updates highlights + cache ◀──────── JSON response ◀──── Middleware
```

**MCP lifecycle (agent):**
```
Agent tool call → MCP Server → Storage.read() → mutate → Storage.write()
```

**The race condition:** Both the browser client (via middleware) and MCP server access `ReviewStorage` instances that point to the same JSON file. The write queue in `ReviewStorage` serialises writes *within a single process*, but the browser middleware and MCP server run in **separate processes**. The sequence:

1. MCP reads store (has annotations A, B, C)
2. Browser middleware reads store (has annotations A, B, C)
3. Browser creates annotation D, writes {A, B, C, D}
4. MCP resolves annotation A, writes {A', B, C} — **D is lost**

**Impact:** Low in practice (single developer workflow), but structurally unsound for the stated "MCP + browser simultaneously" use case.

**Possible mitigations:**
- File-level locking (e.g., `proper-lockfile`)
- Re-read before write (optimistic concurrency — already partly done since each handler reads then writes, but the window is still open during the mutation logic)
- Accept the limitation and document it

---

## 3. State Management

### Severity: Medium — Cache Invalidation

**Client-side state has three layers:**

| Layer | Location | Freshness |
|-------|----------|-----------|
| DOM highlights | Light DOM `<mark>` elements | Visual only — no data |
| localStorage cache | `cache.ts` `writeCache/readCache` | Written after every API call |
| Server store | JSON file via REST API | Source of truth |

**Concerns:**

1. **No cache TTL or invalidation signal.** The localStorage cache (`cache.ts`) is written after API calls but never invalidated. If the JSON file is edited externally (by MCP or by hand), the browser cache is stale until the next `restoreHighlights()` call or manual refresh.

2. **Cache used as primary read in edit flows.** In `annotator.ts:368` and `annotator.ts:403`, the code does:
   ```typescript
   const store = readCache() ?? await api.getStore(window.location.pathname);
   ```
   This prefers the potentially-stale cache over a fresh API call. For a dev tool this is pragmatic (faster response), but it means edits made via MCP won't be visible until the next full refresh.

3. **No polling or push mechanism.** There's no way for the client to discover that annotations changed externally. This is an acceptable limitation for v0.1.0 but should be documented.

### Severity: Low — Mediator Mutation Pattern

The `ReviewMediator` interface (`mediator.ts`) is wired up by mutating the object after construction:

```typescript
// In index.ts
const mediator: ReviewMediator = {
  refreshPanel: async () => {},   // stub
  restoreHighlights: async () => {},  // stub
};

// Later, in createAnnotator:
mediator.restoreHighlights = restoreHighlights;  // mutated
```

This works but is fragile — if `createAnnotator` fails or is called out of order, the stubs remain silently. A factory function returning the wired mediator would be cleaner. However, this is a very small codebase and the current approach is perfectly readable.

---

## 4. Type Sharing

### Severity: Info — Clean Chain

```
src/shared/types.ts    (canonical definitions)
        ↓ re-export
src/types.ts           (+ InlineReviewOptions)
        ↓ re-export
src/client/types.ts    (re-exports shared types for browser imports)
```

**This is well-structured.** The chain serves a real purpose:
- `shared/types.ts` — no platform-specific imports, safe for any runtime
- `src/types.ts` — adds integration-specific types, serves as the public API surface
- `src/client/types.ts` — provides a shorter import path for client code

**One minor observation:** `src/client/types.ts` re-exports `AgentReply` which `src/types.ts` does not. This is fine (the client needs it for panel rendering), but the re-export chains aren't perfectly symmetric.

---

## 5. Build Architecture

### Severity: Info — Well-Considered

The three-bundle tsup configuration maps precisely to three deployment contexts:

| Bundle | Entry | Platform | External | Output |
|--------|-------|----------|----------|--------|
| Integration | `src/index.ts` | Node | astro, vite, node:* | `dist/index.js` + `.d.ts` |
| Client | `src/client/index.ts` | Browser | nothing (`noExternal: [/.*/]`) | `dist/client.js` |
| MCP | `src/mcp/server.ts` | Node | SDK, zod, node:* | `dist/mcp/server.js` |

**Strengths:**
- Client bundle correctly uses `noExternal: [/.*/]` and `platform: 'browser'` — all code inlined, no runtime dependencies
- MCP bundle has `banner: { js: '#!/usr/bin/env node' }` for direct CLI execution
- Integration bundle correctly externalises `astro` and `vite` (peer deps)
- Only the integration bundle emits `.d.ts` files (correct — client and MCP don't need public types)

**The `shared/export.ts` sharing pattern:** Both the server middleware and MCP tools import `generateExport` from `shared/export.ts`. Since the client bundle uses `noExternal: [/.*/]`, the client's duplicate (`src/client/export.ts`) gets bundled separately. This means the export logic exists in two places — see finding #6.

---

## 6. Code Duplication: Export Logic

### Severity: Medium

`src/shared/export.ts` (`generateExport`) and `src/client/export.ts` (`generateExportMarkdown`) contain **identical logic** — the same grouping, formatting, and markdown generation. The client file has a clear comment acknowledging this:

> "This duplicates the server-side export logic intentionally — the client version can work offline from the cache"

**The duplication is justified** by the build architecture (client can't import server code), but it creates a maintenance risk. Any change to the export format must be made in both files. Currently both files are 99-100 lines and identical in structure.

**Possible mitigation:** Extract the shared logic into `shared/export.ts` and have the client bundle include it via the `noExternal` setting (which it already does for everything). The client's `export.ts` would then just be the `exportToClipboard` wrapper. This would require verifying that `shared/export.ts` has no Node-specific imports — which it doesn't (it's pure TypeScript with no platform APIs).

---

## 7. Dev-Only Enforcement

### Severity: Info — Robust

The production zero-footprint guarantee rests on a single guard in `src/index.ts:20`:

```typescript
if (command !== 'dev') return;
```

**This is the correct and sufficient approach.** When this returns early:
- No Vite plugin is registered → no REST API endpoints
- No script is injected → no client code in the HTML
- No `<div>` host element → no Shadow DOM
- The `ReviewStorage` instance is never created

**The guard is in the right place:** at the Astro integration hook level, before any side effects. There's no secondary path that could accidentally include the tool in production. The client is loaded via `injectScript('page', ...)` which is gated behind this check.

**Package-level enforcement:** The `package.json` `"files": ["dist"]` ensures only build output is published. Source code, tests, and docs are excluded from the npm package.

---

## 8. Storage Architecture

### Severity: Medium — Inherent Limitations

**The JSON file approach is appropriate for v0.1.0** given the design constraints (dev-only, single developer, zero-config). However, several structural limitations exist:

| Concern | Impact | Severity |
|---------|--------|----------|
| **Full-file read/write** | Every operation reads and writes the entire file. With 100+ annotations, this becomes measurable. | Low |
| **No file locking** | Cross-process races (see finding #2). Mitigated by write queue for single-process. | Medium |
| **No schema migration** | Only handles missing `type` field. Future schema changes would need a migration strategy. | Low |
| **Silent data loss on parse failure** | `storage.read()` returns `createEmptyStore()` on any parse error — the corrupt file is silently replaced on next write. | Medium |
| **No backup/WAL** | A crash during `writeFile()` could produce a truncated file that fails to parse → empty store on next read → data loss on next write. | Low |

**The write queue pattern (`this.writeQueue`)** is a good approach for single-process serialisation. It chains promises so concurrent writes within the same Node.js process are safely ordered. However, it doesn't protect against:
- Crashes mid-write (partial file)
- Cross-process concurrent access

**Recommendation:** For a dev tool at this scale, these are acceptable. The most practical improvement would be atomic writes (write to temp file, rename) — `writeFile` is not guaranteed atomic on all platforms.

---

## 9. MCP Server Architecture

### Severity: Info — Clean and Extensible

The MCP tool registration follows a consistent pattern:

```
src/mcp/tools/
├── list-annotations.ts    → register(server, storage)
├── list-page-notes.ts     → register(server, storage)
├── get-annotation.ts      → register(server, storage)
├── get-export.ts          → register(server, storage)
├── resolve-annotation.ts  → register(server, storage)
└── add-agent-reply.ts     → register(server, storage)
```

**Each tool file exports:**
1. A testable handler function (e.g., `listAnnotationsHandler`)
2. A `register(server, storage)` function that wires it up

**This is a good pattern.** Adding a new tool requires:
1. Create a new file in `src/mcp/tools/`
2. Import and call `register()` in `src/mcp/server.ts`

**Observations:**
- The `ToolResult` type in `src/mcp/types.ts` has an `[key: string]: unknown` index signature that weakens type safety — any extra properties are silently allowed. This was likely done to accommodate `ErrorResult.isError`, but a discriminated union would be cleaner.
- All tools are read-only except `resolve_annotation` and `add_agent_reply` — a good default posture for agent tools.
- The MCP server reuses `ReviewStorage` from the server module — good code sharing.

---

## 10. Error Propagation

### Severity: Low

Error flow across boundaries:

```
Storage error → caught in middleware try/catch → sendError(res, 500, message)
                                                        ↓
                                               JSON { error: "..." }
                                                        ↓
Client api.ts → throw new Error(body.error) → caught in annotator.ts → console.error()
```

**Strengths:**
- The middleware has a top-level try/catch that converts all exceptions to JSON error responses
- The client `api.ts` `request()` function consistently parses error responses and throws
- Body size limit (1MB) is enforced in `readBody()`

**Concerns:**
- Client-side error handling is mostly `console.error` with silent fallbacks. For a dev tool, this is acceptable — no user-facing error messages beyond the toast system.
- The `readBody` function destroys the request on oversized bodies (`req.destroy()`) but the caller doesn't know this — the rejected promise just says "Request body too large".
- MCP tool errors use `isError: true` in the result — this follows the MCP SDK convention correctly.

---

## 11. Client Architecture

### Severity: Low — Annotator Complexity

The `annotator.ts` file (577 lines) is the largest and most complex module. It orchestrates:
- Text selection detection
- Element inspector (Alt+hover)
- Alt+click annotation
- Popup display for both new and edit flows
- Highlight application and restoration
- Event listener management
- Cache and badge refresh

**This is a "controller" anti-pattern** where one module handles too many responsibilities. However:
- The code is well-structured with clear section headers
- Helper functions are extracted (`handleSave`, `handleElementSave`, `handleHighlightClick`, etc.)
- It provides a clean `destroy()` for cleanup
- For a 577-line file in a dev tool, this is acceptable complexity

**The module dependency graph is acyclic:**
```
index.ts → annotator.ts → selection.ts
                         → element-selector.ts
                         → highlights.ts
                         → ui/popup.ts
                         → api.ts
                         → cache.ts
         → ui/panel.ts  → api.ts, cache.ts
         → ui/fab.ts
         → ui/host.ts
         → shortcuts.ts
         → export.ts
```

No circular dependencies. The `mediator.ts` interface breaks what would otherwise be a cycle between panel and annotator.

---

## 12. Coupling Analysis

### Severity: Low

**Tight coupling (by design, acceptable):**
- `annotator.ts` ↔ `highlights.ts` — annotator is the sole consumer
- `annotator.ts` ↔ `ui/popup.ts` — popup is positioned/shown by annotator
- `middleware.ts` ↔ `storage.ts` — middleware is the sole HTTP-facing consumer

**Loose coupling (good):**
- `api.ts` is a thin HTTP client with no DOM dependencies
- `selection.ts` handles pure Range/XPath logic with no UI concerns
- `element-selector.ts` handles pure CSS selector/XPath generation
- MCP tools depend only on `ReviewStorage`, not on middleware

**Hidden coupling:**
- The client cache key (`'review-loop'` in localStorage) is hardcoded. If two instances of the integration were ever used on the same origin, they'd share cache.
- The API prefix (`/__inline-review/api`) is hardcoded in both `middleware.ts` and `api.ts` but not shared via a constant.

---

## 13. Performance Considerations

### Severity: Low

| Area | Concern | Assessment |
|------|---------|------------|
| **Client bundle size** | Single bundle with `noExternal: [/.*/]` | Appropriate — no runtime deps, code is small |
| **DOM overhead** | Shadow DOM host + `<mark>` elements per highlight | Minimal — highlights are lightweight DOM nodes |
| **API latency** | Every operation reads entire file from disk | Acceptable for dev tool; disk I/O is fast for small files |
| **Text node walking** | `findRangeByContext` walks all text nodes on fallback | Could be slow on very large pages, but only used as fallback |
| **Inspector overlay** | `mousemove` listener repositions overlay on every Alt+move | `getBoundingClientRect` on each move is fast; overlay is a single element |
| **Restore highlights** | Iterates all page annotations, does XPath/context matching | Linear in annotation count; acceptable for dev workflows |

**No major performance concerns** for the intended use case (single developer, dev server, modest annotation counts).

---

## 14. Extension Points

### Severity: Info

**Can be extended without modifying core:**
- New MCP tools → add file to `src/mcp/tools/`, register in server
- New annotation types → extend discriminated union, add to middleware routes
- Storage backend → replace `ReviewStorage` class (constructor injection)
- Export formats → add alongside `generateExport`

**Would require modifying core:**
- Authentication → middleware and client both need changes
- Real-time sync (WebSocket) → new transport in middleware, new listener in client
- Custom UI themes → styles.ts would need a theming layer
- Alternative storage paths per page → storage abstraction doesn't support partitioning

**The `InlineReviewOptions` interface** is the intended extension point for configuration. Currently it only has `storagePath`. The specification explicitly notes that additional options should be justified against the zero-config principle — a good restraint.

---

## 15. Dependency Management

### Severity: Info

```
dependencies:
  @modelcontextprotocol/sdk: ^1.26.0   → MCP server only
  zod: ^3.25.76                          → MCP server only (schema validation)

peerDependencies:
  astro: ^5.0.0                          → Integration host

devDependencies:
  typescript, tsup, vitest, happy-dom, @types/node, @vitest/coverage-v8, astro
```

**Observations:**
- `@modelcontextprotocol/sdk` and `zod` are runtime `dependencies` but only used by the MCP server bundle. They are correctly externalised in the MCP tsup config, so they won't be bundled into the client or integration output. However, they will be installed when a consumer `npm install`s this package.
- The peer dependency on `astro: ^5.0.0` is correct — the integration hooks API is Astro-version-specific.
- No unnecessary runtime dependencies for the client (it's fully self-contained).

**Potential improvement:** If the MCP server were published as a separate optional package, the core integration could be zero-dependency. This is an over-optimisation for v0.1.0 but worth considering if the package is widely adopted.

---

## 16. Module Boundaries — Public vs Internal

### Severity: Low

The `package.json` `exports` map defines the public API:

```json
{
  ".": "./dist/index.js",        // Integration factory
  "./client": "./dist/client.js", // Client entry (loaded by integration)
  "./mcp": "./dist/mcp/server.js" // MCP server (CLI)
}
```

**Everything not in `exports` is internal.** This is the correct approach. However:
- The `"files": ["dist"]` field means all of `dist/` is published, including internal modules that could be imported via deep paths (e.g., `review-loop/dist/server/storage.js`).
- Only the `.` entry has a `types` export — consumer TypeScript projects can't get types for `./client` or `./mcp`.

**The `./client` export is unusual** — it's loaded by the integration itself via `injectScript('page', "import 'review-loop/client'")`. End users don't import it directly. This is a clever use of the exports map as an internal wiring mechanism.

---

## Summary of Findings

| # | Finding | Severity | Category |
|---|---------|----------|----------|
| 1 | Clean separation of client/server/MCP with acyclic dependencies | Info | Architecture |
| 2 | Read-modify-write race between MCP and browser (cross-process) | Medium | Concurrency |
| 3 | localStorage cache has no invalidation; prefers stale cache in edit flows | Medium | State Management |
| 4 | Type re-export chain is clean and serves real purpose | Info | Types |
| 5 | Three-bundle tsup config correctly maps to three runtime contexts | Info | Build |
| 6 | Export logic duplicated between `shared/export.ts` and `client/export.ts` | Medium | Duplication |
| 7 | Dev-only enforcement is robust via single integration hook guard | Info | Security |
| 8 | JSON storage: no file locking, silent data loss on parse errors | Medium | Storage |
| 9 | MCP tool pattern is clean and extensible | Info | Architecture |
| 10 | Error propagation is consistent; client falls back to console.error | Low | Error Handling |
| 11 | `annotator.ts` handles many responsibilities but is well-structured | Low | Complexity |
| 12 | API prefix hardcoded in two places rather than shared constant | Low | Coupling |
| 13 | No performance concerns for intended use case | Low | Performance |
| 14 | Good extension points for new tools and types; core changes needed for auth/realtime | Info | Extensibility |
| 15 | MCP deps installed even when MCP server unused | Info | Dependencies |
| 16 | Public API surface is well-defined via exports map | Low | Module Boundaries |

---

## Recommendations (Prioritised)

1. **Document the cross-process race condition** (finding #2) — either in the spec or as a known limitation. Users running MCP tools while the browser is open should be aware.

2. **Consider atomic writes** in `ReviewStorage.write()` — write to a temporary file and rename. This prevents truncated files from crashes.

3. **Unify export logic** (finding #6) — have the client import from `shared/export.ts` (the build config already bundles everything). Keep only the `exportToClipboard` wrapper in the client.

4. **Extract shared API prefix** (finding #12) — single `const API_PREFIX = '/__inline-review/api'` imported by both middleware and client api.ts. (This may not be practical across the build boundary, but a comment cross-referencing the two locations would help.)

5. **Consider a stale-cache warning** — when the client reads from cache in edit flows, it could compare `updatedAt` timestamps with a quick HEAD request to detect staleness.
