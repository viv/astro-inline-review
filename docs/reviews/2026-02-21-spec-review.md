---
generated_by: Claude Opus 4.6
generation_date: 2026-02-21
model_version: claude-opus-4-6
purpose: specification_review
status: resolved
reviewed_document: docs/spec/specification.md
cross_references:
  - src/ (component source code)
  - ../astro-inline-review-tests/ (acceptance test suite)
  - ../viv.github.io/docs/engineering-plans/2026-02-astro-inline-review.md
tags: [review, specification, quality, gaps, ai-agent-readability]
---

# Specification Review: astro-inline-review

**Reviewed**: `docs/spec/specification.md`
**Review date**: 2026-02-21
**Reviewer**: Claude Opus 4.6 (expert in software specification and AI agent engineering)
**Purpose**: Identify issues, gaps, and ambiguities that would prevent an AI agent from correctly implementing the component from the specification alone.

## Review Dimensions

This review evaluates the specification across seven dimensions:

1. **Completeness** — Missing behaviours, edge cases, or interactions
2. **Precision & Ambiguity** — Statements open to multiple interpretations
3. **Consistency** — Contradictions between sections
4. **Testability** — Whether requirements have clear pass/fail criteria
5. **Agent-Readability** — Structure and navigability for AI agents
6. **Error & Edge Case Coverage** — Failure modes and unusual scenarios
7. **Contract Completeness** — Automation contract (`data-air-*` attributes)

## Summary

| Severity | Count | Description |
|----------|-------|-------------|
| Critical | 3 | Would cause incorrect implementation by an agent |
| Major | 7 | Significant gaps that could cause bugs or wasted effort |
| Minor | 8 | Imprecise language, missing cross-references, minor gaps |
| Suggestion | 6 | Improvements for clarity and maintainability |
| **Total** | **24** | |

**Overall verdict**: The specification is well-structured and substantially complete for human developers reading alongside the source code. However, it is **not yet sufficient for AI agent implementation from scratch**. The critical and major findings — particularly SPEC-001 (API response asymmetry), SPEC-006 (inter-component communication), and SPEC-008 (FAB/panel state desync) — would lead to incorrect or incomplete implementations.


---


## Critical Findings

### SPEC-001: GET /annotations?page= returns asymmetric response

- **Severity**: Critical
- **Category**: Data Flow Clarity
- **Spec section**: 4.2.1 (GET /annotations response) and 5.4 (Client-Side Caching)
- **Source file**: `src/server/middleware.ts` line 43

**Finding**:

The spec says `GET /annotations` returns the full store shape including `pageNotes`, and that "the client can cache the full store from a single request." However, when a `?page=` filter is applied, annotations are filtered but `pageNotes` are NOT filtered. The middleware code confirms this:

```typescript
// middleware.ts line 43
return sendJson(res, { ...store, annotations: filtered, pageNotes: store.pageNotes });
```

This asymmetry is entirely undocumented. An implementer re-building the server could reasonably filter both annotations and pageNotes by page, which would break the client.

Furthermore, the client calls `api.getStore(window.location.pathname)` during `restoreHighlights()` (annotator.ts line 182), which hits `GET /annotations?page=/path`. This returns page-filtered annotations but ALL page notes. The client writes this to cache (line 183). Then in `panel.ts` lines 168-170, the "This Page" tab reads from cache and filters `pageNotes` client-side. The spec calls this "the full store" but it is not — it contains filtered annotations.

**Recommendation — how to fix the spec**:

1. Add a subsection to Section 4.2.1 with a clear callout:

   > **Filter behaviour**: The `?page=` query parameter only filters the `annotations` array. The `pageNotes` array is always returned unfiltered. This is intentional — the client uses a single `GET /annotations` request to populate its cache with all page notes, then applies local filtering in the panel's "This Page" tab.

2. In Section 5.4 (Client-Side Caching), clarify:

   > **Cache contents**: When the client fetches with a page filter, the cached store contains page-filtered annotations but unfiltered page notes. The panel's "This Page" tab applies an additional client-side filter on `pageNotes` by `window.location.pathname`.

3. In Section 4.2.1, update the response shape documentation to show what the response looks like WITH and WITHOUT the page filter, making the asymmetry visible.

---

### SPEC-002: Escape key section mixes bug description with specification

- **Severity**: Critical
- **Category**: Consistency
- **Spec section**: 10.4 (Escape Precedence)
- **Source file**: `src/client/shortcuts.ts` lines 34-37, `src/client/index.ts` lines 73-84

**Finding**:

Section 10.4 contains this "Important" note:

> "The current implementation always calls `closeActive()` on Escape, which means it calls the handler even when nothing is open. The handler should check state and only stop propagation when it actually handles the event."

This describes a **known implementation quirk**, not desired behaviour, yet it sits within the specification. An agent reading the spec cannot tell whether to:
- Implement the buggy behaviour (what the code does)
- Implement the correct behaviour (what the spec says "should" happen)

