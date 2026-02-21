---
generated_by: Claude Opus 4.6
generation_date: 2026-02-21
model_version: claude-opus-4-6
purpose: system_architecture_review
status: resolved
human_reviewer: matthewvivian
tags: [architecture, code-review, technical-debt, element-annotation, system-review]
---

# System Architecture Review: astro-inline-review

## Executive Summary

astro-inline-review is a well-structured, focused dev-only Astro integration providing an annotation overlay for bridging human reviewers and coding agents. The codebase is approximately 1,500 lines of TypeScript across 20 source files, split cleanly between server (storage + middleware) and client (UI + annotation logic). The architecture follows a clear top-down initialisation pattern with component composition in the client bootstrap, and a straightforward REST API served via Vite dev server middleware on the server side.

The recent addition of element annotations via Alt+click has been integrated thoughtfully using a discriminated union pattern (`type: 'text' | 'element'`) that extends naturally from the existing text annotation model. The type guards (`isTextAnnotation`, `isElementAnnotation`) provide clean narrowing throughout the codebase, and the three-tier resolution strategy (CSS selector → XPath → orphaned) mirrors the existing text restoration pattern. The element-selector module is well-isolated with a clear single responsibility.

However, the system has accumulated several pieces of technical debt that should be addressed before the codebase grows further. The most significant are: (1) the shadow root bridge pattern using untyped `any` casts for cross-module communication, (2) duplicated type definitions between `src/types.ts` and `src/client/types.ts`, (3) duplicated markdown export logic between server and client, (4) the FAB state synchronisation issue where the FAB's internal state can desync from the panel, and (5) performance concerns with N+1 delete operations in Clear All and full file read/write on every storage operation. None of these are blocking issues for a dev-only tool, but they represent increasing maintenance cost as the system evolves.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     astro.config.mjs                        │
│                  inlineReview() integration                 │
└──────────────────────┬──────────────────────────────────────┘
                       │ hooks: astro:config:setup
                       │ (dev only — noop on build/preview)
          ┌────────────┼────────────┐
          ▼                         ▼
┌──────────────────┐    ┌────────────────────────────────────┐
│  SERVER SIDE     │    │  CLIENT SIDE (injected per page)   │
│                  │    │                                    │
│  Vite Middleware │    │  index.ts (bootstrap)              │
│  ┌────────────┐  │    │    │                               │
│  │ middleware  │  │    │    ├── host.ts (Shadow DOM)        │
│  │   .ts      │◄─┼────┼──► │    ├── fab.ts (FAB button)   │
│  └─────┬──────┘  │    │    │    ├── panel.ts (sidebar)     │
│        │         │    │    │    ├── popup.ts (annotation)  │
│  ┌─────▼──────┐  │    │    │    └── toast.ts (notifs)      │
│  │ storage.ts │  │    │    │                               │
│  │ (JSON I/O) │  │    │    ├── annotator.ts (controller)   │
│  └─────┬──────┘  │    │    │    ├── selection.ts (ranges)  │
│        │         │    │    │    ├── element-selector.ts     │
│        ▼         │    │    │    ├── highlights.ts (marks)   │
│  inline-review   │    │    │    └── popup.ts (via import)   │
│     .json        │    │    │                               │
│                  │    │    ├── shortcuts.ts (keyboard)      │
│                  │    │    ├── api.ts (HTTP client)         │
│                  │    │    ├── cache.ts (localStorage)      │
│                  │    │    ├── export.ts (markdown gen)     │
│                  │    │    ├── styles.ts (all CSS)          │
│                  │    │    └── types.ts (client types)      │
└──────────────────┘    └────────────────────────────────────┘

Communication:
  ──────►  Direct import / function call
  ◄──────  HTTP fetch (REST API)
  ╌╌╌╌╌►  Shadow root bridge (untyped any cast)

Shadow Root Bridge (annotator.ts → panel.ts):
  (shadowRoot as any).__refreshPanel
  (shadowRoot as any).__scrollToAnnotation
  (shadowRoot as any).__restoreHighlights
