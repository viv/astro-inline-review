---
generated_by: Claude Opus 4.6
generation_date: 2026-02-21
model_version: claude-opus-4-6
purpose: specification_review_round_3
status: resolved
reviewed_document: docs/spec/specification.md
prior_reviews:
  - docs/reviews/2026-02-21-spec-review.md (Round 1 - 24 findings, resolved)
  - docs/reviews/2026-02-21-spec-review-round-2.md (Round 2 - 15 findings, resolved)
cross_references:
  - src/ (19 TypeScript source files)
  - /Users/matthewvivian/Documents/code/cpd/review-loop-tests/ (acceptance test suite)
tags: [review, specification, quality, accuracy, ai-agent-readability, round-3]
---

# Specification Review Round 3: review-loop

**Reviewed**: `docs/spec/specification.md` (1,461 lines, 19 sections + 2 appendices)
**Review date**: 2026-02-21
**Reviewer**: Claude Opus 4.6 (independent third review)
**Prior reviews**: Round 1 (24 findings, all resolved), Round 2 (15 findings, resolved)
**Purpose**: Fresh, independent deep review focused on source-code accuracy — cross-referencing every normative claim in the spec against the actual implementation.

## Review Dimensions

1. **Source Code Accuracy** — Does the spec match the code? (Primary focus for this round)
2. **Completeness** — Missing behaviours, edge cases, or interactions
3. **Consistency** — Internal contradictions between sections
4. **Precision & Ambiguity** — Statements open to multiple interpretations
5. **Agent-Readability** — Structure and navigability for AI coding agents
6. **Previous Review Resolution** — Have Round 1 and Round 2 findings been addressed?

## Summary

| Severity | Count | Description |
|----------|-------|-------------|
| Critical | 2 | Spec directly contradicts the code — would cause incorrect implementation |
| Major | 6 | Significant discrepancies or missing details that could cause bugs |
| Minor | 5 | Inaccuracies, missing details, or stale text |
| Suggestion | 2 | Improvements for clarity |
| **Total** | **15** | |

**Overall verdict**: The specification has improved substantially through two rounds of review. The new sections (inter-component communication, field mutability, accessibility scope, automation contract lifecycle) are valuable additions. However, this round's primary focus — cross-referencing normative claims against source code — reveals that **the code has evolved since the spec was last updated**. Several code changes (PATCH field allowlisting, highlight opacity values, inspector overlay colours, event listener registration) are not reflected in the spec. The two critical findings (SPEC3-001 and SPEC3-002) would cause an agent implementing from the spec to produce code that diverges from the actual implementation. The major findings mostly involve the element annotation feature, where spec descriptions don't match the code's actual behaviour.

---

## Critical Findings

### SPEC3-001: PATCH field mutability table contradicts code — only `note` is mutable

- **Severity**: Critical
- **Category**: Source Code Accuracy
- **Spec section**: 4.2.1 (Field mutability on PATCH)
- **Source file**: `src/server/middleware.ts` lines 90–94

**Finding**:

Section 4.2.1 contains a field mutability table that says multiple fields are mutable via PATCH:

| Field | Mutable? | Spec says |
|-------|----------|-----------|
| `pageUrl` | Yes | Allows moving annotation to different page |
| `pageTitle` | Yes | |
| `selectedText` | Yes | Not typically changed by the client |
| `note` | Yes | Primary use case for PATCH |
| `range` | Yes | Not typically changed by the client |
| `createdAt` | Yes* | *Not protected |

The actual code uses an **allowlist pattern** that only permits `note` to be updated:

```typescript
// middleware.ts lines 90–94
store.annotations[idx] = {
  ...store.annotations[idx],
  note: body.note ?? store.annotations[idx].note, // Allowlist: only 'note' is mutable
  updatedAt: new Date().toISOString(),
};
```

The same pattern is used for page note PATCH (lines 142–146):

```typescript
store.pageNotes[idx] = {
  ...store.pageNotes[idx],
  note: body.note ?? store.pageNotes[idx].note, // Allowlist: only 'note' is mutable
  updatedAt: new Date().toISOString(),
};
```

The code was tightened since Round 1 (which noted the spread-all pattern `{ ...existing, ...body, id: existing.id }`). The spec's table was written to describe the old behaviour and was never updated to reflect the new allowlist pattern.