Looking at the actual code:
- `shortcuts.ts` lines 34-37: The Escape handler calls `handlers.closeActive()` unconditionally, never calls `e.stopPropagation()` or `e.preventDefault()`
- `client/index.ts` lines 73-84: The `closeActive` handler checks popup/panel state but has no mechanism to signal back whether it consumed the event

The acceptance test at `10-keyboard-shortcuts.spec.ts` lines 123-145 verifies that Escape propagates to the site's handler when nothing is open. This test passes because the keyboard handler never stops propagation at all — a side effect of the quirk, not deliberate design.

**Recommendation — how to fix the spec**:

1. Remove the "Important" note entirely from Section 10.4.

2. Replace it with a precise normative statement:

   > When Escape is pressed, `closeActive()` is called. The handler checks state in priority order:
   > 1. If the popup is visible: dismiss the popup. The event SHOULD be stopped from propagating to site handlers.
   > 2. If the panel is open (and popup is not visible): close the panel. The event SHOULD be stopped from propagating.
   > 3. If neither is open: the event MUST propagate normally to site handlers.

3. Add a "Known Technical Debt" subsection (or a separate section) noting:

   > The current implementation achieves correct user-visible behaviour for case 3 (Escape propagates when nothing is handled) by never calling `stopPropagation()` at all. This means the event also propagates to site handlers in cases 1 and 2, which is technically incorrect but has no user-visible impact since the popup/panel dismissal happens first. A future improvement would be to return a boolean from `closeActive()` indicating whether it consumed the event, and call `e.stopPropagation()` only when true.

---

### SPEC-003: GET /page-notes endpoint undocumented from client perspective

- **Severity**: Critical
- **Category**: Completeness
- **Spec section**: 4.2.2 (Page Note Endpoints)
- **Source file**: `src/server/middleware.ts` lines 92-98, `src/client/api.ts`

**Finding**:

The spec says page note endpoints have "Same semantics as annotation endpoints" but this is misleading:

1. The `GET /page-notes` response shape is undocumented. The middleware returns `{ ...store, pageNotes: filtered, annotations: store.annotations }` — the mirror of the annotations endpoint's asymmetry.

2. The client NEVER uses `GET /page-notes`. The `api.ts` module's `getStore()` method always hits `GET /annotations`, which returns both collections. There is no `getPageNotes()` client method.

3. An implementer could waste time building a client-side `getPageNotes()` method that is never called, or could remove the endpoint thinking it's unused, breaking potential future use.

**Recommendation — how to fix the spec**:

1. Document the `GET /page-notes` response shape explicitly, showing it returns filtered page notes but unfiltered annotations.

2. Add a note to Section 4.2.2:

   > **Client usage**: The client exclusively uses `GET /annotations` as its store-fetch endpoint. The response from `GET /annotations` includes both the `annotations` and `pageNotes` arrays, making `GET /page-notes` redundant for normal client operation. The `GET /page-notes` endpoint exists for API completeness and potential external tool use (e.g. curl-based debugging).

3. In Section 5.5 (API Client), explicitly list which endpoints the client calls and which it does not:

   > The client uses these endpoints:
   > - `GET /annotations` (with optional `?page=` filter) — primary store fetch
   > - `POST /annotations` — create annotation
   > - `PATCH /annotations/:id` — update annotation
   > - `DELETE /annotations/:id` — delete annotation
   > - `POST /page-notes` — create page note
   > - `PATCH /page-notes/:id` — update page note
   > - `DELETE /page-notes/:id` — delete page note
   > - `GET /export` — Markdown export
   >
   > The client does NOT use: `GET /page-notes` (page notes are included in the `GET /annotations` response).


---


## Major Findings

### SPEC-004: Clear All implementation details and highlight cleanup unspecified

- **Severity**: Major
- **Category**: Completeness
- **Spec section**: 6.2.5 (Clear All)
- **Source file**: `src/client/ui/panel.ts` lines 464-485

**Finding**:

The spec says Clear All "Deletes all annotations and page notes (across all pages)" but omits two important details:

1. **No bulk delete endpoint**: The implementation sends individual `DELETE` requests for every annotation and page note sequentially. For a store with 50 annotations and 10 page notes, that's 60 sequential HTTP requests, each performing a full file read-modify-write cycle. The spec does not mention this approach.

2. **Highlight cleanup**: When annotations are deleted via Clear All, the `<mark>` highlights in the light DOM are NOT explicitly removed. They are cleaned up implicitly when `refreshPanel()` re-renders, and/or on the next `restoreHighlights()` call (which removes all existing marks before re-applying). But during the Clear All operation itself, stale marks remain visible in the DOM.

**Recommendation — how to fix the spec**:

1. Add to Section 6.2.5:

   > **Implementation**: Clear All deletes each annotation and page note individually via separate `DELETE` requests. There is no bulk delete endpoint. After all deletions complete, the cache is cleared to an empty store and the badge is refreshed.
   >
   > **Highlight cleanup**: Light DOM `<mark>` elements are not removed during the Clear All operation itself. They are removed on the next call to `restoreHighlights()` (which clears all existing marks before re-applying from the now-empty store). In practice, opening the panel triggers a badge refresh which calls `restoreHighlights()`, so marks are cleaned up shortly after Clear All completes.