```

## Findings

### 1. Architecture Quality

#### 1.1 Module Structure and Separation of Concerns

**Severity: Suggestion**

The overall module structure is clean and well-organised. The server side has two files with clear roles (storage for I/O, middleware for HTTP routing), and the client side separates UI components from annotation logic. The `annotator.ts` serves as a controller/orchestrator that coordinates between `selection.ts`, `element-selector.ts`, `highlights.ts`, `popup.ts`, and `api.ts`.

However, the `annotator.ts` file at 572 lines is the largest in the codebase and handles many concerns: text selection detection, element annotation (Alt+click), inspector overlay management, popup orchestration, highlight management, event listener registration, and the shadow root bridge setup. This makes it the "God module" of the client side. While not yet unmanageable, it would benefit from extracting the inspector overlay logic (lines 133-282) into a dedicated `inspector.ts` module, as it has a self-contained lifecycle and minimal coupling to the rest of the annotator.

#### 1.2 Dependency Direction

**Severity: Minor (Positive)**

Dependencies flow cleanly downward — the bootstrap (`index.ts`) creates and wires everything, modules like `annotator.ts` depend on lower-level utilities (`selection.ts`, `highlights.ts`, `api.ts`), and there are no circular dependencies. This is a healthy architecture for a codebase of this size.

#### 1.3 Build Configuration

**Severity: Minor (Positive)**

The tsup configuration cleanly separates server (Node, external deps) and client (browser, fully bundled) builds. The vitest configuration splits tests by environment (happy-dom for client, node for server). Both are well-structured and appropriate.

---

### 2. Code Organisation

#### 2.1 Duplicated Type Definitions

**Severity: Major**

The types in `src/types.ts` (server) and `src/client/types.ts` (client) are nearly identical — both define `BaseAnnotation`, `TextAnnotation`, `ElementAnnotation`, `ElementSelector`, `Annotation`, `PageNote`, `SerializedRange`, `ReviewStore`, `isTextAnnotation()`, and `isElementAnnotation()`. The client file has a comment `/** Client-side types — mirrors server types but used independently */` but there is no mechanism to ensure they stay in sync.

The only differences are:
- `src/types.ts` additionally exports `InlineReviewOptions` and `createEmptyStore()`
- Both files export the same type guard functions with identical implementations

This duplication is a maintenance risk — if a field is added to `TextAnnotation` in one file but not the other, the system will silently drift. Since both sides communicate via JSON over HTTP, the types must match precisely.

**Recommendation:** Create a shared `src/shared/types.ts` that both server and client import from. The tsup client build already bundles everything (`noExternal: [/.*/]`), so the bundler will inline the shared types into the client bundle. Keep `InlineReviewOptions` in `src/types.ts` (server-only) and re-export shared types from there.

#### 2.2 Duplicated Export Logic

**Severity: Major**

The markdown export generation is implemented twice:
- `src/server/middleware.ts:225` — `generateExport()` (server-side, for `GET /export`)
- `src/client/export.ts:16` — `generateExportMarkdown()` (client-side, for clipboard copy)

Both functions produce identical markdown with the same formatting rules, grouping logic, and element annotation handling. The client file even has a comment acknowledging this: "This duplicates the server-side export logic intentionally".

While the stated reason (client can work offline from cache) has some merit, the duplication means any format change must be made in two places. The client-side export already fetches from the server (`api.getStore()`) before generating markdown, so the "offline" benefit is theoretical.

**Recommendation:** Consider having the clipboard export call `GET /export` directly (the endpoint already exists) and only falling back to client-side generation if the fetch fails. This eliminates one copy of the logic. Alternatively, extract the markdown generation into a shared module.

#### 2.3 File Size Distribution

**Severity: Suggestion**

File sizes are reasonable:
- `annotator.ts`: 572 lines (largest — could benefit from extraction)
- `panel.ts`: 544 lines (second largest — complex UI with inline CRUD)
- `middleware.ts`: 299 lines (reasonable for REST API)
- `selection.ts`: 257 lines (reasonable for XPath serialisation)
- `styles.ts`: 395 lines (all CSS in one file — appropriate)
- `element-selector.ts`: 209 lines (clean, focused)
- `highlights.ts`: 228 lines (clean, focused)

All other files are under 150 lines. The codebase is compact and navigable.

---

### 3. Inter-Component Communication

#### 3.1 Shadow Root Bridge Pattern

**Severity: Major**

Three functions are stashed on the `ShadowRoot` object as untyped properties via `(shadowRoot as any)`:

| Property | Set by | Used by | Lines |
|----------|--------|---------|-------|
| `__refreshPanel` | `panel.ts:120` | `panel.ts:357,393,419,427,519` | 6 usages |
| `__scrollToAnnotation` | `annotator.ts:532` | Not currently used externally! | 0 external usages |
| `__restoreHighlights` | `annotator.ts:533` | `panel.ts:515` | 1 usage |

This pattern has several problems:
1. **No type safety** — all access is via `(shadowRoot as any)`, bypassing TypeScript's type system entirely
2. **Implicit coupling** — there's no discoverable contract; you have to grep the codebase to find writers and readers
3. **`__scrollToAnnotation` is unused** — it's set on the shadow root but never retrieved. The panel's `onAnnotationClick` callback (set during bootstrap in `index.ts:49-63`) handles scroll-to-annotation directly via imported `getHighlightMarks`/`pulseHighlight`/etc. This means the bridge property is dead code.
4. **Fragile** — if the property name is misspelled in either the writer or reader, there's no compile-time error

**Recommendation:** Replace the shadow root bridge with a typed mediator/event bus. A simple approach:

```typescript
interface ReviewMediator {
  refreshPanel: () => void;
  restoreHighlights: () => Promise<void>;
}
```

The bootstrap creates this object and passes it to both the panel and annotator constructors. This eliminates `any` casts, makes the contract discoverable, and provides compile-time safety. Remove `__scrollToAnnotation` as it is dead code.

#### 3.2 Callback Injection Pattern

**Severity: Minor (Positive)**

The callback injection used for `onAnnotationClick`, `onRefreshBadge`, `onToggle`, and the `ShortcutHandlers` interface is clean and well-typed. Components declare their callback requirements via TypeScript interfaces, and the bootstrap wires them together. This is the right pattern for this scale of application.

#### 3.3 `refreshBadge` Closure Ordering

**Severity: Minor**

The `refreshBadge` closure in `index.ts:34-45` references `fab.badge`, but `fab` is declared on line 68 — after the closure is defined. This works because JavaScript closures capture by reference and `refreshBadge` is only invoked later (never during construction), but it creates a subtle ordering dependency. The spec acknowledges this (Section 5.1) but it's still a trap for future maintainers.

**Recommendation:** Add a comment at the closure definition noting the ordering dependency, or refactor to pass `badge` as a parameter to `refreshBadge`.

---

### 4. Error Handling

#### 4.1 Consistent Error Strategy

**Severity: Minor (Positive)**

Error handling follows a consistent "swallow and fallback" strategy appropriate for a dev-only overlay:
- Server: corrupted JSON → empty store, missing file → empty store
- Client: API failure → fall back to localStorage cache, cache failure → ignore
- Highlights: restoration failure → annotation becomes orphaned (visible in panel, no highlight)
- Console errors prefixed with `[astro-inline-review]` for filtering

This is pragmatic and correct — an annotation overlay should never crash the dev site.

#### 4.2 Silent Error Swallowing

**Severity: Minor**

Several `catch` blocks silently swallow errors:
- `annotator.ts:43` — `refreshBadge` catch is empty (`// Ignore`)
- `annotator.ts:545` — `refreshCacheAndBadge` catch is empty
- `panel.ts:177` — `refreshPanel` catch replaces content with "Failed to load" message but doesn't log
- `panel.ts:541` — `updateTabCounts` catch is empty (`// Ignore — counts stay stale`)
- `cache.ts:11,21` — `readCache`/`writeCache` catch blocks are empty

