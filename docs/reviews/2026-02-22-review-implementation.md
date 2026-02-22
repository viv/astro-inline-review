# Implementation Code Quality Review

**Date:** 2026-02-22
**Reviewer:** impl-reviewer (agent)
**Scope:** All source files in `src/` — shared, server, client, MCP
**Previous reviews referenced:** 2026-02-21 spec, security, test, and system reviews

---

## Summary

The codebase is well-structured with clear separation of concerns, good use of TypeScript discriminated unions, and thoughtful design patterns (mediator, write queue, tiered fallback). The code is readable and maintainable. This review identifies specific areas for improvement across security, correctness, and robustness.

**Finding counts:** 3 Critical, 5 High, 10 Medium, 7 Low, 5 Info

---

## Critical

### C1. XSS via `innerHTML` in panel rendering

**File:** `src/client/ui/panel.ts:240-241, 201, 268-269`

The panel uses `innerHTML` with template strings in several places:

```typescript
// Line 240
content.innerHTML = '<div class="air-panel__empty"><span class="air-panel__empty-arrow" ...>←</span><br>No annotations on this page yet...';

// Line 201
content.innerHTML = '<div class="air-panel__empty">Failed to load annotations</div>';
```

While these specific instances use hardcoded strings (safe), the pattern normalises `innerHTML` usage in the codebase. More critically, `content.innerHTML = ''` at line 186 is used to clear content — this is safe but adjacent to the pattern.

The real risk: `renderAllPages` at line 275 uses `.textContent` for page titles (safe), but if any future contributor follows the `innerHTML` pattern established elsewhere, user-controlled annotation data (notes, selectedText, element descriptions) could be injected.

**Recommendation:** Replace all `innerHTML` assignments with DOM API calls for consistency and defence-in-depth. Use `textContent` or `createElement` exclusively.

### C2. Race condition: read-then-write in MCP mutation tools

**Files:** `src/mcp/tools/resolve-annotation.ts:10-24`, `src/mcp/tools/add-agent-reply.ts:17-35`

Both `resolveAnnotationHandler` and `addAgentReplyHandler` read the store, mutate the in-memory object, then write it back:

```typescript
const store = await storage.read();
const annotation = store.annotations.find(a => a.id === params.id);
// ... mutate annotation ...
await storage.write(store);
```

If two MCP tool calls happen concurrently (e.g. two agents resolving different annotations), the second write will overwrite the first's changes because `storage.read()` reads from disk each time, but by the time `storage.write()` runs, the first mutation may have already been written and will be lost.

The `ReviewStorage.write()` method queues writes sequentially, but the **read** is not part of the queue. The sequence could be:
1. Call A: reads store (v1)
2. Call B: reads store (v1)
3. Call A: writes modified store (v2)
4. Call B: writes modified store (v2' — overwrites A's changes because it was based on v1)

**Recommendation:** Add a `mutate(fn: (store: ReviewStore) => ReviewStore)` method to `ReviewStorage` that reads and writes within the same queued operation, ensuring serialised read-modify-write.

### C3. Race condition: same pattern in REST middleware

**File:** `src/server/middleware.ts:52-84, 88-101, 103-111, 123-163`

Every mutating endpoint (POST, PATCH, DELETE) follows the same read-then-write pattern as C2:

```typescript
const store = await storage.read();
// ... modify store ...
await storage.write(store);
```

With concurrent requests (e.g. user quickly deletes two annotations), the same lost-update problem applies. The write queue only serialises the `writeFile` calls, not the full read-modify-write transaction.

**Recommendation:** Same as C2 — implement a transactional `mutate()` method on `ReviewStorage`.

---

## High

### H1. `scrollToAnnotation` in annotator is dead code

**File:** `src/client/annotator.ts:520-535`

The `scrollToAnnotation` function is defined inside `createAnnotator` but never returned, never assigned to the mediator, and never called. The panel's `onAnnotationClick` callback in `src/client/index.ts:57-71` duplicates this exact logic.

**Impact:** Dead code increases maintenance burden and confusion about which code path is authoritative.

**Recommendation:** Remove `scrollToAnnotation` from `annotator.ts`.

### H2. Client export duplicates shared export with drift risk

**Files:** `src/client/export.ts` vs `src/shared/export.ts`

These two files contain nearly identical markdown generation logic (~100 lines each). The comment in `client/export.ts:8-9` acknowledges this is intentional, but the functions have already diverged in name (`generateExportMarkdown` vs `generateExport`).

Any change to the export format (adding new fields, changing markdown structure) must be made in both files. This is a maintenance trap.