2. Optionally, specify a bulk delete endpoint (`DELETE /annotations` with no ID = delete all) as a future improvement, noting it would reduce the N+M requests to 2.

---

### SPEC-005: Context matching algorithm uses imprecise language

- **Severity**: Major
- **Category**: Precision & Ambiguity
- **Spec section**: 8.4 (Three-Tier Highlight Restoration) and 15.3 (Context Matching)
- **Source file**: `src/client/selection.ts` lines 170-185

**Finding**:

Two imprecisions:

1. The spec says context is "~30 characters before selection" (with tilde). The code uses exactly `CONTEXT_LENGTH = 30` (selection.ts line 20). The tilde suggests approximation where there is none.

2. The spec says "Partial match (last 10 chars): +5 points" but doesn't specify what "partial match" means algorithmically. The code uses `before.includes(contextBefore.slice(-10))` — a loose substring search that checks if the last 10 characters of the stored context appear ANYWHERE in the extracted before-text, not just at the boundary. This could match false positives.

**Recommendation — how to fix the spec**:

1. In Section 15.3, replace "~30 characters" with:

   > Exactly 30 characters (or fewer if insufficient text exists before/after the selection boundary).

2. Replace the scoring description with precise algorithm:

   > **Scoring algorithm for each match candidate**:
   > - If the text immediately preceding the match ends with the full `contextBefore` string: +`contextBefore.length` points
   > - Else if the text preceding the match contains the last 10 characters of `contextBefore` anywhere: +5 points
   > - If the text immediately following the match starts with the full `contextAfter` string: +`contextAfter.length` points
   > - Else if the text following the match contains the first 10 characters of `contextAfter` anywhere: +5 points
   >
   > The candidate with the highest score is selected. On tie, the first occurrence wins.

---

### SPEC-006: Inter-component communication pattern undocumented

- **Severity**: Major
- **Category**: Completeness
- **Spec section**: 6.2 (Review Panel) and 7.2 (Editing an Annotation)
- **Source files**: `src/client/ui/panel.ts` lines 119-122, `src/client/annotator.ts` line 232

**Finding**:

The panel, annotator, and FAB are separate modules that need to communicate. The implementation uses an untyped property-stashing pattern on the shadow root:

```typescript
// panel.ts line 119-122 — panel stores its refresh function
(shadowRoot as any).__refreshPanel = () => {
  refreshPanel(content, activeTab, callbacks);
  updateTabCounts(thisPageTab, allPagesTab);
};

// annotator.ts line 232 — annotator stores scroll-to function
(shadowRoot as any).__scrollToAnnotation = scrollToAnnotation;
```

This is the critical wiring that enables:
- Panel to scroll to a highlight (via `onAnnotationClick` callback -> `__scrollToAnnotation`)
- Annotator operations to refresh the panel (via `__refreshPanel`)
- Page note CRUD in the panel to trigger badge refresh (via `onRefreshBadge` callback)

The spec mentions none of this. It says "Click behaviour: Scrolls the page to the corresponding highlight" but never explains the mechanism.

**Recommendation — how to fix the spec**:

Add a new section **5.6 Inter-Component Communication** between 5.5 and 6.1:

> ### 5.6 Inter-Component Communication
>
> The panel, annotator, FAB, and shortcuts modules are separate concerns that communicate via callbacks and shared references on the shadow root.
>
> #### 5.6.1 Callback Injection
>
> Components accept callback interfaces during construction:
>
> | Component | Callback | Provider | Purpose |
> |-----------|----------|----------|---------|
> | Panel | `onAnnotationClick(id)` | Client bootstrap | Scroll to highlight and pulse |
> | Panel | `onRefreshBadge()` | Client bootstrap | Update FAB badge count |
> | FAB | `onToggle()` | Client bootstrap | Toggle panel open/closed |
> | Shortcuts | `togglePanel()` | Client bootstrap | Toggle panel |
> | Shortcuts | `closeActive()` | Client bootstrap | Dismiss popup or close panel |
> | Shortcuts | `exportToClipboard()` | Client bootstrap | Export and show toast |
> | Shortcuts | `addPageNote()` | Client bootstrap | Open panel and show add-note form |
>
> #### 5.6.2 Shadow Root Bridge
>
> Two functions are stashed as untyped properties on the `ShadowRoot` object to enable cross-module communication without circular imports:
>
> | Property | Set by | Used by | Purpose |
> |----------|--------|---------|---------|
> | `__refreshPanel()` | Panel (`createPanel`) | Panel note CRUD, Clear All | Re-render panel content and update tab counts |
> | `__scrollToAnnotation(id)` | Annotator (`createAnnotator`) | Panel annotation click | Scroll to highlight and pulse |
>
> These are cast via `(shadowRoot as any)` — there is no TypeScript interface for them. This is a known architectural shortcut. A future improvement could introduce a typed event bus or mediator pattern.
>
> #### 5.6.3 Dependency Graph
>
> ```
> Client Bootstrap (index.ts)
>   ├── creates ShadowRoot
>   ├── creates Panel (receives onAnnotationClick, onRefreshBadge)
>   ├── creates FAB (receives onToggle → togglePanel)
>   ├── creates Annotator (receives shadowRoot, badge)
>   └── registers Shortcuts (receives togglePanel, closeActive, export, addPageNote)
>
> Panel operations → call onRefreshBadge → update FAB badge
> Panel annotation click → call onAnnotationClick → scrollToAnnotation (via shadowRoot bridge)
> Panel note CRUD → call __refreshPanel (via shadowRoot bridge)
> Annotator save/delete → call refreshCacheAndBadge → update FAB badge
> Shortcuts → call togglePanel/closeActive/export/addPageNote → affect Panel/Popup
> ```