For a dev tool, silent swallowing is acceptable to avoid console noise. However, the inconsistency (some errors are logged with `console.error`, others are silently swallowed) makes debugging harder when something does go wrong.

**Recommendation:** Log all caught errors at `console.debug` level (not `console.error`) so they're visible when a developer explicitly opens DevTools to debug, but don't pollute the console during normal operation.

#### 4.3 Escape Handler Bypasses `hidePopup()`

**Severity: Minor**

In `index.ts:110-115`, the Escape handler dismisses the popup by directly manipulating CSS classes:

```typescript
const popupEl = shadowRoot.querySelector('.air-popup--visible');
if (popupEl) {
  popupEl.classList.remove('air-popup--visible');
  popupEl.setAttribute('data-air-state', 'hidden');
  return;
}
```

This bypasses the `hidePopup(popup)` function (from `popup.ts:173-177`), which also clears the textarea value. The result is that if the user presses Escape to dismiss the popup and then re-opens it, the textarea may still contain the previous note text. The `hidePopup` function is already imported in `index.ts` (line 11) but not used in the Escape handler.

**Recommendation:** Replace the manual class manipulation with:
```typescript
if (isPopupVisible(popup)) {
  hidePopup(popup);
  return;
}
```

This requires the Escape handler to have access to the `popup` reference, which means either passing it through the shortcuts interface or restructuring slightly.