**Impact**: An agent implementing the PATCH endpoint from the spec would use the spread-all pattern, allowing callers to overwrite `pageUrl`, `selectedText`, `range`, and `createdAt` — which the actual code prevents.

**Recommendation**:

Update the table in Section 4.2.1:

| Field | Mutable via PATCH? | Notes |
|-------|-------------------|-------|
| `id` | No | Server-enforced, always preserved |
| `pageUrl` | No | Preserved from original |
| `pageTitle` | No | Preserved from original |
| `selectedText` | No | Preserved from original |
| `note` | **Yes** | Only mutable field — primary use case |
| `range` | No | Preserved from original |
| `elementSelector` | No | Preserved from original |
| `createdAt` | No | Preserved from original |
| `updatedAt` | No | Server-generated on every PATCH |

Add a note: "The server uses an allowlist pattern — only `note` from the request body is applied; all other fields in the request body are ignored."

---

### SPEC3-002: Element highlight outline opacity — spec says 0.7, code uses 0.8

- **Severity**: Critical
- **Category**: Source Code Accuracy
- **Spec sections**: 8.5.1, 8.5.3, 17.1 (Colour Palette)
- **Source file**: `src/client/highlights.ts` lines 109, 136

**Finding**:

The spec consistently states element highlights use `rgba(217,119,6,0.7)`:

- Section 8.5.1: `outline: 2px dashed rgba(217,119,6,0.7);`
- Section 8.5.3 step 4: "revert to `rgba(217,119,6,0.7)` (normal)"
- Section 17.1: "Element highlight outline | `rgba(217,119,6,0.7)`"

The code uses `0.8`:

```typescript
// highlights.ts line 109 — apply element highlight
el.style.outline = '2px dashed rgba(217,119,6,0.8)';

// highlights.ts line 136 — pulse revert
el.style.outlineColor = 'rgba(217,119,6,0.8)';
```

**Impact**: An agent implementing from the spec would use 0.7 opacity, producing visibly different highlights from the actual product.

**Recommendation**:

Update all three sections to use `0.8`:

- Section 8.5.1: `outline: 2px dashed rgba(217,119,6,0.8);`
- Section 8.5.3: "revert to `rgba(217,119,6,0.8)` (normal)"
- Section 17.1: "Element highlight outline | `rgba(217,119,6,0.8)` | Dashed amber outline on annotated elements"

Also update Section 8.5.3 pulse value — the spec says `rgba(217,119,6,1.0)` and the code uses `rgba(217,119,6,1)` — these are equivalent but worth aligning for consistency.

---

## Major Findings

### SPEC3-003: Inspector overlay colours don't match code

- **Severity**: Major
- **Category**: Source Code Accuracy
- **Spec sections**: 6.5 (Inspector Overlay), 17.1 (Colour Palette)
- **Source file**: `src/client/annotator.ts` lines 187–208

**Finding**:

The spec uses one family of blue (`#3B82F6` / `rgb(59,130,246)`) consistently:

| Spec reference | Spec value |
|----------------|------------|
| Section 6.5 overlay background | `rgba(59, 130, 246, 0.15)` |
| Section 6.5 overlay border | `2px solid #3B82F6` |
| Section 17.1 Inspector overlay background | `rgba(59,130,246,0.15)` |
| Section 17.1 Inspector overlay border | `#3B82F6` |
| Section 17.1 Inspector label background | `#3B82F6` |

The code uses a different blue (`rgb(66,133,244)` — Google Blue) with varying opacities:

```typescript
// annotator.ts lines 187–188
'background: rgba(66, 133, 244, 0.15)',   // Different RGB values
'border: 2px solid rgba(66, 133, 244, 0.6)', // Not solid #3B82F6 — it's an rgba at 0.6 opacity

// annotator.ts line 200
'background: rgba(66, 133, 244, 0.9)',     // Label background — not solid either
```

Three discrepancies:
1. **RGB values**: Spec says `(59, 130, 246)`, code uses `(66, 133, 244)` — visibly different blues
2. **Border**: Spec says "solid `#3B82F6`", code uses `rgba(66, 133, 244, 0.6)` — semi-transparent
3. **Label background**: Spec says `#3B82F6`, code uses `rgba(66, 133, 244, 0.9)` — slightly transparent