---

### SPEC-007: Popup positioning algorithm incompletely documented

- **Severity**: Major
- **Category**: Precision & Ambiguity
- **Spec section**: 6.3 (Selection Popup)
- **Source file**: `src/client/ui/popup.ts` lines 136-157

**Finding**:

The spec says the popup "Falls back to below if insufficient space above (less than ~208px)" but the actual algorithm is:

1. `top = rect.top - MARGIN` (8px margin above selection's top edge)
2. `left` = centred on selection, clamped to viewport with 8px margin
3. If `top < MARGIN + 200` (i.e. < 208px from viewport top): reposition below: `top = rect.bottom + MARGIN`
4. Apply `transform: translateY(-100%)` if popup is above (shifts popup upward by its own height so its bottom edge meets the selection)

The `translateY(-100%)` transform is critical — without it, the popup's top-left corner would be at the selection's top edge, overlapping the selected text. With the transform, the popup sits above the selection. This transform is not documented.

**Recommendation — how to fix the spec**:

Replace the positioning description in Section 6.3 with:

> **Positioning algorithm**:
> 1. Calculate horizontal centre: `left = selection.left + (selection.width / 2) - (POPUP_WIDTH / 2)` where `POPUP_WIDTH = 300px`
> 2. Clamp horizontally: `left = max(8, min(left, viewportWidth - 300 - 8))`
> 3. Try above: `top = selection.top - 8`
> 4. If `top < 208` (not enough room above): switch to below: `top = selection.bottom + 8`
> 5. If placed above: apply `transform: translateY(-100%)` so the popup's bottom edge aligns with the selection's top edge
> 6. If placed below: no transform (popup's top edge aligns with the selection's bottom edge)
>
> The 208px threshold is `8px margin + 200px` (approximate popup height including textarea and buttons).

---

### SPEC-008: FAB icon and state desync when panel closed via Escape

- **Severity**: Major
- **Category**: Completeness
- **Spec section**: 6.1 (FAB) and 10.4 (Escape Precedence)
- **Source files**: `src/client/ui/fab.ts` line 35, `src/client/index.ts` lines 73-84

**Finding**:

The FAB maintains its own `isOpen` boolean (fab.ts line 35) independently from the panel's `air-panel--open` class. When the user:

1. Clicks FAB: `isOpen = true`, icon swaps to X, `data-air-state = "open"`, panel opens
2. Presses Escape: `closePanel()` removes `air-panel--open`, but FAB's `isOpen` stays `true`, icon stays as X, `data-air-state` stays `"open"`
3. Clicks FAB again: `isOpen` toggles to `false`, icon swaps to pencil — but `onToggle()` calls `togglePanel()` which adds `air-panel--open` back. The FAB now shows pencil (closed) but the panel is open.

This creates a toggle desync where the FAB and panel are out of phase. The spec does not document this behaviour at all.

**Recommendation — how to fix the spec**:

Add to Section 6.1 under a **Known Issues** or **State Synchronisation** heading:

> **FAB/Panel state desync**: The FAB maintains its own `isOpen` boolean independently from the panel's CSS class state. When the panel is closed by means other than a FAB click (e.g. Escape key, keyboard shortcut), the FAB's internal state, icon, and `data-air-state` attribute are NOT updated. This causes the FAB to show the X icon (open) when the panel is actually closed.
>
> **Impact**: Clicking the FAB after an Escape-close will toggle the FAB to "closed" state but actually re-open the panel — a confusing interaction.
>
> **Recommended fix**: The FAB should observe the panel state, or the `closePanel()` function should accept a callback to notify the FAB. One approach: make `togglePanel()` and `closePanel()` return the new state, and have the keyboard shortcut handler update the FAB accordingly:
>
> ```typescript
> // In client/index.ts closeActive handler:
> if (isPanelOpen(panel)) {
>   closePanel(panel);
>   fab.button.classList.remove('air-fab--open');
>   fab.button.setAttribute('data-air-state', 'closed');
>   fab.button.innerHTML = PENCIL_ICON;
>   fab.button.appendChild(fab.badge);
> }
> ```
>
> Alternatively, refactor the FAB to derive its state from the panel's `data-air-state` attribute rather than maintaining its own boolean.

---

### SPEC-009: data-air-pulse attribute missing from automation contract

- **Severity**: Major
- **Category**: Contract Completeness
- **Spec section**: 14 (Automation Contract)
- **Source file**: `src/client/highlights.ts` (pulse animation)
- **Test file**: `astro-inline-review-tests/tests/06-panel.spec.ts` lines 173-186

**Finding**:

The acceptance test for "highlight pulses on scroll-to from panel" checks for `data-air-pulse` attribute (or CSS animation/class). Looking at the implementation in `highlights.ts`, the pulse animation uses inline style changes (`el.style.backgroundColor`) and transitions, but does NOT currently set a `data-air-pulse` attribute. The acceptance test at line 178-183 checks for:

```typescript
style.animation !== 'none' ||
mark.classList.contains('air-pulse') ||
mark.getAttribute('data-air-pulse') !== null
```

The test uses an OR condition — it passes if ANY of these three indicators exists. The current implementation relies on the style animation check. But the `data-air-pulse` attribute is referenced in the acceptance tests as a potential test hook, the CSS class `.air-annotation-item__orphan` exists in the stylesheet for orphaned annotations, and neither is in the automation contract table.

**Recommendation — how to fix the spec**:

1. Add `data-air-pulse` to Section 14.3 (Light DOM Attributes):

   > | `data-air-pulse` | `<mark>` highlight elements | Light DOM | Present during pulse animation (transient, ~900ms) |

2. Update the implementation to actually set this attribute during pulse:

   ```typescript
   export function pulseHighlight(id: string): void {
     const marks = getHighlightMarks(id);
     for (const mark of marks) {
       const el = mark as HTMLElement;
       el.setAttribute('data-air-pulse', '');
       el.style.transition = 'background-color 0.3s ease';
       el.style.backgroundColor = 'rgba(217,119,6,0.6)';
       setTimeout(() => {
         el.style.backgroundColor = 'rgba(217,119,6,0.3)';
       }, 600);
       setTimeout(() => {
         el.style.transition = '';
         el.removeAttribute('data-air-pulse');
       }, 900);
     }
   }
   ```

3. Add `.air-annotation-item__orphan` to the spec as well — it exists in styles.ts but is not documented in the automation contract or mentioned in the spec beyond Appendix A.

---

### SPEC-010: PATCH request field mutability undefined

- **Severity**: Major
- **Category**: Error & Edge Case Coverage
- **Spec section**: 4.2 (REST API)
- **Source file**: `src/server/middleware.ts` lines 71-79

**Finding**:

The spec says `PATCH /annotations/:id` accepts "Any subset of annotation fields" and that "The `id` field cannot be changed (server enforces this)." But the middleware code at line 71-78 shows:

```typescript
store.annotations[idx] = {
  ...store.annotations[idx],
  ...body,
  id: store.annotations[idx].id, // Prevent ID change
  updatedAt: new Date().toISOString(),
};
```

Only `id` and `updatedAt` are protected. A PATCH request could overwrite `createdAt`, `pageUrl`, `pageTitle`, `selectedText`, or even `range` — any field in the body takes precedence. The spec does not enumerate which fields are mutable and which are immutable.

Additionally, for `POST /annotations`, an empty body (`{}`) is valid JSON that passes parsing. The server creates an annotation with all empty strings, which is likely undesirable. No minimum validation is specified.

**Recommendation — how to fix the spec**:

1. Add a table to Section 4.2.1:

   > **Field mutability on PATCH**:
   >
   > | Field | Mutable? | Notes |
   > |-------|----------|-------|
   > | `id` | No | Server-enforced, always preserved |
   > | `pageUrl` | Yes | Allows moving annotation to different page |
   > | `pageTitle` | Yes | |
   > | `selectedText` | Yes | Not typically changed by the client |
   > | `note` | Yes | Primary use case for PATCH |
   > | `range` | Yes | Not typically changed by the client |
   > | `createdAt` | Yes* | *Not protected — considered a minor issue |
   > | `updatedAt` | No | Server-generated on every PATCH |

2. Add a note about POST validation:

   > **Minimum validation**: `POST /annotations` does not enforce required fields. An empty body creates an annotation with all empty-string fields. The client always provides `pageUrl`, `selectedText`, `note`, and `range`. Server-side validation is not enforced — the server trusts the client as this is a dev-only tool.


---


## Minor Findings

### SPEC-011: selectedText duplication between Annotation and SerializedRange

- **Severity**: Minor
- **Category**: Consistency
- **Spec section**: 3.2 (Annotation) and 3.4 (SerializedRange)

**Finding**:

Both `Annotation` and `SerializedRange` contain a `selectedText` field. The spec does not clarify why. In the code, both are set from `range.toString()` and will always match at creation time. The duplication exists for a reason: the range's copy is used for validation during XPath restoration (comparing the restored range's text against the stored text), while the annotation's copy is used for display in the panel and export.

