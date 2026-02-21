---
generated_by: Claude Opus 4.6
generation_date: 2026-02-21
model_version: claude-opus-4-6
purpose: specification_review_round_2
status: resolved
reviewed_document: docs/spec/specification.md
prior_review: docs/reviews/2026-02-21-spec-review.md
cross_references:
  - src/ (component source code)
  - ../astro-inline-review-tests/ (acceptance test suite)
tags: [review, specification, quality, gaps, ai-agent-readability, round-2]
---

# Specification Review Round 2: astro-inline-review

**Reviewed**: `docs/spec/specification.md`
**Review date**: 2026-02-21
**Reviewer**: Claude Opus 4.6 (independent second review)
**Prior review**: `docs/reviews/2026-02-21-spec-review.md` (24 findings, all resolved)
**Purpose**: Fresh independent review of the specification after incorporating the first review's findings.

## Review Dimensions

1. **Completeness** -- Missing behaviours, edge cases, or interactions
2. **Precision & Ambiguity** -- Statements open to multiple interpretations
3. **Consistency** -- Contradictions between sections
4. **Testability** -- Whether requirements have clear pass/fail criteria
5. **Agent-Readability** -- Structure and navigability for AI agents
6. **Error & Edge Case Coverage** -- Failure modes and unusual scenarios
7. **Contract Completeness** -- Automation contract (`data-air-*` attributes)
8. **Source Code Accuracy** -- Does the spec accurately describe what the code does?

## Summary

| Severity | Count | Description |
|----------|-------|-------------|
| Critical | 0 | Would cause incorrect implementation by an agent |
| Major | 4 | Significant gaps that could cause bugs or wasted effort |
| Minor | 7 | Imprecise language, missing details, minor gaps |
| Suggestion | 4 | Improvements for clarity and maintainability |
| **Total** | **15** | |

**Overall verdict**: The specification is now substantially solid. The first review's critical findings (API response asymmetry, Escape key semantics, endpoint documentation) have been addressed well, and the new sections (inter-component communication, FAB state desync, field mutability table, accessibility scope) are valuable additions. The remaining findings fall into two categories: (1) discrepancies between the spec and the actual source code that emerged from close comparison, and (2) gaps in specifying behaviours that are present in the code but absent from the spec. None are critical -- an agent implementing from this spec would produce a functionally correct system, though it might diverge from the current implementation in minor ways.

---

## Major Findings

### SPEC2-001: Popup positioning `translateY(-100%)` logic does not match implementation

- **Severity**: Major
- **Category**: Source Code Accuracy
- **Spec section**: 6.3 (Selection Popup) -- Positioning algorithm
- **Source file**: `/Users/matthewvivian/Documents/code/cpd/astro-inline-review/src/client/ui/popup.ts` lines 136-157

**Finding**:

The spec says (step 5):

> If placed above: apply `transform: translateY(-100%)` so the popup's bottom edge aligns with the selection's top edge

The code at line 156:

```typescript
container.style.transform = top < rect.top ? 'translateY(-100%)' : '';
```

This condition is `top < rect.top`, but after the positioning logic:
- "Above" case: `top = rect.top - 8`, so `top < rect.top` is true. The transform IS applied. This matches the spec.
- "Below" case: `top = rect.bottom + 8`, so `top > rect.top`, and the condition is false. No transform. This matches the spec.

