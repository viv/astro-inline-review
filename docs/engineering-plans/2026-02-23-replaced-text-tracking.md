---
generated_by: Claude Opus 4.6
generation_date: 2026-02-23
model_version: claude-opus-4-6
purpose: implementation_plan
status: implemented
human_reviewer: matthewvivian
implementation_tracking: completed
tags: [annotations, replaced-text, orphan-recovery, mcp, client, schema]
related_issue: "#12 — Annotations become orphaned after agent resolves them by changing page content"
---

# Engineering Plan: `replacedText` Tracking (Issue #12)

## Problem

When an AI agent addresses a text annotation by editing source code, the page content changes and the annotation becomes orphaned. All three location tiers fail because the original `selectedText` no longer exists on the page. The agent's reply often describes what the text was changed to, but this information isn't structured or used for re-location.

## Solution Overview

Add an optional `replacedText` field to `TextAnnotation` that records what the original selected text was changed to. This enables a new location tier (2.5) that searches for the replacement text using the existing `findRangeByContext()` function with the same surrounding context.

## Architecture

### Data Flow

```
Agent changes text → Agent calls update_annotation_target(id, replacedText)
                     ↓
                     Storage: annotation.replacedText = "new text"
                     ↓
Page reload → restoreHighlights() attempts:
  Tier 1: XPath + offset (fails — text changed)
  Tier 2: findRangeByContext(selectedText, ...) (fails — original text gone)
  Tier 2.5 (NEW): findRangeByContext(replacedText, contextBefore, contextAfter) (succeeds!)
  Tier 3: Orphaned (avoided!)
```

### Layers Affected

| Layer | File(s) | Change |
|-------|---------|--------|
| Schema | `src/shared/types.ts` | Add `replacedText?: string` to `TextAnnotation` |
| MCP | `src/mcp/tools/update-annotation-target.ts`, `src/mcp/server.ts` | New tool + registration |
| REST API | `src/server/middleware.ts` | Extend PATCH allowlist |
| Client location | `src/client/annotator.ts` | Add Tier 2.5 between Tier 2 and Tier 3 |
| Panel display | `src/client/ui/panel.ts` | Show replacement text for re-anchored annotations |
| Specification | `docs/spec/specification.md` | Document new field, tool, and tier |
| Documentation | `CLAUDE.md` | Update MCP tool table and schema docs |

## Implementation Sessions

### Session 1: Schema + Backend (MCP tool, REST API, tests)

**Goal**: Add `replacedText` to the type system, create the MCP tool, extend the REST API, and write all server-side tests.

#### 1a. Schema Change (`src/shared/types.ts`)

Add `replacedText?: string` to `TextAnnotation`:

```typescript
interface TextAnnotation extends BaseAnnotation {
  type: 'text';
  selectedText: string;
  range: SerializedRange;
  replacedText?: string;  // Text that replaced the original selection
}
```

No schema version bump needed — the field is optional and backward-compatible.

#### 1b. MCP Tool (`src/mcp/tools/update-annotation-target.ts`)

New tool following the existing pattern (resolve-annotation.ts, add-agent-reply.ts):

- **Name**: `update_annotation_target`
- **Description**: "Update what text replaced the original annotated text. Call this after making changes so the annotation can be re-located on the page. Only applicable to text annotations."
- **Parameters**: `{ id: string, replacedText: string }`
- **Behaviour**:
  - Validate `replacedText` is non-empty
  - Find annotation by ID, verify it's a text annotation
  - Set `annotation.replacedText = params.replacedText`
  - Update `annotation.updatedAt`
  - Return the updated annotation as JSON
  - Return error if annotation not found or not a text annotation

Register in `src/mcp/server.ts` alongside existing tools.

#### 1c. REST API (`src/server/middleware.ts`)

Extend the PATCH `/annotations/:id` endpoint allowlist (line 163):

```typescript
// Before: only 'note' is mutable
note: body.note ?? store.annotations[idx].note,

// After: 'note' and 'replacedText' (for text annotations only)
note: body.note ?? store.annotations[idx].note,
...(store.annotations[idx].type === 'text' && 'replacedText' in body
  ? { replacedText: body.replacedText as string }
  : {}),
```

Only allow `replacedText` on text annotations (not element annotations).

#### 1d. Tests

- **MCP tool tests** (`tests/mcp/tools/update-annotation-target.test.ts`):
  - Sets `replacedText` on a text annotation
  - Returns error for non-existent ID
  - Returns error for element annotations
  - Returns error for empty `replacedText`
  - Persists the change to the JSON file
  - Updates `updatedAt` timestamp
  - Overwrites previous `replacedText` value