**Recommendation**: Add a note to Section 3.4:

> The `selectedText` in `SerializedRange` duplicates `Annotation.selectedText`. The range's copy exists for independent validation during Tier 1 highlight restoration — the deserialised range's `.toString()` is compared against `SerializedRange.selectedText` to verify the XPath still points to the correct text. The annotation-level copy is used for UI display (panel, popup preview, export).

---

### SPEC-012: Pulse animation timing and testability

- **Severity**: Minor
- **Category**: Testability
- **Spec section**: 8.3 (Highlight Pulse Animation)
- **Source file**: `src/client/highlights.ts`

**Finding**:

The pulse animation uses hardcoded timeouts (600ms, 900ms). The acceptance test checks for animation presence immediately after clicking an annotation in the panel, with a 500ms `waitForTimeout`. This is timing-dependent and potentially flaky. The spec documents the timing values but does not mention their testability implications.

**Recommendation**: Add a note to Section 8.3:

> **Testability**: The `data-air-pulse` attribute (see Section 14.3) provides a stable, timing-independent test hook. Tests should check for the presence of this attribute rather than inspecting inline style values, which are transient.

---

### SPEC-013: Bootstrap ordering dependency not explained

- **Severity**: Minor
- **Category**: Completeness
- **Spec section**: 5.1 (Bootstrap Sequence)
- **Source file**: `src/client/index.ts` lines 34-68

