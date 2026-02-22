---
generated_by: Claude Opus 4.6
generation_date: 2026-02-22
model_version: claude-opus-4-6
purpose: implementation_plan
status: in-progress
human_reviewer: matthewvivian
tags: [panel, annotation, orphan, delete, dismiss, review-workflow]
---

# Annotation Dismissal and Orphan Indicator — Engineering Plan

## Context

The astro-inline-review integration supports a review workflow where a human annotates a dev site, exports annotations as Markdown, and feeds them to a coding agent. After the agent makes changes to address annotations, the reviewer reloads the page to verify.

Two problems exist in this verification step:

1. **No orphan visibility**: When the agent changes content, some annotations can no longer be located on the page (they become "orphaned" per the three-tier restoration model in spec section 8.4). The CSS class `.air-annotation-item__orphan` exists in `styles.ts` and the spec mentions orphan status, but nothing in the panel code uses it. The reviewer has no way to distinguish annotations that still match content from ones whose content has been changed.

2. **No individual annotation deletion from the panel**: Page note items have Edit and Delete buttons (`panel.ts` lines 354-386), but text and element annotation items have no delete capability from the panel. The only way to delete an annotation is to click its highlight on the page and use the popup's Delete button — which is impossible for orphaned annotations (their highlight doesn't exist). Only "Clear All" works, which is too coarse.

The scroll-to-and-pulse functionality (`onAnnotationClick` in `index.ts` lines 57-71) already works for non-orphaned annotations and needs no changes.

## Design Decisions

### Orphan detection: Real-time DOM check at render time

Each annotation item checks for its corresponding DOM highlight when rendered in the panel:
- Text annotations: `getHighlightMarks(id).length === 0` means orphaned
- Element annotations: `getElementByAnnotationId(id) === null` means orphaned

This is done via a callback rather than importing `highlights.ts` directly, keeping the panel as a pure UI module:

```typescript
isAnnotationOrphaned: (annotationId: string, pageUrl: string) => boolean;
```