---

### 5. Technical Debt Inventory

#### 5.1 Shadow Root Bridge (Untyped `any` Properties)

**Severity: Major** | **Impact: Maintainability, Type Safety** | **Effort: Low**

As detailed in Finding 3.1. Three untyped properties on `ShadowRoot`, one of which (`__scrollToAnnotation`) is dead code. Replace with a typed mediator object.

#### 5.2 Type Duplication (Server/Client)

**Severity: Major** | **Impact: Correctness** | **Effort: Low**

As detailed in Finding 2.1. Two nearly identical type definition files that must stay manually synchronised. Extract to shared module.

#### 5.3 Export Logic Duplication

**Severity: Major** | **Impact: Maintainability** | **Effort: Medium**

As detailed in Finding 2.2. Identical markdown generation in both server and client. Consolidate.

#### 5.4 FAB State Synchronisation

**Severity: Minor** | **Impact: UX** | **Effort: Low**

The FAB maintains its own `isOpen` boolean (in `fab.ts:35`) independently from the panel's CSS class state. When the panel is closed via Escape or keyboard shortcut, the FAB's icon, `data-air-state`, and internal boolean are NOT updated. This causes a one-click desync: the user must click the FAB twice to re-open the panel after an Escape-close.

The spec documents this issue (Section 6.1) and recommends the fix. The FAB should either observe the panel state, or the `closePanel()`/`closeActive()` functions should update the FAB.

**Recommendation:** The simplest fix is to have the `closePanel()` function also accept and update the FAB state. Alternatively, remove the internal `isOpen` boolean from `createFab()` and derive the state from the panel's `data-air-state` attribute on each click.

#### 5.5 N+1 Delete in Clear All

**Severity: Minor** | **Impact: Performance** | **Effort: Medium**

`panel.ts:500-508` — Clear All sends individual `DELETE` requests for every annotation and page note:

```typescript
for (const a of store.annotations) {
  await api.deleteAnnotation(a.id);
}
for (const n of store.pageNotes) {
  await api.deletePageNote(n.id);
}
```

Each `DELETE` triggers a full file read-modify-write cycle on the server. For a store with 50 annotations, this sends 50 sequential HTTP requests, each reading and rewriting the entire JSON file.

**Recommendation:** Add a `DELETE /annotations` (bulk delete) endpoint that clears the store in one operation. The server already has write-queue serialisation, so a single "clear store" operation would be safe and much faster.

#### 5.6 Double API Fetch on Panel Open

**Severity: Minor** | **Impact: Performance** | **Effort: Low**

When the panel opens (`togglePanel` in `panel.ts:131-139`), it calls `__refreshPanel()` which calls both `refreshPanel()` and `updateTabCounts()`. Both functions independently fetch from the server:
- `refreshPanel()` calls `api.getStore()` (line 170-171)
- `updateTabCounts()` calls `api.getStore()` (line 533)

This results in two nearly simultaneous HTTP requests to the same endpoint. The response is the same JSON — the second fetch is wasted.