**Finding**:

The bootstrap creates the panel (step 4) before the FAB (step 5). The `refreshBadge` function (defined at line 34) references `fab.badge` (line 41), but `fab` is not declared until line 60. This works because JavaScript's closure semantics capture `fab` by reference, and `refreshBadge` is never called during construction — only later when the panel opens.

This ordering dependency is subtle and not documented. An agent rearranging the bootstrap could break it.

**Recommendation**: Add a note to Section 5.1:

> **Ordering dependency**: The panel MUST be created before the FAB because the `refreshBadge` closure (defined before both) references `fab.badge`. This works because the closure captures the variable by reference, not by value, and `refreshBadge` is never invoked during construction — it only executes when the user opens the panel, by which time the FAB exists.

---

### SPEC-014: Badge count vs tab count use different formulas

- **Severity**: Minor
- **Category**: Precision & Ambiguity
- **Spec section**: 6.1 (FAB Badge) and 6.2.1 (This Page Tab)
- **Source files**: `src/client/annotator.ts` line 209, `src/client/ui/panel.ts` lines 499-500

**Finding**:

The spec says in Section 6.1: "Shows the annotation count for the current page only" (badge). In Section 6.2.1: "The count includes both annotations and page notes for the current page" (tab label).

These use different counting formulas:
- **Badge**: `pageAnnotations.length` (annotations only)
- **Tab label**: `annotations.filter(...).length + pageNotes.filter(...).length` (annotations + page notes)

The difference is correct but not clearly contrasted. A reader could easily assume they use the same formula.

**Recommendation**: Make the distinction explicit in both sections:

> **Section 6.1**: "Shows the count of text annotations (not page notes) for the current page."
>
> **Section 6.2.1**: "The tab label count includes both text annotations AND page notes for the current page. This differs from the FAB badge, which counts only text annotations."

---

### SPEC-015: Missing cross-reference from Tier 2 to context matching algorithm

- **Severity**: Minor
- **Category**: Agent-Readability
- **Spec section**: 8.4 (Three-Tier Highlight Restoration)

**Finding**:

Section 8.4 Tier 2 mentions "Score each match by how well `contextBefore` and `contextAfter` align" but the detailed scoring algorithm is in Section 15.3. There is no explicit cross-reference.

**Recommendation**: Add to Section 8.4, Tier 2:

> See Section 15.3 for the full context matching algorithm and scoring rules.

---

### SPEC-016: Page note form toggle behaviour undocumented

- **Severity**: Minor
- **Category**: Completeness
- **Spec section**: 11.2 (Page Note CRUD)
- **Source file**: `src/client/ui/panel.ts` lines 338-344

**Finding**:

The "+ Note" button acts as a toggle. If the add-note form is already visible, clicking "+ Note" again removes it without creating a note. This toggle behaviour is not mentioned in the spec.

```typescript
// panel.ts lines 338-344
const existing = content.querySelector('.air-note-form');
if (existing) {
  existing.remove();
  return; // Toggle off
}
```

**Recommendation**: Add to Section 11.2 under Create:

> The "+ Note" button acts as a toggle: if the add-note form is already visible, clicking "+ Note" again dismisses it without creating a note.

---

### SPEC-017: Shadow DOM selection filtering rules imprecise

- **Severity**: Minor
- **Category**: Error & Edge Case Coverage
- **Spec section**: 7.3 (Selection Filtering)
- **Source file**: `src/client/annotator.ts` lines 50-73

**Finding**:

The spec lists four conditions for ignoring selections but uses imprecise language ("inside the Shadow DOM host element"). The code performs two separate checks:

1. `host.contains(e.target as Node)` — checks if mouseup target is inside the host DIV (line 51)
2. `host.contains(range.commonAncestorContainer)` — checks if range ancestor is inside the host DIV (line 73)