However, the actual condition should technically be checking whether the popup was placed above or below, not whether `top < rect.top`. Consider: if `rect.top - 8 < 208`, the code switches to `top = rect.bottom + 8`. If `rect.bottom + 8` happens to be less than `rect.top` (impossible in normal geometry but the code doesn't guard against it), the logic would produce incorrect results.

More importantly, the spec's step 3 says `top = selection.top - 8`, and then the transform check is framed as "if placed above". But the code's boolean `top < rect.top` is a **positional check** that happens to correlate with "above" placement, not a direct above/below flag. If the positioning algorithm is ever changed (e.g. different margin values), this indirect check could break silently.

The spec should either match the code's actual condition or note that the above/below determination is inferred from the final `top` value rather than tracked explicitly.

**Recommendation**:

Update step 5 in Section 6.3 to match the code precisely:

> 5. Apply transform based on final position: if `top < selection.top`, apply `transform: translateY(-100%)` (popup above selection); otherwise no transform (popup below selection).

Or add a note:

> **Implementation note**: The above/below determination is inferred from `top < selection.top` rather than being tracked as a boolean. This works because the "above" case always sets `top = selection.top - margin` (which is less than `selection.top`) and the "below" case sets `top = selection.bottom + margin` (which is greater than `selection.top`).

---

### SPEC2-002: Context extraction is limited to single text nodes, undocumented

- **Severity**: Major
- **Category**: Source Code Accuracy / Completeness
- **Spec section**: 15.3 (Context Matching) and 3.4 (SerializedRange)
- **Source file**: `/Users/matthewvivian/Documents/code/cpd/astro-inline-review/src/client/selection.ts` lines 193-211

**Finding**:

Section 3.4 says:

> `contextBefore: string; // Exactly 30 characters before selection (or fewer if insufficient text exists)`

Section 15.3 says:

> Exactly 30 characters are stored (or fewer if insufficient text exists before/after the selection boundary).

This implies the context is extracted from the document's running text, walking backwards/forwards across DOM nodes as needed. However, the actual implementation only extracts context from the **start/end text node** of the range:

```typescript
function extractContextBefore(range: Range): string {
  const container = range.startContainer;
  if (container.nodeType === Node.TEXT_NODE) {
    const text = container.textContent ?? '';
    const start = Math.max(0, range.startOffset - CONTEXT_LENGTH);
    return text.slice(start, range.startOffset);
  }
  return '';  // <-- Returns empty string if not a text node!
}
```

This means:
1. If the selection starts at the beginning of a text node (offset 0), `contextBefore` will be an empty string -- even if the preceding element contains text.
2. If the selection starts at offset 5 in a text node, `contextBefore` will be at most 5 characters, even if the preceding text node has 25 more characters available.
3. If `startContainer` is not a text node (e.g. an element node with child text nodes), `contextBefore` is an empty string.

This is a significant limitation that affects Tier 2 context matching accuracy. When `contextBefore` and `contextAfter` are both empty, context scoring produces 0 for all candidates, and the first occurrence wins by default -- which may not be the correct match.

**Recommendation**:

Add a note to Section 15.3:

> **Context extraction limitation**: The `contextBefore` string is extracted solely from `range.startContainer.textContent` (the text node containing the start of the selection). It does not walk backwards across preceding text nodes or elements. Similarly, `contextAfter` is extracted solely from `range.endContainer.textContent`. This means:
>
> - If the selection starts at offset 0 in a text node, `contextBefore` is an empty string.
> - If `startContainer` is not a text node, `contextBefore` is an empty string.
> - The stored context length may be significantly less than 30 characters even when surrounding text exists.
>
> When both `contextBefore` and `contextAfter` are empty, all candidates score 0 and the first occurrence is selected. This is a known limitation that could be improved by walking the DOM tree to gather context across node boundaries.

---

### SPEC2-003: Escape key closeActive handler directly manipulates popup CSS class rather than calling hidePopup

- **Severity**: Major
- **Category**: Source Code Accuracy / Consistency
- **Spec section**: 10.4 (Escape Precedence)
- **Source file**: `/Users/matthewvivian/Documents/code/cpd/astro-inline-review/src/client/index.ts` lines 73-84

**Finding**:

Section 10.4 says:

> 1. If the popup is visible: dismiss the popup.

The `closeActive` handler in `index.ts` lines 73-84:

```typescript
closeActive: () => {
  const popupEl = shadowRoot.querySelector('.air-popup--visible');
  if (popupEl) {
    popupEl.classList.remove('air-popup--visible');
    popupEl.setAttribute('data-air-state', 'hidden');
    return;
  }
  if (isPanelOpen(panel)) {
    closePanel(panel);
  }
},
```

This directly queries for `.air-popup--visible` and removes the class, rather than calling the `hidePopup()` function from `popup.ts`. The `hidePopup()` function also clears the textarea value:

```typescript
export function hidePopup(popup: PopupElements): void {
  popup.container.classList.remove('air-popup--visible');
  popup.container.setAttribute('data-air-state', 'hidden');
  popup.textarea.value = '';  // <-- This is skipped by closeActive
}
```

This means pressing Escape to dismiss the popup does NOT clear the textarea. If the user then selects new text, the `showPopup` function is called which sets `textarea.value = ''` (line 72 of popup.ts), so the stale value is overwritten. But if the same highlight is clicked again to edit, `showEditPopup` sets `textarea.value = existingNote`, which also overwrites. So the practical impact is nil -- but it's a deviation from `hidePopup()` behaviour that could become a bug if `showPopup` or `showEditPopup` is changed.

Additionally, the `closeActive` handler does not clear `currentRange` (the module-level variable in annotator.ts that tracks the selection range for creating new annotations). The scroll handler and cancel button both clear it. The Escape handler does not, because `currentRange` is scoped to the annotator module and not accessible from `index.ts`. This means if the user selects text, the popup appears, they press Escape, and then click Save on a subsequently-appeared popup -- the stale `currentRange` could theoretically be used. In practice, `showPopup` is only called from `onMouseUp` which sets a fresh `currentRange`, so this is unlikely to cause issues.

The spec should document that the Escape handler uses a CSS class query pattern rather than calling `hidePopup()`, as an agent re-implementing `closeActive` might import and call `hidePopup(popup)` instead, which would require access to the `PopupElements` reference that `closeActive` doesn't have.

**Recommendation**:

Add to Section 10.4 under the Escape handling:

> **Implementation detail**: The `closeActive()` handler checks for popup visibility by querying for the `.air-popup--visible` CSS class on the shadow root, rather than calling the `hidePopup()` function. This is because `closeActive` is defined in the bootstrap module (`index.ts`) which has access to the shadow root but not the `PopupElements` reference (which is scoped to the annotator). The handler removes the visibility class and sets `data-air-state` to `hidden`, but does not clear the textarea value (unlike `hidePopup()` which does). This has no user-visible impact because subsequent popup displays always set the textarea value explicitly.

---

### SPEC2-004: Export keyboard shortcut fetches full (unfiltered) store from server, not from cache

- **Severity**: Major
- **Category**: Source Code Accuracy
- **Spec section**: 9.3 (Clipboard Export)
- **Source file**: `/Users/matthewvivian/Documents/code/cpd/astro-inline-review/src/client/index.ts` lines 85-89

**Finding**:

Section 9.3 says:

> 1. Generates Markdown from the cached store (or fetches from API)

The actual implementation in `index.ts` lines 85-89:

```typescript
exportToClipboard: async () => {
  // Always fetch from server -- cache only has current page's annotations
  const store = await api.getStore();  // No page filter!
  const success = await exportToClipboard(store);
  showToast(shadowRoot, success ? 'Copied to clipboard!' : 'Export failed -- try again');
},
```

The comment in the code explicitly says "Always fetch from server" and calls `api.getStore()` without a page filter. This means the export always makes a network request and gets ALL annotations and page notes (unfiltered). The spec's "(or fetches from API)" phrasing suggests a fallback pattern, but the code always fetches.

This matters because: (1) the cache only contains page-filtered annotations (written by `restoreHighlights` which passes `window.location.pathname`), and (2) the export must include ALL pages, which the cache cannot provide.

**Recommendation**:

Update Section 9.3 step 1:

> 1. Fetches the full (unfiltered) store from the server via `api.getStore()` (no page filter). The client-side cache is NOT used for export because it only contains the current page's annotations.

---

## Minor Findings

### SPEC2-005: Shadow DOM selection filtering has an additional check not in spec

- **Severity**: Minor
- **Category**: Source Code Accuracy
- **Spec section**: 7.3 (Selection Filtering)
- **Source file**: `/Users/matthewvivian/Documents/code/cpd/astro-inline-review/src/client/annotator.ts` lines 70-73

**Finding**:

Section 7.3 lists four conditions for ignoring selections. Condition 4 says:

> The range's `commonAncestorContainer` is a descendant of the host element

The actual code at lines 72-73:

```typescript
if (host.contains(range.commonAncestorContainer) ||
    shadowRoot.contains(range.commonAncestorContainer)) return;
```

There is an additional check: `shadowRoot.contains(range.commonAncestorContainer)`. The spec's note says "Element.contains() does not pierce shadow boundaries" and concludes no additional check is needed. But the code explicitly checks the shadow root too. This additional check handles the theoretical case where `commonAncestorContainer` is inside the shadow root (e.g. if the user somehow selects shadow DOM text via JavaScript).

**Recommendation**:

Update condition 4 in Section 7.3:

> 4. The range's `commonAncestorContainer` is a descendant of the host element OR a descendant of the shadow root.
>
> Note: `Element.contains()` does not pierce shadow boundaries, so both checks are needed. The shadow root check handles the edge case where `commonAncestorContainer` is inside the shadow DOM (e.g. via programmatic selection). In practice, shadow DOM content cannot be selected via standard mouse-based text selection.

---

### SPEC2-006: Highlight click detection only checks direct target, not parent marks

- **Severity**: Minor
- **Category**: Completeness
- **Spec section**: 7.2 (Editing an Annotation)
- **Source file**: `/Users/matthewvivian/Documents/code/cpd/astro-inline-review/src/client/annotator.ts` lines 54-58

**Finding**:

Section 7.2 says:

> 1. User clicks an existing `<mark>` highlight
> 2. Annotator reads the `data-air-id` attribute to find the annotation

The actual code:

```typescript
const target = e.target as HTMLElement;
if (target.tagName === 'MARK' && target.hasAttribute(HIGHLIGHT_ATTR)) {
  handleHighlightClick(target);
  return;
}
```

This only checks if the **direct click target** is a `<mark>` element. If the text inside a mark contains inline elements (e.g. the page has `<p><mark data-air-id="x">some <em>italic</em> text</mark></p>`) and the user clicks on the `<em>` element, `e.target` will be the `<em>`, not the `<mark>`. The click will fall through to the selection detection path rather than the edit path.

This is an edge case -- highlights are applied to text nodes, not element nodes, so the `<mark>` won't typically contain child elements. But if the annotated text originally contained inline formatting, the mark wrapping could nest around those elements.

**Recommendation**:

Add a note to Section 7.2:

> **Limitation**: The highlight click detection checks only the direct `mouseup` target, not its ancestors. If the clicked element is a child of a `<mark>` (e.g. an `<em>` inside the highlighted text), the click will be treated as a new selection rather than an edit. This is unlikely in practice because highlights wrap text nodes, not elements, but could occur if the original text contained inline formatting within the annotated range.

---

### SPEC2-007: Popup starts with `display: none`, not just hidden state attribute

- **Severity**: Minor
- **Category**: Source Code Accuracy
- **Spec section**: 14.1 (Automation Contract) and 6.3 (Selection Popup)
- **Source file**: `/Users/matthewvivian/Documents/code/cpd/astro-inline-review/src/client/styles.ts` lines 237-248

**Finding**:

Section 14.1 says the popup lifecycle is "Always present (starts hidden, `display: none`)". This is accurate per the CSS:

```css
.air-popup {
  /* ... */
  display: none;
}

.air-popup--visible {
  display: block;
}
```

However, Section 6.3 describes the popup's visibility management only in terms of `data-air-state` and the CSS class `air-popup--visible`. It does not mention that the popup uses `display: none` / `display: block` toggling. This distinction matters for automation: tests using `isVisible()` will correctly report the popup as not visible when it has `display: none`, but tests checking `data-air-state` will see `"hidden"` which is set via JavaScript. Both mechanisms are in play simultaneously.

The Section 14.2 (State Tracking) table says popup values are `visible` / `hidden`, which is correct for `data-air-state`. But the actual visibility is controlled by the CSS class (`air-popup--visible` toggling `display`), with `data-air-state` as a parallel indicator.

**Recommendation**:

Add a brief note to Section 6.3:

> The popup's visibility is controlled by two mechanisms:
> 1. The CSS class `air-popup--visible` toggles `display: block` (visible) / `display: none` (hidden)
> 2. The `data-air-state` attribute is set to `"visible"` or `"hidden"` in parallel
>
> Tests should use `data-air-state` (the automation contract) rather than CSS display inspection.

---

### SPEC2-008: `openPanel` action in test helper uses panel `isVisible()` but spec says use `data-air-state`

- **Severity**: Minor
- **Category**: Testability / Consistency
- **Spec section**: 14.2 (State Tracking)
- **Test file**: `/Users/matthewvivian/Documents/code/cpd/astro-inline-review-tests/helpers/actions.ts` lines 207-214

**Finding**:

The spec's automation contract (Section 14) establishes `data-air-state` as the stable contract for state checking. The assertion helpers correctly use `data-air-state`:

```typescript
// assertions.ts
export async function expectPanelOpen(page: Page): Promise<void> {
  const panel = shadowLocator(page, SELECTORS.panel);
  await expect(panel).toHaveAttribute('data-air-state', 'open');
}
```

However, the `openPanel` action helper uses `isVisible()`:

```typescript
// actions.ts
export async function openPanel(page: Page): Promise<void> {
  const panel = shadowLocator(page, SELECTORS.panel);
  const isVisible = await panel.isVisible().catch(() => false);
  if (!isVisible) {
    await clickFab(page);
    await panel.waitFor({ state: 'visible' });
  }
}
```

This checks CSS visibility rather than `data-air-state`. While `visibility: visible` and `data-air-state="open"` should always be in sync (both are set by `togglePanel`), this inconsistency could cause subtle issues. For example, during the 0.3s CSS transition, the `visibility` property is changing but `data-air-state` was set immediately -- so `isVisible()` might return `false` even though `data-air-state` is already `"open"`.

This is a test infrastructure concern rather than a spec issue, but it highlights that the spec could be clearer about the timing relationship between `data-air-state`, CSS classes, and CSS `visibility` transitions.

**Recommendation**:

Add a note to Section 6.2 (Panel Animation):

> **Timing**: `data-air-state` is set immediately when `togglePanel()` is called, before the CSS transition completes. The `visibility` CSS property transitions alongside `transform` over 0.3s. Tests checking `data-air-state` will see the new state immediately; tests checking CSS visibility may need to wait for the transition to complete.

This is primarily guidance for test authors and is already partially documented in Appendix A. Consider adding a cross-reference.

---

### SPEC2-009: Panel refresh (`__refreshPanel`) also calls `updateTabCounts` which makes a separate API request

- **Severity**: Minor
- **Category**: Completeness
- **Spec section**: 5.6.2 (Shadow Root Bridge)
- **Source file**: `/Users/matthewvivian/Documents/code/cpd/astro-inline-review/src/client/ui/panel.ts` lines 119-122 and 491-508

**Finding**:

Section 5.6.2 says `__refreshPanel()`:

> Re-render panel content and update tab counts

The implementation at lines 119-122:

```typescript
(shadowRoot as any).__refreshPanel = () => {
  refreshPanel(content, activeTab, callbacks);
  updateTabCounts(thisPageTab, allPagesTab);
};
```

`updateTabCounts` at lines 491-508 makes its own `api.getStore()` call (unfiltered), separate from the `refreshPanel` call which also fetches data. This means each `__refreshPanel()` invocation triggers **two** API requests: one for the panel content (filtered or unfiltered depending on active tab) and one for the tab counts (always unfiltered).

For operations that call `__refreshPanel()` after already making an API request (e.g. after a DELETE, which itself reads and writes the store), this results in 3+ sequential file reads. The spec does not mention this double-fetch pattern.

**Recommendation**:

Add to Section 5.6.2:

> **Performance note**: `__refreshPanel()` triggers two separate API requests: one for `refreshPanel()` (which fetches the store for the active tab's content) and one for `updateTabCounts()` (which fetches the unfiltered store for accurate counts on both tabs). This means each panel refresh performs two `GET /annotations` requests. For a dev-only tool this is acceptable, but it could be optimised by sharing the store data between both functions.

---

### SPEC2-010: `api.getExport()` does not set Content-Type header and uses `res.text()` not `res.json()`

- **Severity**: Minor
- **Category**: Source Code Accuracy
- **Spec section**: 4.2.3 (Export Endpoint) and 5.5 (API Client)
- **Source file**: `/Users/matthewvivian/Documents/code/cpd/astro-inline-review/src/client/api.ts` lines 62-65

**Finding**:

Section 5.5 says:

> All requests set `Content-Type: application/json`.

The `api.getExport()` method:

```typescript
async getExport(): Promise<string> {
  const res = await fetch(`${API_BASE}/export`);
  return res.text();
},
```

This does NOT use the `request()` helper (which adds `Content-Type: application/json`). It makes a bare `fetch()` call and reads the response as text, not JSON. This is correct because the export endpoint returns `text/markdown`, not JSON.

However, the spec's blanket statement "All requests set `Content-Type: application/json`" is incorrect for this endpoint. Additionally, `api.getExport()` does not handle error responses -- if the server returns a 500, the method will return the error response body as text rather than throwing.

**Recommendation**:

Update Section 5.5:

> All requests except `GET /export` set `Content-Type: application/json` via the shared `request()` helper. The `GET /export` call uses a direct `fetch()` since the response is `text/markdown`, not JSON.

Also note in Section 5.5 or 16.1:

> The `api.getExport()` method does not check `res.ok` or parse error responses. A server error on the export endpoint would return the error body as the "markdown" text.

---

### SPEC2-011: Appendix A item 3 (page note edit flow) describes uncertainty that is resolvable

- **Severity**: Minor
- **Category**: Agent-Readability
- **Spec section**: Appendix A.1, item 3

**Finding**:

Appendix A.1 item 3 says:

> The acceptance test `07-page-notes.spec.ts` has a test for editing page notes, but the test relies on `data-air-el="page-note-edit"` and `data-air-el="page-note-save"` buttons. If the edit flow uses an inline form replacement (as the implementation does), the test assertions may need to verify the form appears and the updated text persists.

The test at `07-page-notes.spec.ts` lines 38-66 is clear and functional -- it clicks Edit, clears the textarea, fills new text, clicks Save, and verifies the updated text. The hedging language ("may need to verify") is unnecessarily uncertain. The test does verify the flow works.

**Recommendation**:

Rewrite Appendix A.1 item 3:

> **Page note edit flow**: The edit test (`07-page-notes.spec.ts`) tests the happy path (click Edit, modify text, click Save, verify updated text persists). It does not test: (a) cancelling an edit (clicking Cancel should discard changes), (b) editing to empty text (should the note be deleted or the edit rejected?), or (c) that the inline form replacement correctly replaces the item DOM rather than appending.

---

## Suggestions

### SPEC2-012: Add a glossary of internal CSS class names used in the spec

- **Severity**: Suggestion
- **Category**: Agent-Readability
- **Spec section**: Throughout

**Finding**:

The spec references several internal CSS class names:
- `air-panel--open` (Section 6.1 State Synchronisation, Section 10.4)
- `air-popup--visible` (Section 10.4 Implementation detail)
- `air-fab--open` (Section 6.1)
- `.air-annotation-item__orphan` (Section 8.4 Tier 3)
- `.air-note-form` (Section 11.2)

These are implementation details, not part of the automation contract, but they appear in the spec as normative descriptions of how the code works. An agent implementing from the spec might not know whether these are part of the contract or internal.

**Recommendation**:

Add a brief note to Section 14 (Automation Contract):

> **Internal CSS classes**: The spec references several internal CSS class names (e.g. `air-panel--open`, `air-popup--visible`, `air-fab--open`) in its description of how state management works. These are **not** part of the automation contract and may change. The `data-air-state` and `data-air-el` attributes are the stable contract. Internal class names are documented for implementer context only.

---

### SPEC2-013: Consider documenting the `destroy()` method on AnnotatorInstance

- **Severity**: Suggestion
- **Category**: Completeness
- **Spec section**: 5.1 (Bootstrap Sequence)
- **Source file**: `/Users/matthewvivian/Documents/code/cpd/astro-inline-review/src/client/annotator.ts` lines 270-273

**Finding**:

The `createAnnotator` function returns an `AnnotatorInstance` with two methods: `restoreHighlights()` and `destroy()`. The spec documents `restoreHighlights()` in the bootstrap sequence (step 8) and in Section 8.6, but never mentions `destroy()`.

```typescript
export interface AnnotatorInstance {
  restoreHighlights: () => Promise<void>;
  destroy: () => void;
}
```

The `destroy()` method removes the `mouseup` and `scroll` event listeners. It is never called in the current codebase -- there is no cleanup path. For a dev-only tool that lives for the entire page lifetime, this is fine. But it exists as public API.

**Recommendation**:

Add a brief note to Section 5.1:

> The annotator also exposes a `destroy()` method that removes event listeners (`mouseup`, `scroll`). This is not called during normal operation -- the annotator lives for the entire page lifecycle. The method exists for potential future use (e.g. hot-module replacement cleanup).

---

### SPEC2-014: The spec should note that `restoreHighlights()` is async but called without `await` during bootstrap

- **Severity**: Suggestion
- **Category**: Precision & Ambiguity
- **Spec section**: 5.1 (Bootstrap Sequence), step 8
- **Source file**: `/Users/matthewvivian/Documents/code/cpd/astro-inline-review/src/client/index.ts` lines 102-107

**Finding**:

The bootstrap sequence lists step 8 as:

> **Restore highlights**: `annotator.restoreHighlights()` -- restore persisted highlights for the current page

The function returns `Promise<void>`. In `index.ts`, it is called as:

```typescript
annotator.restoreHighlights();  // No await!
```

And similarly for the `astro:page-load` listener:

```typescript
document.addEventListener('astro:page-load', () => {
  annotator.restoreHighlights();  // No await!
});
```

This is a fire-and-forget pattern. The highlights are restored asynchronously after the bootstrap completes. An agent implementing this might add `await`, which would require making `init()` async and changing the `DOMContentLoaded` listener pattern.

**Recommendation**:

Add a note to step 8:

> `restoreHighlights()` is async but called without `await` (fire-and-forget). The bootstrap function `init()` is synchronous. Highlights appear asynchronously after the bootstrap completes and the API response arrives.

---

### SPEC2-015: Appendix A undercounts test scenarios

- **Severity**: Suggestion
- **Category**: Testability
- **Spec section**: Appendix A (opening line)

**Finding**:

Appendix A opens with:

> ...in the acceptance test suite (110 scenarios across 12 spec files)

Counting the test cases across all 12 spec files:
- 01-integration: 4
- 02-fab: 8
- 03-selection: 10
- 04-highlights: 10
- 05-persistence: 9
- 06-panel: 13
- 07-page-notes: 9
- 08-multi-page: 9
- 09-export: 11
- 10-keyboard-shortcuts: 7
- 11-edge-cases: 8
- 12-production-safety: 4

Total: 102 test cases, not 110. This is a minor factual inaccuracy.

**Recommendation**:

Update the count to match the actual number, or remove the specific count and say "the acceptance test suite (12 spec files)".

---

## Resolution Priority

### Phase 1 -- Major (should fix to prevent implementation divergence)
1. **SPEC2-002**: Document context extraction single-node limitation
2. **SPEC2-004**: Correct export fetching description (server, not cache)
3. **SPEC2-003**: Document Escape handler's direct CSS class manipulation
4. **SPEC2-001**: Clarify popup translateY condition

### Phase 2 -- Minor (improve precision)
5. **SPEC2-005**: Document additional shadow root selection filter
6. **SPEC2-006**: Note highlight click detection limitation
7. **SPEC2-010**: Fix "all requests set Content-Type" claim
8. **SPEC2-007**: Document popup display:none mechanism
9. **SPEC2-009**: Note double-fetch in panel refresh
10. **SPEC2-008**: Note data-air-state vs CSS visibility timing
11. **SPEC2-011**: Rewrite Appendix A page note edit description

### Phase 3 -- Suggestions (nice to have)
12. **SPEC2-012**: Add CSS class name glossary note
13. **SPEC2-013**: Document destroy() method
14. **SPEC2-014**: Note fire-and-forget restoreHighlights
15. **SPEC2-015**: Correct test scenario count