- **REST API tests** (`tests/server/middleware.test.ts`):
  - PATCH with `replacedText` updates the field on text annotations
  - PATCH with `replacedText` is ignored on element annotations
  - PATCH with both `note` and `replacedText` updates both

### Session 2: Client-side (Tier 2.5 location, panel display, tests)

**Goal**: Add Tier 2.5 context matching and update the panel to show re-anchored annotations.

#### 2a. Tier 2.5 Location (`src/client/annotator.ts`)

In `restoreHighlights()`, after Tier 2 fails, try `replacedText`:

```typescript
// Tier 2: Fall back to context matching with original text
if (!range) {
  range = findRangeByContext(
    annotation.range.selectedText,
    annotation.range.contextBefore,
    annotation.range.contextAfter,
  );
}

// Tier 2.5 (NEW): Try replacement text with same surrounding context
if (!range && annotation.replacedText) {
  range = findRangeByContext(
    annotation.replacedText,
    annotation.range.contextBefore,
    annotation.range.contextAfter,
  );
}

// Tier 3: Orphaned
if (range) {
  applyHighlight(range, annotation.id, resolved);
}
```

The key insight: `contextBefore` and `contextAfter` from the original selection are likely still valid because the agent changed the *annotated* text, not the surrounding text. The `findRangeByContext()` function already handles graduated scoring, so partial context matches are fine.

#### 2b. Panel Display (`src/client/ui/panel.ts`)

When a text annotation has `replacedText`, show the replacement text in the panel:

- Original text shown struck-through: ~~"original text"~~
- Replacement text shown below: → "new text"
- Only show this when `replacedText` is set (backward-compatible)

The `isAnnotationOrphaned` callback will naturally return `false` for re-anchored annotations since the highlight now succeeds, so no orphan indicator changes needed.

#### 2c. Tests

- **Selection tests** (`tests/client/selection.test.ts`):
  - `findRangeByContext` with replacement text that exists on page (using existing function — just validates the Tier 2.5 concept)

- **Annotator tests** (`tests/client/annotator.test.ts`):
  - Annotation with `replacedText` locates when original text is missing but replacement text exists
  - Annotation without `replacedText` still falls through to orphaned (no regression)

- **Panel tests** (`tests/client/ui/panel.test.ts`):
  - Text annotation with `replacedText` shows struck-through original and replacement
  - Text annotation without `replacedText` renders unchanged

### Session 3: Documentation + Review

**Goal**: Update specification, CLAUDE.md, and conduct independent review.

#### 3a. Specification Updates (`docs/spec/specification.md`)

- Add `replacedText?: string` to TextAnnotation (Section 3.2.2)
- Document Tier 2.5 in the location tier description (Section 15.2 or wherever tiers are documented)
- Add `update_annotation_target` to the MCP tool documentation
- Update PATCH endpoint docs to include `replacedText`

#### 3b. CLAUDE.md Updates

- Add `replacedText` to schema description
- Add `update_annotation_target` to MCP tool table
- Update "Reading annotations as an agent" section

#### 3c. Independent Review

- Review all changes for correctness, edge cases, and test coverage
- Write a markdown review report
- Address findings

## Dependencies Between Tasks

```
Schema change ──┬── MCP tool + tests
                ├── REST API + tests
                └── Client location + panel + tests
                         │
                         ▼
                Documentation updates
                         │
                         ▼
                Independent review
```

The schema change is the foundation — all other work depends on it. The MCP tool, REST API, and client-side changes are independent of each other and can be parallelised.

## Commit Strategy

Each logical unit gets its own commit following conventional commit format:
1. `feat: add replacedText field to TextAnnotation schema`
2. `feat: add update_annotation_target MCP tool`
3. `feat: extend REST API PATCH endpoint for replacedText`
4. `feat: add Tier 2.5 context matching with replacement text`
5. `feat: show replacement text in panel display`
6. `docs: update specification and CLAUDE.md for replacedText`
7. `test: add integration test for replacedText end-to-end flow`

## Edge Cases

- **Empty `replacedText`**: Rejected by both MCP tool and REST API validation
- **Element annotations**: `replacedText` only applies to text annotations; MCP tool returns error, REST API ignores the field
- **Multiple `replacedText` updates**: Later values overwrite earlier ones (agent refines the change)
- **Context mismatch**: If surrounding text also changed, Tier 2.5 may fail (falls through to orphaned — same as today)
- **No `replacedText` set**: Behaviour identical to current (backward-compatible)
- **`replacedText` matches in multiple locations**: `findRangeByContext()` already handles this via graduated context scoring — picks the best match