The `host.contains()` method does NOT pierce shadow roots — it only checks light DOM descendants of the host element. Since the host has no light DOM children (all UI is in the shadow root), this check effectively prevents selections that somehow involve the host element itself but would NOT catch selections inside the shadow root. However, shadow root selections are already impossible because shadow DOM elements are not selectable by normal text selection.

**Recommendation**: Clarify Section 7.3:

> Selections are ignored if ANY of:
> 1. The `mouseup` event target is a descendant of the host element (or the host itself)
> 2. The selection is collapsed (cursor click without drag)
> 3. The selected text, after trimming, is empty (whitespace-only)
> 4. The range's `commonAncestorContainer` is a descendant of the host element
>
> Note: `Element.contains()` does not pierce shadow boundaries. Shadow DOM content is inherently unselectable by standard text selection, so no additional check is needed.

---

### SPEC-018: Export timestamp timezone not specified

- **Severity**: Minor
- **Category**: Completeness
- **Spec section**: 9.2 (Format Rules)
- **Source files**: `src/client/export.ts` line 16, `src/server/middleware.ts` line 194

**Finding**:

The spec says "Export date: ISO-like format YYYY-MM-DD HH:MM (no seconds)". Both implementations use:

```typescript
new Date().toISOString().slice(0, 16).replace('T', ' ')
```

`toISOString()` always returns UTC. The exported timestamp is UTC but no timezone indicator is shown. For a dev tool, local time might be more intuitive. The spec does not specify which timezone.

**Recommendation**: Add to Section 9.2:

> The export timestamp is in UTC (no timezone suffix displayed). Both the server and client export implementations use `new Date().toISOString()` which always produces UTC.


---


## Suggestions

### SPEC-019: Add action-response quick reference table

- **Severity**: Suggestion
- **Category**: Agent-Readability
- **Spec section**: Overall structure

**Finding**:

The spec is well-organised but lacks a quick-lookup table mapping user actions to system responses. For an AI agent implementing features, this would provide a rapid reference without reading full narrative sections.

**Recommendation**: Add an "Appendix B: Action-Response Quick Reference":

> | User Action | System Response | Key Sections |
> |-------------|----------------|--------------|
> | Select text on page | Popup appears near selection | 7.1, 6.3 |
> | Click Save in popup | Annotation created, highlight applied, badge updated | 7.1, 8.1, 6.1 |
> | Click Cancel in popup | Popup dismissed, selection cleared | 6.3 |
> | Click existing highlight | Edit popup appears with pre-filled note | 7.2, 6.3 |
> | Click Delete in edit popup | Annotation deleted, highlight removed | 7.2, 8.2 |
> | Click FAB | Panel toggles open/closed | 6.1, 6.2 |
> | Click annotation in panel | Page scrolls to highlight, highlight pulses | 6.2.3, 8.3 |
> | Click "+ Note" in panel | Add-note form appears/toggles | 11.2 |
> | Click "Clear All" in panel | Confirmation step, then deletes all | 6.2.5 |
> | Press Escape | Dismiss popup (priority) or close panel | 10.4 |
> | Press Cmd/Ctrl+Shift+. | Toggle panel | 10.1 |
> | Press Cmd/Ctrl+Shift+E | Export to clipboard, show toast | 10.1, 9.3 |
> | Press Cmd/Ctrl+Shift+N | Open panel and add-note form | 10.1, 11.2 |
> | Page reload | Highlights restored from server | 8.4, 8.6 |
> | Navigate to different page | Badge updates, highlights re-applied | 12.2 |
> | `astro build` | Zero traces in output | 13 |

---

### SPEC-020: Document intentional design boundaries

- **Severity**: Suggestion
- **Category**: Completeness
- **Spec section**: 2.2 (Configuration Options)

**Finding**:

There is only one configuration option. An AI agent maintaining this component might be tempted to add more options without understanding the design philosophy.

**Recommendation**: Add after Section 2.2:

> **Design boundary**: Additional configuration options (theme, position, keybindings, storage backend) are intentionally omitted to maintain zero-config simplicity. The integration is designed for dev-only use where customisation is low priority. Any future options should be justified against the zero-config principle.

---

### SPEC-021: Separate test gap analysis from normative specification

- **Severity**: Suggestion
- **Category**: Agent-Readability
- **Spec section**: Appendix A

**Finding**:

Appendix A documents test coverage gaps, which is valuable meta-information but mixes specification (what the system should do) with test planning (what tests exist). An agent reading the spec for implementation might be confused.

**Recommendation**: Either:
- Move Appendix A to a separate document (e.g. `docs/reviews/test-coverage-gaps.md`) with a cross-reference from the spec
- Or relabel it: "Appendix A: Known Test Coverage Gaps (for test authors, not implementers)"

---

### SPEC-022: Add element lifecycle to automation contract

- **Severity**: Suggestion
- **Category**: Contract Completeness
- **Spec section**: 14.1 (Element Identification)

**Finding**:

