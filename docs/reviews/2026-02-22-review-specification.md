# Specification Review — 2026-02-22

**Reviewer**: spec-reviewer agent
**Document**: `docs/spec/specification.md`
**Scope**: Completeness, accuracy, clarity, consistency, and coverage gaps
**Method**: Line-by-line comparison of specification against implementation source code

---

## Executive Summary

The specification is comprehensive and well-structured, covering the full system from data model through client architecture to automation contracts. However, comparison against the current implementation reveals **several accuracy issues** (the data model section doesn't match the actual type definitions), **missing documentation** for recently-added features (resolved annotation styling, new data attributes), and **a maintenance risk** from duplicated export logic. Most issues are Medium severity — the spec is usable as-is but could mislead an implementer on specific details.

**Findings by severity:**
- Critical: 0
- High: 3
- Medium: 8
- Low: 6
- Info: 4

---

## Findings

### HIGH-1: BaseAnnotation `type` field mismatch between spec and code

**Severity**: High
**Section**: 3.2.1 (BaseAnnotation)
**Files**: `src/shared/types.ts:15-25`, spec lines 98-107

The spec shows `BaseAnnotation` **without** a `type` field — the `type` discriminant is only shown on `TextAnnotation` and `ElementAnnotation`. However, the actual implementation has `type: 'text' | 'element'` directly on `BaseAnnotation`:

```typescript
// Code (types.ts:16)
export interface BaseAnnotation {
  id: string;
  type: 'text' | 'element';  // <-- present in code
  // ...
}
```

```typescript
// Spec (section 3.2.1) - type field NOT shown on BaseAnnotation
interface BaseAnnotation {
  id: string;           // Server-generated unique ID
  pageUrl: string;      // window.location.pathname at creation time
  // ... (no type field)
}
```

**Impact**: A developer implementing from the spec would place `type` only on the subtypes, creating a different interface hierarchy. The code puts it on the base so that any `Annotation` object always has `type` accessible without narrowing.

**Recommendation**: Update spec section 3.2.1 to include `type: 'text' | 'element'` in `BaseAnnotation`, matching the actual TypeScript definition.

---

### HIGH-2: ReviewMediator `refreshPanel` return type mismatch

**Severity**: High
**Section**: 5.6.2 (Typed Mediator)
**Files**: `src/client/mediator.ts:7-10`, spec line 598

The spec shows:
```typescript
interface ReviewMediator {
  refreshPanel: () => void;
  restoreHighlights: () => Promise<void>;
}
```

The actual code has:
```typescript
interface ReviewMediator {
  refreshPanel: () => Promise<void>;  // <-- async, not void
  restoreHighlights: () => Promise<void>;
}
```

**Impact**: The `addPageNote` shortcut handler in `src/client/index.ts:166` explicitly `await`s `panel.mediator.refreshPanel()`, which only works because the real signature returns `Promise<void>`. A developer implementing from the spec would make `refreshPanel` synchronous, breaking the await.

**Recommendation**: Update the spec to show `refreshPanel: () => Promise<void>`.

---

### HIGH-3: Element annotation panel display — spec says CSS selector, code shows description

**Severity**: High
**Section**: 6.2.3a (Element Annotation Items)
**Files**: `src/client/ui/panel.ts:372-375`, spec lines 747-748

The spec says element annotation items show:
> "**Element description** in yellow (`#FCD34D`), showing the CSS selector in monospace (e.g. `section.hero > img.hero-image`)"

But the code displays `annotation.elementSelector.description` (the human-readable description, e.g. `img.hero-image (src=hero.jpg, alt=Hero banner)`), not the `cssSelector` field:

```typescript
// panel.ts:374
desc.textContent = annotation.elementSelector.description;
```

**Impact**: The spec and implementation disagree on what text appears in the panel for element annotations. The CSS selector vs description distinction matters for user comprehension.

**Recommendation**: Update the spec to match the code — it shows `description`, not `cssSelector`.

---

### MEDIUM-1: Contradictory FAB badge count description

**Severity**: Medium
**Section**: 6.1 vs 6.2.1
**Files**: `src/client/annotator.ts:501`

Section 6.1 says the badge:
> "Shows the count of **all annotations** (text + element, not page notes)"

Section 6.2.1 says:
> "This differs from the FAB badge, which counts only text annotations."

These two statements contradict each other. The code counts all annotations (text + element):
```typescript
// annotator.ts:501
updateBadge(badge, pageAnnotations.length);
// pageAnnotations includes both text and element
```

**Recommendation**: Fix section 6.2.1 to say "which counts all annotations (text + element, not page notes)" to match section 6.1 and the code.

---

### MEDIUM-2: Resolved annotation highlight styling not documented

**Severity**: Medium
**Section**: 8.1, 8.5.1 (Highlight styling)
**Files**: `src/client/highlights.ts:11-12, 107-112`

The spec documents amber highlights for active annotations but doesn't mention the distinct green styling for resolved annotations:

```typescript
// highlights.ts:11
const RESOLVED_HIGHLIGHT_STYLE = 'background-color: rgba(34,197,94,0.2); border-radius: 2px; cursor: pointer;';

// highlights.ts:110-112
el.style.outline = resolved
  ? '2px dashed rgba(34,197,94,0.5)'
  : '2px dashed rgba(217,119,6,0.8)';
```

Resolved text annotations get green backgrounds; resolved element annotations get green dashed outlines. Neither is documented in the spec or colour palette (section 17.1).

**Recommendation**: Add resolved highlight colours to sections 8.1, 8.5.1, and the colour palette table (17.1).

---

### MEDIUM-3: Missing `data-air-el` values from automation contract

**Severity**: Medium
**Section**: 14.1 (Element Identification)
**Files**: `src/client/ui/panel.ts:105, 302, 366, 630, 644`, `src/client/index.ts:109`

Several `data-air-el` values exist in the code but are not listed in the automation contract table:

| Missing Value | Element | File:Line |
|---|---|---|
| `panel-content` | Panel content area | `panel.ts:105` |
| `resolved-badge` | Resolved status badge | `panel.ts:631` |
| `agent-reply` | Agent reply block | `panel.ts:644` |
| `first-use-tooltip` | First-use tooltip | `index.ts:109` |
| `empty-arrow` | Empty state arrow | `panel.ts:240` |

The tooltip and arrow are mentioned in sections 19.2 and 19.3 respectively, but not in the consolidated automation contract table.

**Recommendation**: Add all five to the automation contract table (section 14.1) for complete coverage.

---

### MEDIUM-4: Request body size limit undocumented

**Severity**: Medium
**Section**: 4.2.4 (Error Handling)
**Files**: `src/server/middleware.ts:202, 177-178`

The middleware enforces a 1MB body size limit:
```typescript
const MAX_BODY_SIZE = 1_048_576; // 1 MB
```

And returns a 413 status code when exceeded:
```typescript
if (err instanceof Error && err.message === 'Request body too large') {
  return sendError(res, 413, 'Request body too large');
}
```

Neither the size limit nor the 413 status code is documented in the spec's error handling section (4.2.4).

**Recommendation**: Add a row for 413 in section 4.2.4 and document the 1MB body size limit.

---

### MEDIUM-5: Dual export implementations — maintenance risk

**Severity**: Medium
**Section**: 9.1 (Export Format)
**Files**: `src/shared/export.ts`, `src/client/export.ts`

The spec says "Both the server (GET /export) and client generate identical Markdown" but doesn't acknowledge that this is maintained via **two separate implementations**:

- Server/MCP: `src/shared/export.ts` → `generateExport()`
- Client: `src/client/export.ts` → `generateExportMarkdown()`

Both files are ~100 lines of near-identical logic. The client version exists because the browser bundle has different import paths. Currently they're in sync, but any future change must be applied to both files.

**Recommendation**: Document this dual-implementation fact and the synchronisation requirement, or consider refactoring to share a single implementation.

---

### MEDIUM-6: `addPageNote` shortcut bypasses normal panel opening

**Severity**: Medium
**Section**: 10.1 (Shortcut Map), 11.2 (CRUD Operations)
**Files**: `src/client/index.ts:158-169`

The spec says `Cmd/Ctrl+Shift+N` "Opens panel if closed, displays add-note form". The implementation directly manipulates panel CSS classes instead of using `togglePanel()`:

```typescript
// index.ts:163-167
if (!isPanelOpen(panel)) {
  panel.container.classList.add('air-panel--open');
  panel.container.setAttribute('data-air-state', 'open');
  await panel.mediator.refreshPanel();
}
```

This bypasses FAB icon synchronisation — the panel opens but the FAB still shows the clipboard icon rather than the X icon. This is a known behaviour gap worth documenting.

**Recommendation**: Document this FAB desync as known behaviour in the shortcut description, or note it as technical debt.

---

### MEDIUM-7: Client export doesn't use server endpoint

**Severity**: Medium
**Section**: 9.3 (Clipboard Export)
**Files**: `src/client/index.ts:92-95, 153-156`

The spec's section 5.5 lists `GET /export` as an endpoint used by the client. But examining the actual code, neither the "Copy All" button nor the shortcut uses the server's `/export` endpoint:

```typescript
// index.ts:92-95 (Copy All button)
onExport: async () => {
  const store = await api.getStore();
  const success = await exportToClipboard(store);
  // ...
}
```

Both paths fetch the raw store via `GET /annotations` and generate markdown client-side using `generateExportMarkdown()`. The `GET /export` endpoint exists but is effectively unused by the client — it's only consumed by the MCP server's `get_export` tool and external tools.

**Recommendation**: Update section 5.5 to remove `GET /export` from the "Endpoints used by the client" list. Document that the client generates markdown locally rather than fetching from the server endpoint.

---

### MEDIUM-8: PanelCallbacks interface not documented in spec

**Severity**: Medium
**Section**: 5.6.1 (Callback Injection)
**Files**: `src/client/ui/panel.ts:24-30`

The spec's callback injection table (5.6.1) doesn't mention several panel callbacks that exist in the code:

| Callback | Purpose | Missing from spec? |
|---|---|---|
| `onAnnotationDelete` | Delete annotation from panel | Yes |
| `isAnnotationOrphaned` | Check orphan status | Yes |
| `onExport` | Trigger clipboard export | Yes |

These were added with the delete button and orphan indicator features but the callback injection table wasn't updated.

**Recommendation**: Add these to the callback injection table in section 5.6.1.

---

### LOW-1: Popup positioning threshold description slightly imprecise

**Severity**: Low
**Section**: 6.3 (Selection Popup)
**Files**: `src/client/ui/popup.ts:200`

The spec says: "If `top < 208` (not enough room above)". The code has:
```typescript
if (top < MARGIN + 200) {
```
where `MARGIN = 8`. So `208` is correct numerically, but the spec's description "not enough room above" is slightly misleading — `top` is already `rect.top - 8`, so the threshold is really about whether the selection is within ~200px of the viewport top.

**Recommendation**: Minor clarification — no action needed unless the spec is being used as a reference implementation guide.

---

### LOW-2: Spec references `scrollToAnnotation()` function indirectly

**Severity**: Low
**Section**: 5.6.2 (Typed Mediator)

The spec describes scroll-to-annotation as being wired "directly in the bootstrap via imported highlight functions". This is correct — the `scrollToAnnotation()` function exists in `annotator.ts:520` but is never called because the bootstrap wires identical logic directly. The duplicated function in `annotator.ts` is dead code.

**Recommendation**: Note as minor cleanup opportunity — the `scrollToAnnotation()` function in `annotator.ts:520-535` appears to be unused dead code since the bootstrap wires its own identical implementation in `index.ts:57-71`.

---

### LOW-3: `data-air-state` on Clear All button documented inconsistently

**Severity**: Low
**Section**: 14.2 (State Tracking)
**Files**: `src/client/ui/panel.ts:575, 581`

The spec says the Clear All button's `data-air-state` possible values are `"confirming" (or absent)`. The code uses `setAttribute('data-air-state', 'confirming')` and `removeAttribute('data-air-state')`. This matches, but other elements in the table use two explicit values (e.g. `open`/`closed`). The "(or absent)" pattern is inconsistent with the rest of the table.

**Recommendation**: Minor — consider documenting as `confirming | (not set)` for consistency.

---

### LOW-4: Spec doesn't mention `air-tooltip--hidden` class

**Severity**: Low
**Section**: 19.2 (First-Use Tooltip)
**Files**: `src/client/index.ts:117`

The spec documents the tooltip's dismiss behaviour but doesn't mention the `air-tooltip--hidden` CSS class used for the fade-out transition. This is consistent with the spec's general approach of not documenting CSS classes (they're not part of the automation contract), but the 300ms removal timeout is also undocumented.