**Recommendation**:

Update all inspector colour references in Sections 6.5 and 17.1 to match the actual code values:

| Token | Correct Value |
|-------|---------------|
| Inspector overlay background | `rgba(66, 133, 244, 0.15)` |
| Inspector overlay border | `2px solid rgba(66, 133, 244, 0.6)` |
| Inspector label background | `rgba(66, 133, 244, 0.9)` |
| Inspector label text | `white` (this is correct) |

---

### SPEC3-004: Element resolution (resolveElement) does not verify CSS selector uniqueness

- **Severity**: Major
- **Category**: Source Code Accuracy
- **Spec section**: 3.4.4 (Element Resolution — Three-Tier)
- **Source file**: `src/client/element-selector.ts` lines 38–55

**Finding**:

Section 3.4.4 says:

> **Tier 1 — CSS Selector** (primary):
> - `document.querySelector(cssSelector)` — fast and usually stable
> - Verify it returns exactly one element: `document.querySelectorAll(cssSelector).length === 1`
> - If multiple matches, fall through to Tier 2

The code does no uniqueness verification:

```typescript
export function resolveElement(selector: ElementSelector): Element | null {
  // Tier 1: CSS selector
  try {
    const el = document.querySelector(selector.cssSelector);
    if (el) return el;       // Returns first match — no uniqueness check!
  } catch {
    // Invalid selector — fall through
  }

  // Tier 2: XPath
  const node = resolveXPath(selector.xpath);
  if (node && node.nodeType === Node.ELEMENT_NODE) {
    return node as Element;
  }

  // Tier 3: Orphaned
  return null;
}
```

`querySelector` returns the first match regardless of how many elements match the selector. If the CSS selector matches 5 elements, the code returns the first one rather than falling through to XPath. The spec's claimed uniqueness verification (via `querySelectorAll().length === 1`) does not exist.

Note: the CSS selector **generation** function (`generateCssSelector`) does verify uniqueness (via the `isUnique` helper). But the **resolution** function does not re-verify at resolution time, which means if the page DOM has changed since annotation creation, a formerly-unique selector could now match multiple elements, and the code would silently return the first.

**Recommendation**:

Update Section 3.4.4 Tier 1 to match the code:

> **Tier 1 — CSS Selector** (primary):
> - `document.querySelector(cssSelector)` — returns the first matching element
> - If the selector matches any element, it is used (no uniqueness re-verification at resolution time)
> - Note: uniqueness is verified at *generation* time but not re-checked at *resolution* time. If the DOM has changed, a formerly-unique selector may match multiple elements, and the first is used.

---

### SPEC3-005: Captured attributes are unconditional — spec says they are tag-conditional

- **Severity**: Major
- **Category**: Source Code Accuracy
- **Spec section**: 3.4.2 (Captured Attributes)
- **Source file**: `src/client/element-selector.ts` lines 18, 200–209

**Finding**:

Section 3.4.2 has a table with conditional capture rules:

| Attribute | Spec says: Captured if present |
|-----------|-------------------------------|
| `src` | On `img`, `video`, `audio`, `source`, `iframe` |
| `alt` | On `img` |
| `href` | On `a`, `link` |
| `type` | On `input`, `button` |
| `name` | On `input`, `select`, `textarea` |

The actual code captures ALL attributes unconditionally on any element:

```typescript
const CAPTURED_ATTRS = ['id', 'class', 'data-testid', 'src', 'alt', 'href', 'role', 'aria-label', 'type', 'name'] as const;

function captureAttributes(element: Element): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const attr of CAPTURED_ATTRS) {
    const val = element.getAttribute(attr);
    if (val !== null) {
      attrs[attr] = val;  // Captured on ANY element that has it
    }
  }
  return attrs;
}
```

There is no tag-based conditional logic. If a `<div>` has a `src` attribute, it will be captured. If a `<p>` has an `alt` attribute, it will be captured.

**Recommendation**:

Simplify Section 3.4.2 to match the code:

> The `attributes` record captures a snapshot of key attributes for display and future matching. The following attributes are captured **if present on the element** (regardless of tag name):
>
> `id`, `class`, `data-testid`, `src`, `alt`, `href`, `role`, `aria-label`, `type`, `name`
>
> Other attributes are not captured. The set is intentionally small to keep the stored data concise.

