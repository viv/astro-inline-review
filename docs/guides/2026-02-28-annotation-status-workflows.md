---
generated_by: Claude Opus 4.6
generation_date: 2026-02-28
model_version: claude-opus-4-6
purpose: developer_guide
status: draft
human_reviewer: matthewvivian
tags: [status, workflow, annotations, lifecycle, guide]
---

# Annotation Status Workflows

Canonical guide to the annotation status lifecycle in astro-inline-review. Covers all statuses, transitions, UI behaviour, MCP agent integration, and edge cases.

## Status Model

There are exactly four annotation statuses, defined in `src/shared/types.ts`:

```typescript
type AnnotationStatus = 'open' | 'in_progress' | 'addressed' | 'resolved';
```

| Status | Meaning | Set By |
|--------|---------|--------|
| `open` | New annotation, or reopened by reviewer | Default on creation; reviewer via Reopen button |
| `in_progress` | Agent is actively working on the annotation | Agent via MCP `set_in_progress` tool |
| `addressed` | Agent has acted on the annotation (awaiting human review) | Agent via MCP `resolve_annotation` (default) |
| `resolved` | Agent auto-resolved, skipping human review | Agent via MCP `resolve_annotation` with `autoResolve: true` |

### Status Storage

Status is stored explicitly in the `status` field on each annotation. For backward compatibility, annotations without a `status` field are derived using `getAnnotationStatus()`:

- If `resolvedAt` timestamp exists: `'resolved'`
- Otherwise: `'open'`

## Lifecycle Diagrams

### Happy Path: Default Agent Workflow

The most common flow. Agent uses `resolve_annotation` without `autoResolve`, producing `addressed` status.

```
  Reviewer creates annotation
          |
          v
     +---------+
     |  OPEN   |  Buttons: [Delete]
     +----+----+
          |  Agent calls set_in_progress (MCP)
          v
  +---------------+
  |  IN_PROGRESS  |  Buttons: [NONE]  Badge: "Agent working..."
  +-------+-------+
          |  Agent calls resolve_annotation (MCP, default)
          v
  +---------------+
  |   ADDRESSED   |  Buttons: [Accept] [Reopen]  Badge: "Addressed"
  +-------+-------+
          |
     +----+----+
     v         v
  Accept    Reopen (shows textarea for follow-up note)
     |         |
     v         v
  DELETED   +---------+
            |  OPEN   |  + optional reviewer reply appended
            +---------+
```

### Auto-Resolve Path

Agent uses `resolve_annotation` with `autoResolve: true`, skipping human review.

```
  Reviewer creates annotation
          |
          v
     +---------+
     |  OPEN   |  Buttons: [Delete]
     +----+----+
          |  Agent calls set_in_progress (MCP)
          v
  +---------------+
  |  IN_PROGRESS  |  Buttons: [NONE]
  +-------+-------+
          |  Agent calls resolve_annotation(autoResolve: true)
          v
  +---------------+
  |   RESOLVED    |  Buttons: [Accept] [Reopen]  Badge: "Resolved"
  +-------+-------+
          |
     +----+----+
     v         v
  Accept    Reopen (shows textarea for follow-up note)
     |         |
     v         v
  DELETED   +---------+
            |  OPEN   |  + optional reviewer reply appended
            +---------+
```

### All Possible Transitions

```
              +----------+
  +---------->|   OPEN   |<---------- Reopen -----------+
  |           +-----+----+        (from addressed       |
  |                 |              or resolved)          |
  |            set_in_progress                           |
  |                 |                                    |
  |                 v                                    |
  |        +--------------+                              |
  |        | IN_PROGRESS  |                              |
  |        +------+-------+                              |
  |               |                                      |
  |        resolve_annotation                            |
  |        (default)                                     |
  |               |                                      |
  |               v                                      |
  |        +------------+                                |
  |        |  ADDRESSED |-------- Reopen ----------------+
  |        +------+-----+                                |
  |               |                                      |
  |          Accept (deletes)                            |
  |               |                                      |
  |               v           resolve_annotation         |
  |          +==========+     (autoResolve: true)        |
  +----------|  DELETED  |    from any status             |
             +==========+           |                    |
                                    v                    |
                             +------------+              |
                             |  RESOLVED  |----- Reopen -+
                             +------+-----+
                                    |
                               Accept (deletes)
                                    |
                                    v
                              +==========+
                              |  DELETED  |
                              +==========+
```

### Button Visibility Matrix

```
+--------------+---------+---------+---------+-------------+
|   Status     | Delete  | Accept  | Reopen  | Status Badge|
+--------------+---------+---------+---------+-------------+
| open         |   Yes   |   No    |   No    |   (none)    |
| in_progress  |   No    |   No    |   No    |  "Working"  |
| addressed    |   No    |   Yes   |   Yes   |  "Addressed"|
| resolved     |   No    |   Yes   |   Yes   |  "Resolved" |
+--------------+---------+---------+---------+-------------+
```

## MCP Agent Integration

