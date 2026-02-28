---
generated_by: Claude Opus 4.6
generation_date: 2026-02-28
model_version: claude-opus-4-6
purpose: implementation_plan
status: implemented
human_reviewer: matthewvivian
tags: [orphan-handling, grace-period, in-progress, mcp, agent-ux]
---

# Graceful Orphan Handling During Agent Remediation

Issue: #29

## Problem

When an AI agent addresses an annotation by editing source code, Vite/Astro hot-reloads the page before the agent calls `resolve_annotation` via MCP. During this window the annotation appears orphaned ("Could not locate on page"), which is confusing and looks like something has gone wrong.

## Approach

Combine explicit `in_progress` status (Part A) with a client-side grace period (Part B). Agents that adopt the new MCP tool get a better UX; older agents still benefit from the grace period fallback.

## Implementation Summary

### Part A: `in_progress` status

- Extended `AnnotationStatus` union with `'in_progress'`
- Added `inProgressAt` timestamp to `BaseAnnotation`
- REST API PATCH accepts `in_progress` as a valid status
- New `set_in_progress` MCP tool for agents to signal work is starting
- Purple (#8B5CF6) highlight colour and panel styling for `in_progress`
- "Agent working..." badge in panel UI
- Action buttons (Delete/Accept/Reopen) hidden for `in_progress` annotations

### Part B: Orphan grace period

- `OrphanTracker` class tracks when annotations first become unanchored
- Three orphan states: `anchored` | `checking` | `orphaned`
- 15-second grace period before showing hard orphan indicator
- `in_progress` annotations never time out to `orphaned` — always show `checking`
- `onStoreChanged()` clears all timestamps so re-restored annotations get a fresh grace window
- "Checking..." soft amber indicator during grace period

## Key Design Decisions

- **Separate `set_in_progress` tool** rather than extending `resolve_annotation` — clearer semantic intent
- **15-second grace period** — long enough for most agent operations, short enough that genuine orphans surface promptly
- **`in_progress` never times out** — only the agent (via resolve) or reviewer (via reopen/delete) can transition out
- **`onStoreChanged` clears all orphan timestamps** — gives re-restored annotations a fresh grace window after agent resolves
- **Purple for in_progress** — distinct from amber (open), blue (addressed), green (resolved), red (orphan)

## Agent Workflow

```
1. Agent reads annotations via list_annotations
2. Agent calls set_in_progress(id) — UI shows "Agent working..."
3. Agent edits source code — Vite hot-reloads, UI shows "Checking..."
4. Agent calls resolve_annotation(id) — UI shows "Addressed" or "Resolved"
```

For agents that don't use `set_in_progress`, the grace period still provides a 15-second buffer before showing the orphan warning.

## Files Changed

### New files
- `src/client/orphan-tracker.ts`
- `src/mcp/tools/set-in-progress.ts`
- `tests/client/orphan-tracker.test.ts`
- `tests/mcp/tools/set-in-progress.test.ts`

### Modified files
- `src/shared/types.ts` — `AnnotationStatus` union, `BaseAnnotation`, `isAgentWorking`
- `src/server/middleware.ts` — `VALID_STATUSES`, PATCH handler
- `src/mcp/server.ts` — register `set_in_progress`
- `src/client/highlights.ts` — purple highlight styles
- `src/client/styles.ts` — in-progress and checking CSS classes
- `src/client/ui/panel.ts` — `PanelCallbacks.getOrphanState`, status badge, checking indicator
- `src/client/index.ts` — `OrphanTracker` instance, `getOrphanState` callback
- `src/shared/export.ts` — in_progress label
- `CLAUDE.md` — schema, API, MCP tools documentation