The `pageUrl` parameter is needed because the "All Pages" tab shows annotations from pages not currently loaded. The callback returns `false` for non-current-page annotations (we cannot determine orphan status without the page's DOM).

### Delete button: New callback in PanelCallbacks

Following the existing page note delete pattern, annotation deletion is handled via a callback:

```typescript
onAnnotationDelete: (annotationId: string) => Promise<void>;
```

The callback in `index.ts` handles: API delete, highlight removal, badge refresh, and panel refresh.

## Implementation

### Session 1: Implementation + Unit Tests

**Files to modify:**

1. **`src/client/ui/panel.ts`** — Add callbacks, delete button, and orphan indicator to annotation items
2. **`src/client/index.ts`** — Wire new callbacks with highlight removal and DOM queries
3. **`src/client/styles.ts`** — Add `.air-annotation-item--orphan` modifier class
4. **`tests/client/ui/panel.test.ts`** — Unit tests for delete button and orphan indicator

### Detailed Changes

#### 1. Panel callbacks (`src/client/ui/panel.ts`)

Extend `PanelCallbacks` (line 24-28):

```typescript
export interface PanelCallbacks {
  onAnnotationClick: (annotationId: string) => void;
  onAnnotationDelete: (annotationId: string) => Promise<void>;
  isAnnotationOrphaned: (annotationId: string, pageUrl: string) => boolean;
  onRefreshBadge: () => Promise<void>;
  onExport: () => Promise<void>;
}
```

#### 2. Text annotation items (`src/client/ui/panel.ts`)

Update `createTextAnnotationItem()` to add orphan indicator and delete button:

```
div.air-annotation-item[data-air-el="annotation-item"]
  div.air-annotation-item__text         — "selected text..."
  div.air-annotation-item__note         — reviewer note (if any)
  div.air-annotation-item__orphan       — "Could not locate on page" (if orphaned)
  div (actions row)
    button[data-air-el="annotation-delete"] — "Delete"
```

- If `callbacks.isAnnotationOrphaned(annotation.id, annotation.pageUrl)` returns `true`:
  - Add `air-annotation-item--orphan` class to the container
  - Append orphan indicator div with class `air-annotation-item__orphan` and text "Could not locate on page"
- Add delete button with `data-air-el="annotation-delete"` (same styling as page note delete)
- Delete button click: `e.stopPropagation()` (prevent triggering scroll-to), then `callbacks.onAnnotationDelete(annotation.id)`

#### 3. Element annotation items (`src/client/ui/panel.ts`)

Same changes as text annotation items in `createElementAnnotationItem()`.

#### 4. Client bootstrap (`src/client/index.ts`)

Add imports for `removeHighlight` and `removeElementHighlight` (line 18):

```typescript
import { pulseHighlight, getHighlightMarks, pulseElementHighlight, getElementByAnnotationId, removeHighlight, removeElementHighlight } from './highlights.js';
```

Wire new callbacks in `createPanel()` call (after line 71):

```typescript
onAnnotationDelete: async (id) => {
  try {
    await api.deleteAnnotation(id);
    removeHighlight(id);
    removeElementHighlight(id);
    await refreshBadge();
    mediator.refreshPanel();
  } catch (err) {
    console.error('[astro-inline-review] Failed to delete annotation:', err);
  }
},
isAnnotationOrphaned: (id, pageUrl) => {
  if (pageUrl !== window.location.pathname) return false;
  const marks = getHighlightMarks(id);
  if (marks.length > 0) return false;
  const element = getElementByAnnotationId(id);
  if (element) return false;
  return true;
},
```

#### 5. Styles (`src/client/styles.ts`)

Add after the existing `.air-annotation-item__orphan` class (line 243):

```css
.air-annotation-item--orphan {
  opacity: 0.7;
  border-left: 3px solid #F87171;
}
```

This gives a visual signal: red left border (matching orphan text colour) and reduced opacity.

#### 6. Unit tests (`tests/client/ui/panel.test.ts`)

Add new test groups alongside the existing export button tests:

**`describe('annotation item — delete button')`**

- Delete button renders with `data-air-el="annotation-delete"` on text annotation items
- Delete button renders on element annotation items
- Clicking delete calls `onAnnotationDelete` with the annotation ID
- Clicking delete does NOT trigger `onAnnotationClick` (stopPropagation works)

**`describe('annotation item — orphan indicator')`**

- Orphan indicator shown when `isAnnotationOrphaned` returns `true`
- Orphan indicator NOT shown when `isAnnotationOrphaned` returns `false`
- Item has `air-annotation-item--orphan` class when orphaned
- Item does NOT have `air-annotation-item--orphan` class when not orphaned

Tests will need to trigger `mediator.refreshPanel()` with a store containing annotations. The mock for `api.getStore` already returns the store — update it to include test annotations.

### What Stays the Same

- **Scroll-to-and-pulse**: `onAnnotationClick` handler in `index.ts` is unchanged
- **Clear All**: Unchanged — still deletes everything with two-click confirmation
- **Page note CRUD**: Unchanged — Edit and Delete buttons still work
- **Export**: Unchanged — all annotations still exported regardless of orphan status
- **Highlight restoration**: Unchanged — three-tier restoration still runs
- **Mediator interface**: Unchanged — `refreshPanel` and `restoreHighlights` signatures stay the same

---

### Session 2: Scenario Tests + Spec Updates

**Files to modify:**

1. **`../astro-inline-review-tests/helpers/selectors.ts`** — Add `annotationDelete` selector
2. **`../astro-inline-review-tests/helpers/actions.ts`** — Add `deleteAnnotationFromPanel`, `seedOrphanAnnotation`
3. **`../astro-inline-review-tests/helpers/assertions.ts`** — Add `expectAnnotationOrphanIndicator`
4. **`../astro-inline-review-tests/tests/14-annotation-dismissal.spec.ts`** — New test file
5. **`docs/spec/specification.md`** — Update sections 6.2.3, 6.2.3a, 8.4, 14.1, Appendix A

### Scenario Tests

New file: `tests/14-annotation-dismissal.spec.ts`

```
test.describe('Annotation dismissal', () => {
  test.beforeEach: cleanReviewData, goto /, clearLocalStorage, waitForIntegration

  // Delete button presence
  test('text annotation item has delete button in panel')
  test('element annotation item has delete button in panel')

  // Delete text annotation
  test('deleting text annotation removes it from panel')
  test('deleting text annotation removes highlight from page')
  test('deleting text annotation updates badge count')
  test('deleted text annotation does not reappear after reload')

  // Delete element annotation
  test('deleting element annotation removes it from panel')
  test('deleting element annotation removes outline from page')

  // Orphan indicator
  test('orphan indicator shown when text cannot be located')
  test('orphan indicator not shown for locatable annotation')

  // Navigate-to still works
  test('clicking non-orphan annotation scrolls to highlight')
  test('clicking orphan annotation does not error')
})
```

**Orphan test approach**: Use `writeReviewJson()` to seed an annotation whose `selectedText` and `range` point to text that doesn't exist on the page. When `restoreHighlights()` runs, all three tiers fail and the annotation appears orphaned:

```typescript
function seedOrphanAnnotation(): void {
  const store = {
    version: 1,
    annotations: [{
      id: 'orphan-test-1',
      type: 'text',
      pageUrl: '/',
      pageTitle: 'Test',
      selectedText: 'text that absolutely does not exist on this page',
      note: 'This should be orphaned',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      range: {
        startXPath: '/html[1]/body[1]/main[1]/p[999]/text()[1]',
        startOffset: 0,
        endXPath: '/html[1]/body[1]/main[1]/p[999]/text()[1]',
        endOffset: 48,
        selectedText: 'text that absolutely does not exist on this page',
        contextBefore: '',
        contextAfter: '',
      },
    }],
    pageNotes: [],
  };
  writeReviewJson(JSON.stringify(store));
}
```

### Helper Updates

**`helpers/selectors.ts`** — add:

```typescript
annotationDelete: '[data-air-el="annotation-delete"]',
```

**`helpers/actions.ts`** — add:

```typescript
export async function deleteAnnotationFromPanel(page: Page, index: number = 0): Promise<void> {
  const deleteBtn = shadowLocator(page, SELECTORS.annotationDelete).nth(index);
  await Promise.all([
    page.waitForResponse(
      (resp) =>
        resp.url().includes('/__inline-review/api/annotations') &&
        resp.request().method() === 'DELETE' &&
        resp.ok(),
    ),
    deleteBtn.click(),
  ]);
}
```

**`helpers/assertions.ts`** — add:

```typescript
export async function expectAnnotationOrphanIndicator(page: Page, count: number): Promise<void> {
  // Orphan indicators are inside the shadow DOM panel
  await expect.poll(async () => {
    return page.evaluate(() => {
      const host = document.getElementById('astro-inline-review-host');
      return host?.shadowRoot?.querySelectorAll('.air-annotation-item__orphan').length ?? 0;
    });
  }).toBe(count);
}
```

### Specification Updates (`docs/spec/specification.md`)

**Section 6.2.3 (Text Annotation Items)** — add after click behaviour:

> **Delete button**: Each text annotation item has a "Delete" button (`data-air-el="annotation-delete"`) that removes the annotation from the store and its highlight from the page. Clicking Delete calls the API to delete the annotation, removes any associated highlight marks, refreshes the badge count, and refreshes the panel.
>
> **Orphan indicator**: If the annotation's text cannot be located on the page (Tier 3 orphan per section 8.4), a red indicator is shown with the text "Could not locate on page" (class `.air-annotation-item__orphan`). The item container receives the `.air-annotation-item--orphan` modifier class, which adds a red left border and reduced opacity. Orphan detection only applies to annotations on the current page — annotations for other pages (shown in the "All Pages" tab) do not show an orphan indicator since their DOM is not available.

**Section 6.2.3a (Element Annotation Items)** — same additions.

**Section 8.4 (Three-Tier, Tier 3)** — update to reference panel behaviour:

> The panel indicates orphaned status with a red indicator ("Could not locate on page") and a visual modifier (red left border, reduced opacity). The annotation can be deleted via its Delete button in the panel.

**Section 14.1 (data-air-el table)** — add row:

| `annotation-delete` | Annotation delete button | Shadow DOM | Present on each annotation item when panel shows annotations |

**Appendix A (Action-Response table)** — add row:

| Click Delete on annotation in panel | Annotation deleted from store, highlight removed, badge updated, panel refreshed | 6.2.3, 6.2.3a |

### Commits

Use conventional commit format. No "Co-Authored-By" or "Generated with Claude Code" lines.

**Session 1 commit:**

```
feat: add annotation delete button and orphan indicator in panel

Reviewers need to verify annotations after a coding agent addresses them.
Two gaps exist: orphaned annotations (whose content changed) look identical
to locatable ones, and individual annotations can't be deleted from the
panel — only "Clear All" works.

Adds a Delete button to each annotation item in the panel (matching the
existing page note Delete pattern) and an orphan indicator that shows
when an annotation's target can't be found on the page.
```

**Session 2 commit (test repo):**

```
test: add scenario tests for annotation dismissal and orphan indicator

Covers the new Delete button on annotation items (text and element),
badge updates after deletion, persistence across reloads, orphan
indicator visibility, and navigate-to behaviour for orphaned items.
```

**Session 2 commit (spec update, this repo):**

```
docs: update spec for annotation delete button and orphan indicator

Adds delete button and orphan indicator to sections 6.2.3, 6.2.3a,
8.4 Tier 3, automation contract table (14.1), and action-response
appendix.
```

### Test Plan

- [ ] Unit test: delete button renders on text annotation items
- [ ] Unit test: delete button renders on element annotation items
- [ ] Unit test: clicking delete calls `onAnnotationDelete` with correct ID
- [ ] Unit test: clicking delete does NOT trigger `onAnnotationClick`
- [ ] Unit test: orphan indicator shown when `isAnnotationOrphaned` returns true
- [ ] Unit test: orphan indicator NOT shown when returns false
- [ ] Unit test: orphan modifier class applied correctly
- [ ] Scenario: delete text annotation removes it from panel
- [ ] Scenario: delete text annotation removes highlight from page
- [ ] Scenario: delete text annotation updates badge count
- [ ] Scenario: deleted annotation does not reappear after reload
- [ ] Scenario: delete element annotation removes outline
- [ ] Scenario: orphan indicator shown for unlocatable text
- [ ] Scenario: orphan indicator not shown for locatable annotation
- [ ] Scenario: click non-orphan annotation scrolls to highlight
- [ ] Scenario: click orphan annotation does not error
- [ ] Build passes (`npm run build`)
- [ ] All unit tests pass (`npm test`)
- [ ] All scenario tests pass (`npx playwright test`)