### Recommended Agent Workflow

```
1. set_in_progress(id)         -- Signal work starting
        |
2. (edit source code)          -- Make changes
        |
3. add_agent_reply(id, msg)    -- Optional: log progress notes
        |
4. resolve_annotation(id)     -- Mark work complete
        |
   Options:
     - Default (no autoResolve):  status -> "addressed"
     - autoResolve: true:         status -> "resolved"
     - replacedText: "new text":  Record what replaced the original
```

### MCP Tools Reference

| Tool | Effect | Status After |
|------|--------|--------------|
| `set_in_progress` | Signals agent is working; UI shows grace period | `in_progress` |
| `add_agent_reply` | Appends reply to timeline; no status change | (unchanged) |
| `resolve_annotation` (default) | Marks agent's work complete, awaiting review | `addressed` |
| `resolve_annotation` (autoResolve) | Marks complete, skips human review | `resolved` |
| `update_annotation_target` | Updates `replacedText` for re-anchoring | (unchanged) |

### When to Use autoResolve

- **Default (addressed)**: Use when the reviewer should confirm the change. This is the recommended default for most agent workflows.
- **autoResolve: true (resolved)**: Use for trivial or mechanical changes where human review adds no value (e.g., typo fixes, formatting corrections).

## Timestamp Management

Each status transition sets specific timestamps and clears others:

```
  Transition to:      | inProgressAt | addressedAt  | resolvedAt
  ---------------------+--------------+--------------+-----------
  open                 |   CLEARED    |   CLEARED    |  CLEARED
  in_progress          |   SET (now)  |   CLEARED    |  CLEARED
  addressed            |   CLEARED    |   SET (now)  |  CLEARED
  resolved             |   CLEARED    |   PRESERVED  |  SET (now)
```

Notable: `addressedAt` is **preserved** when transitioning to `resolved`. This records when the agent first acted on the annotation, even if it was later auto-resolved.

## Reviewer Actions

### Accept Button

- **Shown on**: `addressed` and `resolved` annotations
- **Action**: Deletes the annotation entirely (removes from store)
- **Use case**: Reviewer is satisfied with the agent's work

### Reopen Button

- **Shown on**: `addressed` and `resolved` annotations
- **Action**: Shows an inline textarea for an optional follow-up note, then transitions status to `open`
- **Follow-up note**: Appended to the `replies` array with `role: 'reviewer'`
- **Effect**: Clears all timestamps (`inProgressAt`, `addressedAt`, `resolvedAt`)

### Delete Button

- **Shown on**: `open` annotations only
- **Action**: Two-click confirmation ("Sure?"), then deletes the annotation
- **Hidden when**: Workflow buttons (Accept/Reopen) are present

## Reply System

Annotations have a `replies` array that serves as a chronological conversation thread:

```typescript
interface AgentReply {
  message: string;
  createdAt: string;               // ISO 8601
  role?: 'agent' | 'reviewer';    // Defaults to 'agent'
}
```

- **Agent replies**: Added via MCP `add_agent_reply` tool (no `role` field, defaults to `'agent'`)
- **Reviewer replies**: Added when reopening with a follow-up note (`role: 'reviewer'`)
- **Display**: Panel shows "Agent:" or "Reviewer:" prefix; markdown export uses the same prefixes

## Orphan Tracking

When annotations lose their DOM anchor (e.g., after a Vite hot-reload), the `OrphanTracker` manages a grace period:

```
  isDomAnchored?
     |
  +--+--+
  | Yes  | --> 'anchored' (highlight visible)
  +------+
  | No   |
  +--+---+
     |
  status === 'in_progress'?
     |
  +--+--+
  | Yes  | --> 'checking' (indefinite — never times out)
  +------+
  | No   |
  +--+---+
     |
  Ever been anchored on this page?
     |
  +--+--+
  | No   | --> 'orphaned' (immediate — no grace period)
  +------+
  | Yes  |
  +--+---+
     |
  Within 15-second grace period?
     |
  +--+--+
  | Yes  | --> 'checking' (showing "Checking..." indicator)
  +------+
  | No   | --> 'orphaned' (showing "Could not locate on page")
  +------+
```

## Key File Paths

| File | Role |
|------|------|
| `src/shared/types.ts` | Status type definitions, `getAnnotationStatus()` |
| `src/server/storage.ts` | `ReviewStorage` class (JSON file I/O) |
| `src/server/middleware.ts` | REST API, status validation, timestamp management |
| `src/client/ui/panel.ts` | Button rendering, `appendStatusActions()`, reopen form |
| `src/client/index.ts` | Status change callback wiring |
| `src/client/orphan-tracker.ts` | Grace period logic for orphaned annotations |
| `src/shared/export.ts` | Markdown export with status badges |
| `src/mcp/tools/resolve-annotation.ts` | MCP resolve tool (addressed/resolved) |
| `src/mcp/tools/set-in-progress.ts` | MCP in_progress tool |
| `src/mcp/tools/add-agent-reply.ts` | MCP reply tool |
