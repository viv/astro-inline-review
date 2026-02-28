---
generated_by: Claude Opus 4.6
generation_date: 2026-02-27
model_version: claude-opus-4-6
purpose: implementation_plan
status: complete
human_reviewer: matthewvivian
tags: [panel, reopen, replies, reviewer-notes, follow-up]
---

# Allow Follow-Up Notes When Reopening (#16)

## Problem

After an agent addresses an annotation, the reviewer can reopen it but has no way to add a clarifying comment. The only option is to delete and recreate the annotation.

## Data Model Decision

**Chosen approach**: Extend the existing `replies` array with a `role` field.

```typescript
interface AgentReply {
  message: string;
  createdAt: string;
  role?: 'agent' | 'reviewer';  // defaults to 'agent' for backward compat
}
```

**Rationale**:
- Single chronological timeline of all communication
- MCP agents see everything in order without checking multiple arrays
- Backward compatible — existing replies without `role` default to `'agent'`
- No new top-level arrays on the annotation object
- Follows existing patterns (append-only, timestamped)

**Rejected alternatives**:
- Update `note` field in-place: loses history
- Separate `reviewerReplies` array: fragments the timeline, harder for agents to follow

## UI Design

When the reviewer clicks "Reopen":
1. Instead of immediately changing status, show an inline textarea
2. Reviewer can type a follow-up note (optional — can reopen without a note)
3. "Reopen" button submits status change + optional reviewer reply atomically
4. "Cancel" dismisses the form without changing anything

Reviewer replies in the panel timeline show "Reviewer:" prefix (vs "Agent:" for agent replies).

## Implementation

### Layer 1: Data Model
- `src/shared/types.ts` — Add `role?: 'agent' | 'reviewer'` to `AgentReply`

### Layer 2: REST API
- `src/server/middleware.ts` — PATCH accepts optional `reply: { message: string }` field, appends to replies with `role: 'reviewer'`

### Layer 3: Panel UI
- `src/client/ui/panel.ts` — Reopen button shows textarea form; `createReplyBlock` uses role for prefix
- `src/client/index.ts` — `onAnnotationStatusChange` passes optional reply message
- `src/client/ui/panel.ts` — `PanelCallbacks.onAnnotationStatusChange` signature extended

### Layer 4: Export
- `src/shared/export.ts` — Render "Reviewer:" prefix for reviewer replies

### Layer 5: Tests
- `tests/server/middleware.test.ts` — PATCH with reply field
- `tests/client/ui/panel.test.ts` — Reopen form, reviewer reply rendering
- `tests/shared/export.test.ts` — Reviewer reply export format

### No MCP Changes Needed
- MCP tools already return full annotation data including replies
- Agents will see reviewer replies with `role: 'reviewer'` automatically
- `add_agent_reply` already appends with no role (defaults to 'agent')