**Impact:** Medium-term drift between client and server export formats.

**Recommendation:** Consider whether the client really needs an independent copy. The client-side `exportToClipboard` in `index.ts:93-94` fetches from the server first (`api.getStore()`), so it could use the server's `/export` endpoint instead. If offline support is needed, document the duplication contract explicitly with a test that asserts both produce identical output for the same input.

### H3. Missing input validation in REST POST endpoints

**File:** `src/server/middleware.ts:52-84, 123-137`

The POST `/annotations` and POST `/page-notes` endpoints accept arbitrary JSON bodies with minimal validation:

```typescript
const body = await readBody<Record<string, unknown>>(req);
// ...
pageUrl: (body.pageUrl as string) ?? '',
pageTitle: (body.pageTitle as string) ?? '',
```

There is no validation that:
- `pageUrl` is actually a string (could be `null`, `number`, `object`)
- `type` is one of `'text' | 'element'` (defaults to `text` for any non-`'element'` value)
- `range` has the required shape when `type === 'text'`
- `elementSelector` has the required shape when `type === 'element'`

**Impact:** Malformed annotations could be written to the store, causing client-side errors when rendering or restoring highlights.

**Recommendation:** Add Zod or manual validation for POST bodies, similar to how MCP tools use Zod schemas.

### H4. `existsSync` followed by async `readFile` is a TOCTOU race

**File:** `src/server/storage.ts:22-24`

```typescript
if (!existsSync(this.filePath)) {
  return createEmptyStore();
}
const raw = await readFile(this.filePath, 'utf-8');
```

Between `existsSync` returning `true` and `readFile` executing, the file could be deleted. This is unlikely in practice but is a known anti-pattern.

**Recommendation:** Remove the `existsSync` check. The `try/catch` on line 45 already handles the case where the file doesn't exist (via `readFile` throwing `ENOENT`). The `existsSync` is redundant.

### H5. No size limit on MCP tool inputs

**Files:** `src/mcp/tools/add-agent-reply.ts:49`

The Zod schema for `message` is `z.string()` with no max length. An agent could send an arbitrarily large reply message that would be stored in the JSON file.

Similarly, `list_annotations` and `list_page_notes` return the full JSON of all annotations — no pagination. For stores with thousands of annotations, this could exceed MCP message limits.

**Recommendation:** Add `z.string().max(10000)` or similar bounds on message inputs. Consider pagination for list tools if large stores are expected.

---

## Medium

### M1. FAB `innerHTML` destroys and recreates SVG on every toggle

**File:** `src/client/ui/fab.ts:38`

```typescript
button.innerHTML = isOpen ? PLUS_ICON : CLIPBOARD_ICON;
button.appendChild(badge); // Re-append badge after innerHTML change
```

Using `innerHTML` to swap the icon destroys and recreates the entire button contents. The badge must be re-appended. This is fragile — if additional children were added to the button, they'd be lost.

**Recommendation:** Use a stable icon container element and swap just its `innerHTML`, leaving the badge untouched.

### M2. Popup footer is rebuilt on every show with addEventListener

**File:** `src/client/ui/popup.ts:211-242`

`rebuildFooter` uses `footer.innerHTML = ''` and creates new buttons with `addEventListener` every time the popup is shown. The old listeners are cleaned up because the elements are removed, but this churn is unnecessary.

**Recommendation:** This is acceptable given the low frequency of popup shows, but worth noting for future optimisation.

### M3. Module-level mutable state in toast.ts

**File:** `src/client/ui/toast.ts:5-6`

```typescript
let toastEl: HTMLDivElement | null = null;
let dismissTimeout: ReturnType<typeof setTimeout> | null = null;
```

Module-level mutable state assumes a single shadow root. If the integration were ever mounted twice (unlikely but possible), the toast would only work in the first shadow root.

**Impact:** Low in practice, but violates the otherwise clean dependency injection pattern.

### M4. Keyboard shortcuts Escape doesn't stop propagation

**File:** `src/client/shortcuts.ts:35-37`

```typescript
if (e.key === 'Escape') {
  handlers.closeActive();
  return;
}
```

The Escape handler doesn't call `e.preventDefault()` or `e.stopPropagation()`. This means the host page also receives the Escape event. The comment at lines 10-11 mentions "only stops propagation when we actually handle it", but the code doesn't actually stop propagation in either case.

In `closeActive()` (index.ts:142-150), if neither popup nor panel is open, Escape is silently consumed without any check — this means every Escape keypress triggers the `closeActive` function even when nothing is open.