**Recommendation**: Minor — consider adding the timeout detail for completeness.

---

### LOW-5: Spec section numbering gap — no section 4.2

**Severity**: Low
**Section**: Document structure

Sections jump from 4.1.1 directly to 4.2 (REST API), then 4.3 (MCP Server). But 4.2 is nested under section 4, while 4.3 is at the same level. The `## 4.3 MCP Server` heading uses `##` (H2) instead of `###` (H3), making it a peer of section 4 rather than a child.

**Recommendation**: Restructure so MCP Server is either `### 4.3` (H3, child of section 4) consistently, or promote it to `## 5` as a separate top-level section.

---

### LOW-6: `add_agent_reply` message validation not documented

**Severity**: Low
**Section**: 4.3.2 (MCP Tools)
**Files**: `src/mcp/tools/add-agent-reply.ts:10-14`

The `add_agent_reply` tool validates that the message is non-empty (trimmed):
```typescript
if (!params.message.trim()) {
  return { isError: true, ... };
}
```

This validation isn't documented in the MCP tools table or description. The Zod schema allows any string, but the handler adds an additional business rule.

**Recommendation**: Document the non-empty message validation in section 4.3.2.

---

### INFO-1: Resolved annotations well-integrated but spread across sections

**Severity**: Info

The `resolvedAt` and `replies` features are documented across sections 3.2.1, 3.2.1a, 4.3.2, 9.2, and the panel rendering. This is appropriate given the spec's structure, but a reader looking to understand the full resolved-annotation lifecycle would need to visit 5+ sections.