---

### SPEC3-006: Element description format does not match spec examples

- **Severity**: Major
- **Category**: Source Code Accuracy
- **Spec section**: 3.4.3 (Human-Readable Description)
- **Source file**: `src/client/element-selector.ts` lines 166–193

**Finding**:

Section 3.4.3 says descriptions are formatted as `tagName (attr1=value1, attr2=value2)` and gives examples:

- `img (class=hero-image, src=hero.jpg, alt=Hero banner)`
- `section (id=expertise, class=py-20)`

The actual code builds descriptions differently. The base includes `id` or first class name, and the parenthetical part explicitly **excludes** `id` and `class`:

```typescript
function generateDescription(element: Element): string {
  const tag = element.tagName.toLowerCase();
  let base = tag;

  if (element.id) {
    base = `${tag}#${element.id}`;           // ID goes in the base
  } else if (element.classList.length > 0) {
    base = `${tag}.${element.classList[0]}`;  // First class goes in the base
  }

  const displayAttrs: string[] = [];
  for (const attr of CAPTURED_ATTRS) {
    if (attr === 'id' || attr === 'class') continue;  // SKIP id and class
    // ...
  }

  if (displayAttrs.length > 0) {
    return `${base} (${displayAttrs.join(', ')})`;
  }
  return base;
}
```

This means the actual outputs would be:
- An `<img class="hero-image" src="hero.jpg" alt="Hero banner">` produces:
  `img.hero-image (src=hero.jpg, alt=Hero banner)` — class in base, not in parens
- A `<section id="expertise" class="py-20">` produces:
  `section#expertise` — id in base, class excluded from parens, nothing else to show
- A `<div data-testid="card-container">` produces:
  `div (data-testid=card-container)` — this one matches the spec

The spec examples show `id` and `class` inside the parentheses, but the code puts them in the base using CSS-selector notation (`#id` / `.class`).

Also, the code truncates long attribute values at 40 characters (line 183: `val.length > 40 ? val.slice(0, 37) + '...'`), which is not mentioned in the spec.

**Recommendation**:

Rewrite Section 3.4.3:

> The `description` field is formatted as:
>
> ```
> base (attr1=value1, attr2=value2)
> ```
>
> Where `base` is:
> - `tag#id` if the element has an `id`
> - `tag.firstClassName` if the element has classes (uses only the first class)
> - `tag` if neither
>
> The parenthetical part lists captured attributes **excluding `id` and `class`** (which are already represented in the base). Attribute values longer than 40 characters are truncated with `...`.
>
> Examples:
> - `img.hero-image (src=hero.jpg, alt=Hero banner)`
> - `section#expertise` (no attributes beyond id)
> - `button.btn-primary (type=submit)`
> - `div (data-testid=card-container)`
> - If no attributes are present beyond id/class: just the base, e.g. `div`

---

### SPEC3-007: Inspector event listeners are always attached, not dynamically

- **Severity**: Major
- **Category**: Source Code Accuracy
- **Spec section**: 6.5 (Inspector Overlay — Implementation notes)
- **Source file**: `src/client/annotator.ts` lines 552–557

**Finding**:

Section 6.5 states:

> Inspector mode listeners (`mousemove`, `keyup`) are only attached while Alt is held (attached on `keydown`, removed on `keyup` or click)

The code registers ALL listeners once during annotator creation and never removes them:

```typescript
// annotator.ts lines 552–557 — all registered once at creation time
document.addEventListener('mouseup', onMouseUp);
document.addEventListener('scroll', onScroll, { passive: true });
document.addEventListener('keydown', onKeyDown);
document.addEventListener('keyup', onKeyUp);
document.addEventListener('mousemove', onMouseMove);
document.addEventListener('click', onClickCapture, true);
```

The `onMouseMove` handler has an early-return guard:
```typescript
function onMouseMove(e: MouseEvent): void {
  if (!inspectorActive) return;  // No-op when Alt is not held
  // ...
}
```

Similarly `onKeyUp` checks `e.key !== 'Alt'` and returns.

The listeners are always active on `document` — they just short-circuit when not in inspector mode. This is a valid implementation choice (avoids attach/detach overhead) but the spec's claim about dynamic attachment is incorrect.