**Recommendation:** Fetch once in `__refreshPanel`, pass the result to both `refreshPanel()` and `updateTabCounts()` as a parameter.

#### 5.7 Full File Read/Write on Every Operation

**Severity: Minor** | **Impact: Performance at Scale** | **Effort: High**

Every CRUD operation in `storage.ts` reads the entire JSON file from disk, deserialises it, modifies it, and writes the entire file back. For a dev tool with dozens of annotations, this is fine. With hundreds of annotations, the read-modify-write cycle on every operation (especially during Clear All) becomes slow.

This is explicitly a design choice (the spec states "Reads always come from disk — no in-memory cache — so external edits are picked up immediately"). The trade-off is reasonable for the current use case, but worth noting if the tool scales.

#### 5.8 Inspector Overlay Inline Styles

**Severity: Suggestion** | **Impact: Consistency** | **Effort: Low**

The inspector overlay (`annotator.ts:182-208`) constructs its CSS via `style.cssText` with joined string arrays:

```typescript
inspectorOverlay.style.cssText = [
  'position: fixed',
  'pointer-events: none',
  ...
].join('; ');
```

This is the only place in the codebase that uses this pattern — all other UI components use CSS classes defined in `styles.ts`. The inspector overlay is in the light DOM (not shadow DOM) so it can't use the shadow root stylesheet, but the inconsistency makes the code harder to maintain.

**Recommendation:** This is acceptable given the light DOM requirement. No change needed, but worth a comment explaining why inline styles are used here.

---

### 6. Element Annotation Integration

#### 6.1 Discriminated Union Pattern

**Severity: Minor (Positive)**

The `Annotation = TextAnnotation | ElementAnnotation` discriminated union with `type: 'text' | 'element'` is a clean TypeScript pattern. The type guards (`isTextAnnotation`, `isElementAnnotation`) are used consistently throughout:

- `middleware.ts:268-269` — export grouping
- `panel.ts:264-267` — rendering dispatch
- `annotator.ts:366,401` — edit flow dispatch
- `export.ts:59-60` — export grouping
- `highlights.ts` — implicit (text highlights only apply to text annotations)

The pattern makes adding a third annotation type (e.g. `'region'` for area selections) straightforward.

#### 6.2 CSS Selector Generation Strategy

**Severity: Minor (Positive)**

The four-tier CSS selector strategy (`#id` → `[data-testid]` → `tag.class` → positional) in `element-selector.ts` is well-designed:
- Prioritises the most stable selectors (ID, test-id)
- Falls back to increasingly specific selectors
- Always verifies uniqueness via `querySelectorAll().length === 1`
- Uses `CSS.escape()` for safe selector construction

#### 6.3 Element Selector — Attribute Capture Mismatch

**Severity: Minor**

The `CAPTURED_ATTRS` constant in `element-selector.ts:18` captures attributes unconditionally:

```typescript
const CAPTURED_ATTRS = ['id', 'class', 'data-testid', 'src', 'alt', 'href', 'role', 'aria-label', 'type', 'name'] as const;
```

The specification (Section 3.4.2) states that some attributes should only be captured on specific element types (e.g. `src` only on `img`, `video`, `audio`, `source`, `iframe`). The implementation captures all listed attributes regardless of element type. For example, a `<div>` with a `type` attribute would capture it even though the spec says `type` is only for `input` and `button`.

**Recommendation:** This is low-impact since captured-but-irrelevant attributes don't cause problems. However, the spec and implementation should agree. Either update the spec to match the simpler implementation or add element-type filtering.

#### 6.4 Backward Compatibility Migration

**Severity: Minor (Positive)**

The storage layer's migration for legacy annotations without a `type` field (`storage.ts:36-41`) is clean and idempotent. It runs on every read, doesn't rewrite the file, and transparently handles old-format stores.

---

### 7. Type Safety

#### 7.1 `any` Cast Inventory

**Severity: Major**

All `any` casts in the codebase:

| Location | Cast | Reason | Risk |
|----------|------|--------|------|
| `annotator.ts:532` | `(shadowRoot as any).__scrollToAnnotation` | Shadow root bridge | Dead code |
| `annotator.ts:533` | `(shadowRoot as any).__restoreHighlights` | Shadow root bridge | Missing types |
| `panel.ts:120` | `(shadowRoot as any).__refreshPanel` | Shadow root bridge | Missing types |
| `panel.ts:136` | `(shadowRoot as any).__refreshPanel` | Reader of bridge | Missing types |
| `panel.ts:357` | `(shadowRoot as any).__refreshPanel` | Reader of bridge | Missing types |
| `panel.ts:393` | `(shadowRoot as any).__refreshPanel` | Reader of bridge | Missing types |
| `panel.ts:419` | `(shadowRoot as any).__refreshPanel` | Reader of bridge | Missing types |
| `panel.ts:427` | `(shadowRoot as any).__refreshPanel` | Reader of bridge | Missing types |
| `panel.ts:515` | `(shadowRoot as any).__restoreHighlights` | Reader of bridge | Missing types |
| `panel.ts:519` | `(shadowRoot as any).__refreshPanel` | Reader of bridge | Missing types |
| `middleware.ts:56-57` | `(body.pageUrl as string)` etc. | Unsafe assertion from `Record<string, unknown>` | Low risk |
| `middleware.ts:67` | `body.elementSelector as ElementAnnotation['elementSelector']` | Unsafe assertion | No runtime validation |
| `middleware.ts:74` | `body.range as TextAnnotation['range']` | Unsafe assertion | No runtime validation |
| `storage.ts:36` | `a: Record<string, unknown>` → `a as Annotation` | Migration cast | Intentional |

The shadow root bridge accounts for 10 of the 14 casts. Introducing a typed mediator (Finding 3.1) would eliminate all of them.

The middleware casts (`body.elementSelector as ...`, `body.range as ...`) assert structure without validation. For a dev-only tool where the client is the only caller, this is pragmatic. If external tools start calling the API, runtime validation (e.g. via Zod) would be warranted.

#### 7.2 Strict TypeScript Configuration

**Severity: Suggestion**

The project doesn't appear to have a `tsconfig.json` in the repo root (tsup handles compilation). Ensuring `strict: true` is configured would catch additional type issues. The types are generally well-used throughout the codebase, with proper interface definitions and generics in the API client.

---

### 8. Performance

#### 8.1 N+1 Delete (Clear All)

**Severity: Minor** — See Finding 5.5.

#### 8.2 Double Fetch on Panel Open

**Severity: Minor** — See Finding 5.6.

#### 8.3 Full DOM Walk for Context Matching

**Severity: Suggestion**

`selection.ts:137-189` — The context matching fallback walks ALL text nodes in `document.body` and concatenates them into a single string for every annotation that fails XPath restoration. For pages with large DOMs, this could be slow if many annotations are orphaned simultaneously.

In practice, this path rarely executes (XPath restoration succeeds for unchanged pages), and the spec documents it as a fallback. No action needed unless performance issues are reported.

#### 8.4 Inspector Overlay Updates on Every Mouse Move

**Severity: Suggestion**

During Alt+hover, the `onMouseMove` handler (`annotator.ts:147-179`) fires on every mouse movement and calls `getBoundingClientRect()` on the target element. This is inherently frequent but the code already guards against redundant updates (line 175: `if (target === inspectedElement) return;`). The early returns for shadow DOM host, body/html, and same-element make this efficient enough.

---

### 9. Maintainability

#### 9.1 Code Discoverability

**Severity: Minor (Positive)**

The codebase is well-organised for discoverability:
- Clear file naming that maps to functionality (`selection.ts`, `highlights.ts`, `element-selector.ts`)
- JSDoc comments on all public functions with context about purpose
- `data-air-*` attributes provide stable automation contracts documented in the spec
- The specification serves as a comprehensive reference for all behaviour

#### 9.2 Onboarding Path

**Severity: Suggestion**

A new developer would find the codebase navigable, but might struggle with:
1. **Understanding the shadow root bridge** — the `any` casts hide the communication pattern
2. **Finding where state lives** — the FAB has its own `isOpen`, the panel uses CSS classes, the annotator tracks `currentRange`/`currentElementTarget`/`inspectorActive`
3. **Understanding data flow** — the `refreshBadge` → `api.getStore()` → `writeCache()` → `updateBadge()` chain crosses multiple modules