**Recommendation**: Consider adding a cross-reference paragraph in section 3.2.1 linking to all sections where resolved annotations appear.

---

### INFO-2: Spec correctly documents known technical debt

**Severity**: Info

The spec's documentation of known technical debt (section 10.4 re Escape propagation, section 3.6 re collision resistance, section 15.3 re context extraction limitations) is excellent. These honest disclosures help implementers understand intentional tradeoffs.

---

### INFO-3: Orphan detection correctly documented

**Severity**: Info

The recently-added orphan detection feature (sections 6.2.3, 6.2.3a, 8.4 Tier 3, 8.5.4 Tier 3) is well-documented with correct current-page-only scoping rules. The implementation matches the spec.

---

### INFO-4: Delete button feature correctly documented

**Severity**: Info

The annotation delete buttons (sections 6.2.3, 6.2.3a) and their behaviour are accurately documented. The `onAnnotationDelete` callback flow through the bootstrap matches the spec's description.

---

## Summary Table

| ID | Severity | Section | Summary |
|---|---|---|---|
| HIGH-1 | High | 3.2.1 | `type` field missing from `BaseAnnotation` in spec |
| HIGH-2 | High | 5.6.2 | `refreshPanel` return type is `void` in spec, `Promise<void>` in code |
| HIGH-3 | High | 6.2.3a | Spec says CSS selector shown, code shows description |
| MEDIUM-1 | Medium | 6.1/6.2.1 | Contradictory FAB badge count description |
| MEDIUM-2 | Medium | 8.1/8.5.1 | Resolved annotation green styling undocumented |
| MEDIUM-3 | Medium | 14.1 | 5 data-air-el values missing from automation contract |
| MEDIUM-4 | Medium | 4.2.4 | 1MB body limit and 413 status undocumented |
| MEDIUM-5 | Medium | 9.1 | Dual export implementations risk divergence |
| MEDIUM-6 | Medium | 10.1 | addPageNote shortcut bypasses FAB sync |
| MEDIUM-7 | Medium | 9.3/5.5 | Client doesn't use GET /export endpoint |
| MEDIUM-8 | Medium | 5.6.1 | Panel callbacks missing from callback injection table |
| LOW-1 | Low | 6.3 | Popup threshold description slightly imprecise |
| LOW-2 | Low | 5.6.2 | Dead `scrollToAnnotation()` function in annotator |
| LOW-3 | Low | 14.2 | Clear All state tracking inconsistent with table pattern |
| LOW-4 | Low | 19.2 | Tooltip fade-out class and timeout undocumented |
| LOW-5 | Low | Structure | Section 4.3 heading level inconsistent |
| LOW-6 | Low | 4.3.2 | Non-empty message validation undocumented |
| INFO-1 | Info | 3.2.1 | Resolved annotation lifecycle spread across sections |
| INFO-2 | Info | Various | Technical debt well-documented |
| INFO-3 | Info | 6.2.3 | Orphan detection correctly documented |
| INFO-4 | Info | 6.2.3 | Delete button correctly documented |