**Recommendation:** Only call `handlers.closeActive()` when there's actually something to close, and call `e.stopPropagation()` + `e.preventDefault()` when the event is handled.

### M5. Panel "Clear All" deletes sequentially, one API call per item

**File:** `src/client/ui/panel.ts:595-599`

```typescript
for (const a of store.annotations) {
  await api.deleteAnnotation(a.id);
}
for (const n of store.pageNotes) {
  await api.deletePageNote(n.id);
}
```

Each delete is a separate API call awaited sequentially. For a store with 50 annotations, this makes 50+ serial network requests.

**Recommendation:** Add a bulk-delete endpoint (`DELETE /annotations` with no ID to clear all), or at minimum use `Promise.all()` for parallel deletion.

### M6. Inspector overlay is created in light DOM, not shadow DOM

**File:** `src/client/annotator.ts:215`

```typescript
document.body.appendChild(inspectorOverlay);
```

The inspector overlay is appended to `document.body` rather than the shadow root. This means it's visible to the host page's CSS and could be styled or displaced by the host page. All other UI elements are in the shadow DOM.

**Recommendation:** Move the inspector overlay into the shadow DOM for consistency. Note: this would require the overlay to use `position: fixed` relative to the viewport, which works fine inside shadow DOM.

### M7. `SerializedSelection` type defined twice

**Files:** `src/client/selection.ts:10-18` and `src/shared/types.ts:62-70`

`selection.ts` defines its own `SerializedSelection` interface that is structurally identical to `SerializedRange` in `shared/types.ts`. The two types are used in different contexts but represent the same data.

**Recommendation:** Use `SerializedRange` from shared types in `selection.ts` to avoid type drift.

### M8. `generateId()` is not cryptographically secure

**File:** `src/server/middleware.ts:188-189`

```typescript
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
```

`Math.random()` is not cryptographically secure. For a dev-only tool, this is acceptable, but IDs could theoretically collide (especially with `Math.random().toString(36).slice(2, 8)` — only ~31 bits of entropy from the random part).

**Recommendation:** Use `crypto.randomUUID()` which is available in Node.js 19+ and provides proper uniqueness guarantees with no collision risk.

### M9. Storage migration silently converts unknown shapes

**File:** `src/server/storage.ts:36-42`

```typescript
data.annotations = (data.annotations as unknown[]).map((raw) => {
  const a = raw as Record<string, unknown>;
  if (!a.type) {
    return { ...a, type: 'text' } as unknown as Annotation;
  }
  return a as unknown as Annotation;
});
```

This migration adds `type: 'text'` to any annotation without a `type` field, then casts the result to `Annotation`. But it doesn't validate that the rest of the object matches the `TextAnnotation` shape. A corrupted or malformed annotation object would pass through and potentially cause runtime errors later.

**Recommendation:** Add shape validation after migration, or at least validate required fields (`id`, `pageUrl`, `note`).

### M10. Annotation `type` field defaults silently to 'text'

**File:** `src/server/middleware.ts:67-80`

```typescript
if (body.type === 'element') {
  // create element annotation
} else {
  // create text annotation — this catches body.type === undefined, null, 42, "typo", etc.
}
```

Any request with a `type` value that isn't exactly `'element'` will create a text annotation. A typo like `type: "text "` (trailing space) or `type: "txt"` would silently create a text annotation that may be missing required fields.

**Recommendation:** Validate `body.type` is one of `'text' | 'element'` and return 400 for invalid values.

---

## Low

### L1. `readBody` doesn't handle empty body gracefully

**File:** `src/server/middleware.ts:217-222`

If a POST request arrives with an empty body, `JSON.parse('')` throws `SyntaxError`. The catch block rejects with `'Invalid JSON body'`, which is correct, but the outer catch in `createMiddleware` returns a 500 error instead of 400.

**Recommendation:** Return 400 for parse errors rather than 500.

### L2. `removeAllElementHighlights` calls `removeElementHighlight` per element

**File:** `src/client/highlights.ts:157-163`

```typescript
for (const el of elements) {
  const id = el.getAttribute(ELEMENT_HIGHLIGHT_ATTR)!;
  removeElementHighlight(id);
}
```

`removeElementHighlight(id)` calls `document.querySelector(...)` again to find the element, but we already have a reference to it from the `querySelectorAll` result. This is a minor inefficiency.

### L3. Panel doesn't handle keyboard navigation

**File:** `src/client/ui/panel.ts`

Annotation items in the panel don't have `tabindex`, `role`, or keyboard event handlers. Users can't navigate or activate items using keyboard alone. (This is more of an accessibility concern, likely covered elsewhere.)

