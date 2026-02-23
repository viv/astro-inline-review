---
generated_by: Claude Opus 4.6
generation_date: 2026-02-23
model_version: claude-opus-4-6
purpose: implementation_plan
status: implemented
human_reviewer: matthewvivian
implementation_tracking: completed
tags: [annotations, status-lifecycle, mcp, workflow, ui]
---

# Annotation Status Lifecycle — Engineering Plan

## Problem

The MCP `resolve_annotation` tool currently auto-marks annotations as resolved (setting `resolvedAt` timestamp), bypassing human review. Issue #3 requests a proper status lifecycle where:

1. Annotations move through **open → addressed → resolved** states
2. **Agents** can mark annotations as "addressed" (they've worked on the issue)
3. **Human reviewers** close annotations via the browser UI (moving to "resolved")
4. A **full-auto resolution** option exists for faster workflows where agents can resolve directly

## Status Model

### States

| Status | Meaning | Set by |
|--------|---------|--------|
| `open` | Newly created, not yet acted upon | System (on creation) |
| `addressed` | Agent has responded/made changes | Agent (via MCP) |
| `resolved` | Reviewer confirmed the fix is acceptable | Reviewer (via UI) or Agent (auto-resolve) |

### Transitions

```
open ──────────► addressed ──────────► resolved
  │                  │                     │
  │                  └─── reopen ──► open  │
  │                                        │
  └──────── auto-resolve ─────────────────►│
                                           │
                                   reopen ─┘──► open
```

### Backward Compatibility

- Existing annotations without a `status` field default to `open`
- Existing annotations with `resolvedAt` set (but no `status`) default to `resolved`
- The `resolvedAt` and `addressedAt` timestamps record when each transition occurred
- Schema version stays at `1` — migration is in-memory only (same pattern as `type` field migration)

## Changes by Layer

### 1. Schema / Types (`src/shared/types.ts`)

Add to `BaseAnnotation`:
```typescript
status?: 'open' | 'addressed' | 'resolved';
addressedAt?: string;  // ISO 8601
```

Add type and helper:
```typescript
export type AnnotationStatus = 'open' | 'addressed' | 'resolved';

/** Get the effective status of an annotation (handles missing field for backward compat) */
export function getAnnotationStatus(a: BaseAnnotation): AnnotationStatus {
  if (a.status) return a.status;
  if (a.resolvedAt) return 'resolved';
  return 'open';
}
```

### 2. MCP Tools (`src/mcp/tools/`)

#### `resolve-annotation.ts` → Rename to `address-annotation.ts`

- Tool name: `resolve_annotation` (keep for backward compat) but change description
- **Default behaviour**: Sets `status` to `addressed`, sets `addressedAt` timestamp
- **New optional parameter**: `autoResolve: boolean` — when true, sets `status` to `resolved` and `resolvedAt` timestamp directly
- This is the key change from the issue: agents no longer auto-resolve by default

#### Rationale for keeping the tool name

Renaming the MCP tool would break existing agent configurations. Instead, we change the default behaviour (addressed, not resolved) and add `autoResolve` for the old behaviour.

### 3. REST API (`src/server/middleware.ts`)

Extend `PATCH /annotations/:id` to accept a `status` field:
- Validate: must be one of `'open' | 'addressed' | 'resolved'`
- When setting `addressed`: also set `addressedAt` to current timestamp
- When setting `resolved`: also set `resolvedAt` to current timestamp
- When setting `open` (reopen): clear `resolvedAt` and `addressedAt` (and set `status` to `open`)
- Existing `note` and `replacedText` updates continue to work unchanged

### 4. Client UI (`src/client/ui/panel.ts`)

#### Status Badge

Replace the single "✔ Resolved" badge with a status-aware badge:
- **Open**: No badge (default state — clean UI)
- **Addressed**: `🔧 Addressed` badge in blue/amber — agent has worked on it
- **Resolved**: `✔ Resolved` badge in green (existing styling)

#### Reviewer Action Buttons

Add status-transition buttons to annotation items:
- **On addressed annotations**: "Accept" button (moves to `resolved`) — the primary reviewer action
- **On resolved annotations**: "Reopen" button (moves back to `open`)
- These buttons call `PATCH /annotations/:id` with the new `status` field
- "Accept" is styled as a positive action (green); "Reopen" is neutral

#### Visual Styling

- **Addressed**: Blue left border accent (`#3B82F6`), slightly reduced opacity (0.85)
- **Resolved**: Existing green styling, opacity 0.7

### 5. Highlights (`src/client/highlights.ts`)

Add an addressed highlight style:
- Text: `rgba(59, 130, 246, 0.2)` (blue at 20% opacity)
- Element: `2px dashed rgba(59, 130, 246, 0.5)` (blue dashed)

Update `applyHighlight` and `applyElementHighlight` to accept status instead of boolean.

### 6. Export (`src/shared/export.ts`)

Update status labels in markdown export:
- Addressed: ` 🔧 [Addressed]`
- Resolved: ` ✅ [Resolved]` (unchanged)
- Open: no label (unchanged)

### 7. Annotator (`src/client/annotator.ts`)

Update `restoreHighlights` to pass status to highlight functions instead of the `!!annotation.resolvedAt` boolean.

## File Change Summary

| File | Change |
|------|--------|
| `src/shared/types.ts` | Add `status`, `addressedAt`, `AnnotationStatus`, `getAnnotationStatus()` |
| `src/mcp/tools/resolve-annotation.ts` | Change default to `addressed`, add `autoResolve` param |
| `src/mcp/server.ts` | No change (tool registration is the same) |
| `src/server/middleware.ts` | Accept `status` in PATCH, set timestamps |
| `src/client/ui/panel.ts` | Status badges, Accept/Reopen buttons |
| `src/client/styles.ts` | Addressed badge/item styles |
| `src/client/highlights.ts` | Addressed highlight colour, status-based API |
| `src/client/annotator.ts` | Pass status to highlight functions |
| `src/client/api.ts` | No change (already supports `updateAnnotation`) |
| `src/shared/export.ts` | Status labels in export |
| `src/client/types.ts` | Re-export new types |

## Test Plan

| Test File | What to Test |
|-----------|-------------|
| `tests/mcp/tools/resolve-annotation.test.ts` | Default sets `addressed`, `autoResolve` sets `resolved`, backward compat |
| `tests/server/middleware.test.ts` | PATCH with `status` field, timestamp setting, validation |
| `tests/client/ui/panel.test.ts` | Status badges, Accept/Reopen buttons, click behaviour |
| `tests/shared/export.test.ts` | Status labels in markdown export |
| `tests/mcp/helpers/fixtures.ts` | No change needed (fixtures don't set status) |

## Implementation Sessions

### Session 1: Schema + MCP + REST API + Tests

1. Update `src/shared/types.ts` with new fields and helpers
2. Update `src/mcp/tools/resolve-annotation.ts` (default addressed + autoResolve)
3. Update `src/server/middleware.ts` (PATCH status support)
4. Update and add tests for all three layers
5. Run full test suite, verify build

### Session 2: Client UI + Highlights + Export + Tests

1. Update `src/client/highlights.ts` (addressed colour, status-based API)
2. Update `src/client/annotator.ts` (pass status to highlights)
3. Update `src/client/ui/panel.ts` (status badges, Accept/Reopen buttons)
4. Update `src/client/styles.ts` (addressed styles)
5. Update `src/shared/export.ts` (status labels)
6. Update and add tests for all layers
7. Run full test suite, verify build

### Session 3: Documentation + Review

1. Update `docs/spec/specification.md`
2. Update `CLAUDE.md`
3. Write user documentation
4. Update `docs/guides/mcp-tools.md`
5. Independent code review
6. Address review findings