**Recommendation**:

Update the implementation notes in Section 6.5:

> - All inspector-related event listeners (`keydown`, `keyup`, `mousemove`, `click`) are registered once during annotator creation and remain attached for the page lifetime
> - The `mousemove` handler short-circuits with an early return when `inspectorActive` is `false`
> - The `keyup` handler only acts when `e.key === 'Alt'`
> - The `click` capture handler only acts when `e.altKey` is `true`
> - This avoids the overhead of dynamic listener attachment/detachment on every Alt key press

---

### SPEC3-008: `__restoreHighlights` shadow root bridge function not documented

- **Severity**: Major
- **Category**: Completeness
- **Spec section**: 5.6.2 (Shadow Root Bridge)
- **Source files**: `src/client/annotator.ts` line 533, `src/client/ui/panel.ts` lines 514–516

**Finding**:

Section 5.6.2 documents two shadow root bridge functions:

| Property | Set by | Used by | Purpose |
|----------|--------|---------|---------|
| `__refreshPanel()` | Panel | Panel note CRUD, Clear All | Re-render panel content |
| `__scrollToAnnotation(id)` | Annotator | Panel annotation click | Scroll to highlight |

There is a third bridge function that is not documented:

```typescript
// annotator.ts line 533
(shadowRoot as any).__restoreHighlights = restoreHighlights;
```

This is used by the Clear All handler:
```typescript
// panel.ts lines 514–516
const restoreFn = (shadowRoot as any).__restoreHighlights;
if (restoreFn) await restoreFn();
```

**Recommendation**:

Add to the Section 5.6.2 table:

| Property | Set by | Used by | Purpose |
|----------|--------|---------|---------|
| `__restoreHighlights()` | Annotator (`createAnnotator`) | Clear All | Remove all DOM highlights and re-apply from store |

Also update Section 5.6.3 (Dependency Graph):

```
Clear All → call __restoreHighlights (via shadowRoot bridge) → clean up marks/outlines
```

---

## Minor Findings

### SPEC3-009: First-use tooltip text doesn't match code

- **Severity**: Minor
- **Category**: Source Code Accuracy
- **Spec section**: 19.2 (First-Use Tooltip)
- **Source file**: `src/client/index.ts` line 78

**Finding**:

Section 19.2 says:
> Tooltip text: "Select text or Alt+click any element to annotate"

The code:
```typescript
tooltip.textContent = 'Select text to annotate it, or Alt+click any element';
```

Different word order and phrasing.

**Recommendation**: Update Section 19.2 to match: `"Select text to annotate it, or Alt+click any element"`

---

### SPEC3-010: Export does not truncate outerHtmlPreview to 100 characters

- **Severity**: Minor
- **Category**: Source Code Accuracy
- **Spec section**: 9.2.1 (Element Annotation Export Format)
- **Source files**: `src/server/middleware.ts` line 288, `src/client/export.ts` line 79

**Finding**:

Section 9.2.1 says:
> Outer HTML preview (truncated to 100 chars) in parentheses and backticks

Neither the server nor client export code truncates the preview:

```typescript
// Both middleware.ts and export.ts use the same line:
lines.push(`${i}. **\`${a.elementSelector.cssSelector}\`** (\`${a.elementSelector.outerHtmlPreview}\`)`);
```

The `outerHtmlPreview` field is stored as up to 200 characters (set during element selector generation in `element-selector.ts` line 30: `element.outerHTML.slice(0, 200)`). The export outputs whatever is stored, up to 200 chars, not 100.

**Recommendation**: Either:
1. Update the spec to say "up to 200 characters" (matching the stored field length), or
2. Add truncation to the export code (`.slice(0, 100)`) and keep the spec as-is

Option 1 is simpler and accurate: update Section 9.2.1 to say `outerHtmlPreview` (up to 200 chars, as stored).

---

### SPEC3-011: Appendix A test scenario count still says 110

- **Severity**: Minor
- **Category**: Accuracy
- **Spec section**: Appendix A (opening line)
- **Prior finding**: SPEC2-015 (Round 2 — flagged as suggestion, not resolved)

**Finding**:

Appendix A opens with:
> ...in the acceptance test suite (110 scenarios across 12 spec files)

This was flagged in Round 2 as incorrect (actual count ~102). The text was not updated.

**Recommendation**: Update to either the correct count or remove the specific number: "the acceptance test suite (12 spec files)".

---

### SPEC3-012: Element annotation click detection walks ancestors — not documented

- **Severity**: Minor
- **Category**: Completeness
- **Spec section**: 7.6 (Editing an Element Annotation)
- **Source file**: `src/client/annotator.ts` lines 91–95, 434–441

**Finding**:

Section 7.6 says:
> 1. User clicks an element that has a `data-air-element-id` attribute

The code uses a `findAnnotatedAncestor` helper that walks **up the DOM tree** from the click target:

```typescript
function findAnnotatedAncestor(el: HTMLElement): HTMLElement | null {
  let current: HTMLElement | null = el;
  while (current && current !== document.body && current !== document.documentElement) {
    if (current.hasAttribute(ELEMENT_HIGHLIGHT_ATTR)) return current;
    current = current.parentElement;
  }
  return null;
}
```

This means clicking a **child** of an annotated element also triggers the edit popup. For example, if a `<section data-air-element-id="x">` contains a `<p>`, clicking the `<p>` opens the edit popup for the section annotation.

This is a useful behaviour that contrasts with text highlight click detection (which only checks the direct target — see SPEC2-006 from Round 2). The difference is worth documenting.

**Recommendation**:

Update Section 7.6 step 1:

> 1. User clicks an element that has a `data-air-element-id` attribute, **or any descendant of such an element**. The annotator walks up the DOM tree from the click target to find the closest ancestor with the attribute. This means clicking a child element (e.g. text inside an annotated section) triggers the edit popup for the parent annotation.

---

### SPEC3-013: Clear All highlight cleanup description is outdated

- **Severity**: Minor
- **Category**: Source Code Accuracy
- **Spec section**: 6.2.5 (Clear All — Highlight cleanup)
- **Source file**: `src/client/ui/panel.ts` lines 513–520

**Finding**:

Section 6.2.5 says:
> **Highlight cleanup**: Light DOM `<mark>` elements are not removed during the Clear All operation itself. They are removed on the next call to `restoreHighlights()`...

The code now explicitly calls `__restoreHighlights` during Clear All:

```typescript
// panel.ts lines 513–520
// Clean up DOM highlights (text marks + element outlines)
const shadowRoot = clearBtn.getRootNode() as ShadowRoot;
const restoreFn = (shadowRoot as any).__restoreHighlights;
if (restoreFn) await restoreFn();