### L4. `writeQueue` error handling silently swallows

**File:** `src/server/storage.ts:52-55`

```typescript
this.writeQueue = this.writeQueue.then(async () => {
  const json = JSON.stringify(store, null, 2) + '\n';
  await writeFile(this.filePath, json, 'utf-8');
});
```

If `writeFile` throws, the error propagates to the caller via the returned promise. But if the caller doesn't `await` the result, the error is silently swallowed. All current callers do await, but the queue pattern makes this easy to misuse.

### L5. `data-air-el` attributes are not consistently applied

**Files:** Various

Some elements get `data-air-el` attributes for test hooks (`fab`, `badge`, `panel`, `popup`), but others don't (individual annotation items in panel, inspector overlay elements). This inconsistency makes automated testing harder for some UI states.

### L6. CORS note in middleware could be more prominent

**File:** `src/server/middleware.ts:24-27`

The comment about CORS is informative but easy to miss. Any browser tab open on the same machine can access the annotation API during dev. This is by design (dev-only tool), but worth a more visible callout, possibly in the README.

### L7. Client API `getExport` doesn't set Content-Type header

**File:** `src/client/api.ts:62-65`

```typescript
async getExport(): Promise<string> {
  const res = await fetch(`${API_BASE}/export`);
  return res.text();
},
```

Unlike other API methods, `getExport` doesn't use the `request` helper and doesn't set the `Content-Type: application/json` header. The server returns `text/markdown`, so this is correct, but it also doesn't check `res.ok`, meaning errors are silently returned as text.

**Recommendation:** Add error checking to `getExport`.

---

## Info

### I1. Code organisation follows clean boundaries

The shared/server/client/mcp split is well-designed:
- `shared/types.ts` is the single source of truth for data shapes
- `shared/export.ts` is reused by middleware and MCP
- Client re-exports shared types through `client/types.ts`
- MCP tools follow a consistent register pattern

### I2. Mediator pattern is effective but unusual

The mediator pattern (`ReviewMediator` interface with methods replaced at runtime) works well for decoupling panel, annotator, and index. However, the pattern of creating an object with stub methods that are replaced later is unconventional and may surprise new contributors. The TypeScript types don't enforce that the stubs are replaced before use.

### I3. Shadow DOM isolation is correctly implemented

The `createHost` function correctly uses `attachShadow({ mode: 'open' })` and all styles are injected into the shadow root. The `:host { all: initial; }` reset ensures no style leakage. One exception is the inspector overlay (M6).

### I4. Three-tier highlight restoration is well-designed

The XPath → context matching → orphan fallback strategy in `annotator.ts:470-488` is robust. The context scoring in `selection.ts:170-185` handles moved text intelligently.

### I5. Write queue in ReviewStorage is a good pattern

While it has the TOCTOU issue noted in C2/C3, the write queue itself is a clean way to prevent file corruption from concurrent `writeFile` calls. The pattern just needs to be extended to cover the full read-modify-write cycle.

---

## File-by-File Size Assessment

| File | Lines | Assessment |
|------|-------|------------|
| `client/annotator.ts` | 577 | Large but cohesive — could extract inspector logic |
| `client/ui/panel.ts` | 686 | Largest file — contains rendering, CRUD, forms. Consider splitting |
| `client/styles.ts` | 457 | Acceptable for centralised styles |
| `client/selection.ts` | 257 | Well-factored |
| `client/highlights.ts` | 231 | Clean, focused |
| `client/ui/popup.ts` | 243 | Some repetition across show* variants |
| `client/element-selector.ts` | 210 | Well-structured |
| `client/index.ts` | 186 | Clean entry point |
| `server/middleware.ts` | 228 | Good for the scope |
| All other files | <100 each | Appropriately sized |

The two largest files (`panel.ts` at 686 lines and `annotator.ts` at 577 lines) are candidates for extraction:
- `panel.ts` could split rendering and form logic into separate modules
- `annotator.ts` could extract inspector mode into a separate module

---

## Recommendations Priority

1. **Fix read-modify-write race condition** (C2, C3) — Add `mutate()` to `ReviewStorage`
2. **Replace `innerHTML` patterns** (C1) — Use `textContent` and DOM API consistently
3. **Add input validation to POST endpoints** (H3) — Use Zod schemas
4. **Remove dead code** (H1) — Delete `scrollToAnnotation`
5. **Add bulk delete endpoint** (M5) — Reduce sequential API calls
6. **Unify SerializedRange types** (M7) — Single source of truth
7. **Address remaining Medium/Low items** in subsequent iterations