The automation contract table lists `data-air-el` values but does not indicate which elements are always present vs conditionally present. An automation agent needs this to avoid timing issues.

**Recommendation**: Add a "Lifecycle" column to the table in Section 14.1:

> | Value | Lifecycle |
> |-------|-----------|
> | `fab` | Always present after bootstrap |
> | `badge` | Always present (child of FAB) |
> | `panel` | Always present (may be hidden) |
> | `popup` | Always present (starts hidden, `display: none`) |
> | `popup-textarea` | Always present (child of popup) |
> | `popup-save` | Rebuilt each time popup is shown |
> | `popup-cancel` | Rebuilt each time popup is shown |
> | `popup-delete` | Only present in edit mode |
> | `tab-this-page` | Always present (child of panel) |
> | `tab-all-pages` | Always present (child of panel) |
> | `annotation-item` | Present when panel is open and annotations exist |
> | `page-note-item` | Present when panel is open and page notes exist |
> | `page-note-add` | Always present (child of panel header) |
> | `page-note-textarea` | Present when add/edit note form is open |
> | `page-note-edit` | Present on each page note item when panel shows notes |
> | `page-note-delete` | Present on each page note item when panel shows notes |
> | `page-note-cancel` | Present when add/edit note form is open |
> | `page-note-save` | Present when add/edit note form is open |
> | `clear-all` | Always present (child of panel header) |
> | `toast` | Created on first toast, then reused |

---

### SPEC-023: Acknowledge accessibility scope

- **Severity**: Suggestion
- **Category**: Completeness
- **Spec section**: Missing entirely

**Finding**:

The spec documents `aria-label` and `title` on the FAB but says nothing about accessibility elsewhere. There is no mention of: keyboard navigation within the panel, ARIA roles on the panel or popup, focus management when popup opens/closes, focus trapping in the panel, or screen reader announcements.

**Recommendation**: Add a Section 18 (Accessibility):

> ### 18. Accessibility
>
> The integration provides minimal accessibility support appropriate for a dev-only tool:
>
> - **FAB**: `aria-label="Toggle inline review panel"` and `title="Inline Review"`
> - **Popup textarea**: Auto-focused on open via `requestAnimationFrame(() => textarea.focus())`
> - **Page note textarea**: Auto-focused when add/edit form opens
>
> The following accessibility features are explicitly **out of scope** for this dev tool:
> - ARIA roles on the panel (e.g. `role="complementary"`)
> - Focus trapping within the panel or popup
> - Keyboard navigation between annotation items in the panel
> - Screen reader announcements for state changes
> - High contrast mode support
>
> These may be added in future if the tool gains broader adoption.

---

### SPEC-024: Document ID collision resistance

- **Severity**: Suggestion
- **Category**: Consistency
- **Spec section**: 3.5 (ID Generation)

**Finding**:

The ID format `Date.now().toString(36) + Math.random().toString(36).slice(2, 8)` is documented but its collision resistance is not. For a single-user dev tool this is fine, but an agent might question whether deduplication is needed.

**Recommendation**: Add to Section 3.5:

> **Collision resistance**: The combination of millisecond timestamp (base-36) and 6 random characters (base-36, ~2.18 billion combinations) makes collisions negligible for single-user use. No server-side deduplication guard is implemented. If two annotations are created in the same millisecond, the random suffix provides sufficient differentiation.


---


## Resolution Priority

For an agent tasked with addressing these findings, the recommended order is:

### Phase 1 — Critical (must fix before agent-driven implementation)
1. **SPEC-001**: Document API response asymmetry
2. **SPEC-002**: Rewrite Escape key section as normative spec
3. **SPEC-003**: Document GET /page-notes usage and client endpoint mapping

### Phase 2 — Major (should fix to prevent implementation bugs)
4. **SPEC-006**: Add inter-component communication section (new Section 5.6)
5. **SPEC-008**: Document FAB/panel state desync
6. **SPEC-010**: Add field mutability table for PATCH
7. **SPEC-005**: Precise context matching algorithm
8. **SPEC-007**: Precise popup positioning algorithm
9. **SPEC-004**: Document Clear All implementation details
10. **SPEC-009**: Add data-air-pulse to automation contract

### Phase 3 — Minor (improve precision and clarity)
11. **SPEC-014**: Clarify badge vs tab counting difference
12. **SPEC-011**: Explain selectedText duplication
13. **SPEC-013**: Document bootstrap ordering dependency
14. **SPEC-016**: Document page note form toggle
15. **SPEC-015**: Add cross-references
16. **SPEC-017**: Clarify selection filtering rules
17. **SPEC-018**: Specify export timestamp timezone
18. **SPEC-012**: Note pulse animation testability

### Phase 4 — Suggestions (nice to have)
19. **SPEC-019**: Add action-response quick reference
20. **SPEC-022**: Add element lifecycle column
21. **SPEC-023**: Add accessibility section
22. **SPEC-020**: Document design boundaries
23. **SPEC-024**: Document ID collision resistance
24. **SPEC-021**: Separate test gaps from spec