// Refresh panel content
const refreshFn = (shadowRoot as any).__refreshPanel;
if (refreshFn) refreshFn();
```

Marks ARE removed during the Clear All operation itself, not lazily on the next restore cycle.

**Recommendation**:

Update the highlight cleanup paragraph in Section 6.2.5:

> **Highlight cleanup**: After all individual deletions complete, the Clear All handler explicitly calls `restoreHighlights()` (via the `__restoreHighlights` shadow root bridge). This clears all existing text marks and element outlines from the DOM. The empty store means no highlights are re-applied, leaving the page clean.

---

## Suggestions

### SPEC3-014: Document the `onAnnotationClick` callback duplication

- **Severity**: Suggestion
- **Category**: Completeness
- **Spec sections**: 5.6.1, 5.6.2
- **Source files**: `src/client/index.ts` lines 49–63, `src/client/annotator.ts` lines 514–529

**Finding**:

The spec (Section 5.6.2) says `__scrollToAnnotation` on the shadow root is "Used by: Panel annotation click". However, the actual `onAnnotationClick` callback in `index.ts` lines 49–63 does NOT use `__scrollToAnnotation`. Instead, it directly imports and calls `getHighlightMarks`, `pulseHighlight`, `getElementByAnnotationId`, and `pulseElementHighlight`.

The `__scrollToAnnotation` bridge function has identical logic in `annotator.ts` lines 514–529. Both exist — the bridge function and the inline callback — and both do the same thing.

**Recommendation**:

Add a note to Section 5.6.2:

> **Note**: The `onAnnotationClick` callback wired during bootstrap contains scroll-to logic inline (via directly imported highlight functions) rather than calling `__scrollToAnnotation`. The bridge function exists as a redundant alternative path. Both produce identical behaviour.

---

### SPEC3-015: Destroy method event listener list is incomplete

- **Severity**: Suggestion
- **Category**: Completeness
- **Spec section**: 5.1 (Bootstrap Sequence — Notes)
- **Source file**: `src/client/annotator.ts` lines 561–569

**Finding**:

Section 5.1 says:
> The annotator also exposes a `destroy()` method that removes event listeners (`mouseup`, `scroll`, `keydown`, `click` for Alt+click detection).

The code removes six listeners plus calls `destroyInspector()`:

```typescript
function destroy(): void {
  document.removeEventListener('mouseup', onMouseUp);
  document.removeEventListener('scroll', onScroll);
  document.removeEventListener('keydown', onKeyDown);
  document.removeEventListener('keyup', onKeyUp);        // Missing from spec
  document.removeEventListener('mousemove', onMouseMove); // Missing from spec
  document.removeEventListener('click', onClickCapture, true);
  destroyInspector();                                      // Missing from spec
}
```

Missing from spec: `keyup`, `mousemove`, and `destroyInspector()` call.

**Recommendation**: Update to: "removes event listeners (`mouseup`, `scroll`, `keydown`, `keyup`, `mousemove`, `click` for Alt+click detection) and destroys any active inspector overlay."

---

## Resolution Priority

### Phase 1 — Critical (must fix)
1. **SPEC3-001**: Fix PATCH mutability table (only `note` is mutable)
2. **SPEC3-002**: Fix element highlight opacity values (0.7 → 0.8)

### Phase 2 — Major (should fix to prevent implementation divergence)
3. **SPEC3-003**: Fix inspector overlay colour values
4. **SPEC3-004**: Fix element resolution uniqueness claim
5. **SPEC3-005**: Simplify captured attributes (remove tag-conditional rules)
6. **SPEC3-006**: Fix element description format and examples
7. **SPEC3-007**: Fix inspector event listener registration description
8. **SPEC3-008**: Add `__restoreHighlights` to shadow root bridge table

### Phase 3 — Minor (improve accuracy)
9. **SPEC3-009**: Fix tooltip text
10. **SPEC3-010**: Fix export outerHtmlPreview truncation claim
11. **SPEC3-011**: Fix test scenario count
12. **SPEC3-012**: Document ancestor traversal for element click detection
13. **SPEC3-013**: Update Clear All highlight cleanup description

### Phase 4 — Suggestions
14. **SPEC3-014**: Note onAnnotationClick duplication
15. **SPEC3-015**: Complete destroy() listener list

---

## Assessment of Prior Review Resolution

### Round 1 (24 findings)

All 24 findings from Round 1 have been addressed in the spec. The additions are well-integrated:

- **SPEC-001** (API response asymmetry): Section 4.2.1 now has clear "Filter behaviour" callout and response examples. Well done.
- **SPEC-002** (Escape key): Section 10.4 rewritten with normative statements and "Known Technical Debt" subsection.
- **SPEC-003** (GET /page-notes): Section 4.2.2 now has "Client usage" note and Section 5.5 lists endpoints.
- **SPEC-006** (Inter-component communication): New Section 5.6 with callback table, bridge functions, and dependency graph. Excellent addition.
- **SPEC-009** (data-air-pulse): Added to Section 14.3 and implemented in code.
- **SPEC-019** (Action-Response table): Appendix B added with comprehensive mapping.
- All other findings resolved appropriately.

### Round 2 (15 findings)

14 of 15 findings have been addressed:

- **SPEC2-001** through **SPEC2-014**: All resolved or adequately addressed.
- **SPEC2-015** (test scenario count): **NOT resolved** — Appendix A still says "110 scenarios". Carried forward as SPEC3-011.

### New Issues Since Round 2

Several findings in this round (SPEC3-001, SPEC3-002, SPEC3-008, SPEC3-013) reflect code changes that were made **after** the spec was last updated. This is the normal drift between spec and code during active development. The most impactful is SPEC3-001 (PATCH allowlisting), which represents a deliberate code improvement that was never reflected back into the spec.

---

*Review complete. 15 findings across 4 severity levels. The specification is mature and well-structured — the remaining issues are primarily code-vs-spec drift from ongoing development.*