The specification (Section 5.6.3) has a good dependency graph that helps. A brief `ARCHITECTURE.md` or inline comment block at the top of `index.ts` describing the wiring would further help onboarding.

#### 9.3 Test Coverage Alignment

**Severity: Minor**

Unit tests exist for: `selection`, `highlights`, `storage`, `export`, `shortcuts`, `api`, `cache`, and `fab`. Missing unit test coverage for:
- `annotator.ts` (the largest module — tested only via Playwright acceptance tests)
- `element-selector.ts` (CSS selector generation, element resolution)
- `panel.ts` (complex UI logic, CRUD operations)
- `popup.ts` (positioning, mode switching)
- `host.ts` (idempotency)
- `toast.ts` (timer management)

The most impactful addition would be unit tests for `element-selector.ts` (pure functions, easy to test, complex logic) and `annotator.ts` (high fan-out, many edge cases).

---

## Technical Debt Inventory (Prioritised)

| # | Item | Severity | Impact | Effort | Priority |
|---|------|----------|--------|--------|----------|
| 1 | Shadow root bridge → typed mediator | Major | Type safety, dead code | Low | **High** |
| 2 | Duplicate types (server/client) | Major | Correctness risk | Low | **High** |
| 3 | Duplicate export logic | Major | Maintenance cost | Medium | **Medium** |
| 4 | FAB state desync | Minor | UX (one-click desync) | Low | **Medium** |
| 5 | Escape handler bypasses hidePopup() | Minor | Stale textarea content | Low | **Medium** |
| 6 | N+1 delete in Clear All | Minor | Performance at scale | Medium | **Low** |
| 7 | Double fetch on panel open | Minor | Wasted HTTP request | Low | **Low** |
| 8 | Annotator.ts size (extract inspector) | Suggestion | Readability | Medium | **Low** |
| 9 | Element selector attr capture mismatch | Minor | Spec/impl drift | Low | **Low** |
| 10 | Dead code: `__scrollToAnnotation` bridge | Minor | Code cleanliness | Trivial | **Low** |

## Recommendations

### Immediate (Next Session)

1. **Remove dead code**: Delete `(shadowRoot as any).__scrollToAnnotation = scrollToAnnotation;` from `annotator.ts:532`. The panel's annotation click is handled via the `onAnnotationClick` callback.

2. **Fix Escape handler**: Replace the manual CSS class manipulation in `index.ts:110-115` with a call to `hidePopup(popup)`. This requires restructuring the `closeActive` handler to receive the popup reference.

3. **Fix FAB state desync**: Have `closePanel()` accept an optional `FabElements` parameter and update the FAB's `isOpen` state, icon, and `data-air-state` when the panel is closed by non-FAB means.

### Short-Term (Next 2-3 Sessions)

4. **Extract shared types**: Create `src/shared/types.ts` with all shared interfaces, type guards, and the `createEmptyStore()` helper. Have both `src/types.ts` and `src/client/types.ts` re-export from it (then eventually remove the duplicates).

5. **Replace shadow root bridge with typed mediator**: Define a `ReviewMediator` interface, create it in bootstrap, and pass it to panel and annotator constructors. This eliminates all 10 `any` casts from the bridge pattern.

6. **Consolidate export logic**: Either have the clipboard export call `GET /export` directly, or extract the markdown generation into a shared module.

### Medium-Term (Future Sessions)

7. **Add bulk delete endpoint**: `DELETE /annotations` (or `POST /clear`) that empties the store in one operation. Update Clear All to use it.

8. **Eliminate double fetch**: Pass the fetched store from `__refreshPanel` to both `refreshPanel()` and `updateTabCounts()`.

9. **Add unit tests for element-selector.ts**: Pure functions with complex logic — ideal unit test candidates.

10. **Extract inspector module from annotator.ts**: The inspector overlay (keydown/keyup/mousemove handlers, overlay creation/destruction) is self-contained and could be its own module.
