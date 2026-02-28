---
generated_by: Claude Opus 4.6
generation_date: 2026-02-28
model_version: claude-opus-4-6
purpose: implementation_plan
status: active
human_reviewer: matthewvivian
tags: [status, refactor, simplification, resolved, autoResolve, breaking-change]
---

# Simplify Annotation Status Model

Remove the `resolved` status and `autoResolve` feature to simplify the annotation lifecycle. The flow becomes: `open → in_progress → addressed → (accept/reopen)`.

## Motivation

The four-status model (`open`, `in_progress`, `addressed`, `resolved`) has proven confusing in practice:

1. **`resolved` has no clear purpose** after Accept-deletes (PR #30). It was originally "reviewer confirmed", then redefined to "agent auto-resolved, skipping human review". But if the whole point of this tool is the human-agent feedback loop, bypassing human review undermines the core value proposition. (Review finding 3.2)

2. **`autoResolve` is a premature feature** with no UI to control it. There's no way for a reviewer to configure when auto-resolution is appropriate, and no obvious use case that justifies skipping human review at this stage. It can be added later with proper UX if needed.

3. **The `resolve_annotation` MCP tool name is misleading** — its default action produces `addressed`, not `resolved`. This is the single biggest source of confusion in the API. (Review finding 2.1)

4. **Code duplication** — nearly every conditional in the codebase that checks `addressed` also checks `resolved` (e.g., `status === 'addressed' || status === 'resolved'`). Removing `resolved` eliminates this pattern entirely.

See: `docs/reviews/2026-02-28-api-and-state-machine-review.md` for the full analysis.

## Design Decisions

### Simplified Status Model

```
type AnnotationStatus = 'open' | 'in_progress' | 'addressed';
```

| Status | Meaning | Set By |
|--------|---------|--------|
| `open` | New annotation, or reopened by reviewer | Default on creation; reviewer via Reopen |
| `in_progress` | Agent is actively working | Agent via MCP `set_in_progress` |
| `addressed` | Agent has acted (awaiting human review) | Agent via MCP `address_annotation` |

Terminal actions (not statuses):
- **Accept** → deletes the annotation (reviewer approves)
- **Reopen** → status returns to `open` with optional follow-up note (reviewer disagrees)
- **Delete** → removes the annotation (only on `open` status)

### Simplified Lifecycle

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
          |  Agent calls address_annotation (MCP)
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
  DELETED   OPEN (+ optional reviewer reply)
```

### MCP Tool Rename

Rename `resolve_annotation` → `address_annotation`:
- The tool only ever produces `addressed` status
- The name now directly describes its action
- The `autoResolve` parameter is removed
- The `replacedText` parameter is kept (still useful)

This is a **breaking change** for agent configurations that reference the old tool name. Since we're pre-1.0, this is acceptable.

### Backward Compatibility

Existing `inline-review.json` files may contain `status: 'resolved'` or `resolvedAt` timestamps:

- `getAnnotationStatus()` will map `status: 'resolved'` → `'addressed'`
- `getAnnotationStatus()` will map legacy `resolvedAt` (no status field) → `'addressed'`
- `resolvedAt` stays as an optional field on `BaseAnnotation` for backward compat reads, but is never set by new code
- The middleware rejects `resolved` as a new status value (not in VALID_STATUSES)

This means old data is read correctly without a migration step. The JSON file naturally converges to the new model as annotations are updated.

### Bundled Fixes from API Review

While touching these files, address three trivial findings:

| # | Finding | Fix |
|---|---------|-----|
| 1.3 | New annotations have no explicit `status` | Set `status: 'open'` on creation in middleware |
| 2.3 | `add_agent_reply` doesn't set `role` explicitly | Set `role: 'agent'` in the MCP handler |
| 2.7 | "Tier 2.5" jargon in tool description | Replace with plain English |

### What This Plan Does NOT Change

- The `in_progress` status and orphan grace period (PR #33) — unchanged
- The Accept-deletes behaviour (PR #30) — unchanged
- The Reopen + follow-up notes feature (PR #32) — unchanged
- The `replies` system and role-aware replies — unchanged
- The `update_annotation_target` MCP tool — unchanged
- The `set_in_progress` MCP tool — unchanged
- The `add_agent_reply` MCP tool (except adding explicit `role`) — unchanged

## Highlight Colour Changes

With `resolved` removed, the green highlight colour (`rgba(34,197,94,0.2)`) becomes unused. The remaining colours:

| Status | Text Highlight | Element Outline |
|--------|---------------|----------------|
| `open` | Amber `rgba(217,119,6,0.3)` | Amber `rgba(217,119,6,0.8)` |
| `in_progress` | Purple `rgba(139,92,246,0.2)` | Purple `rgba(139,92,246,0.5)` |
| `addressed` | Blue `rgba(59,130,246,0.2)` | Blue `rgba(59,130,246,0.5)` |

## Files to Modify

### Main Repository: `astro-inline-review`

#### Types & Shared

| File | Changes |
|------|---------|
| `src/shared/types.ts` | Remove `'resolved'` from `AnnotationStatus` union; update `getAnnotationStatus()` to map resolved → addressed; keep `resolvedAt` optional field for backward compat |
| `src/shared/export.ts` | Remove `resolved` status label (`✅ [Resolved]`) |

#### Server

| File | Changes |
|------|---------|
| `src/server/middleware.ts` | Remove `'resolved'` from `VALID_STATUSES`; remove resolved timestamp logic; set `status: 'open'` on POST creation |

#### MCP Tools

| File | Changes |
|------|---------|
| `src/mcp/tools/resolve-annotation.ts` | Rename file to `address-annotation.ts`; remove `autoResolve` param; remove `resolvedAt` logic; rename handler; update tool description; remove "Tier 2.5" jargon |
| `src/mcp/tools/add-agent-reply.ts` | Set `role: 'agent'` explicitly |
| `src/mcp/server.ts` | Update import and registration for renamed tool |

#### Client

| File | Changes |
|------|---------|
| `src/client/highlights.ts` | Remove `RESOLVED_HIGHLIGHT_STYLE`; remove `resolved` branches from `createMark()` and `applyElementHighlight()` |
| `src/client/ui/panel.ts` | Remove `resolved` CSS class; remove `resolved` badge; simplify `appendStatusActions()` (just check `addressed`); remove `resolvedAt` from badge function |

#### Re-exports (if `AnnotationStatus` changes propagate)

| File | Changes |
|------|---------|
| `src/types.ts` | No changes needed (re-exports from shared) |
| `src/client/types.ts` | No changes needed (re-exports from shared) |

#### Tests

| File | Changes |
|------|---------|
| `tests/shared/types.test.ts` | Update `getAnnotationStatus` tests: resolved → addressed mapping; remove resolved-specific cases; add backward compat test for `resolvedAt` |
| `tests/shared/export.test.ts` | Remove/update resolved export label tests |
| `tests/mcp/tools/resolve-annotation.test.ts` | Rename file to `address-annotation.test.ts`; remove all autoResolve tests; update handler import; verify only `addressed` status is produced |
| `tests/mcp/server.test.ts` | Update tool name references (`resolve_annotation` → `address_annotation`); remove autoResolve integration test |
| `tests/server/middleware.test.ts` | Remove resolved status transition tests; add test that `resolved` is rejected; add test for explicit `status: 'open'` on creation |
| `tests/client/ui/panel.test.ts` | Remove resolved-specific tests (resolved badge, resolved Reopen, resolved Accept); keep addressed equivalents |
| `tests/client/highlights.test.ts` | Remove/update resolved highlight tests |
| `tests/client/export.test.ts` | Remove resolved export tests |

#### Documentation

| File | Changes |
|------|---------|
| `docs/spec/specification.md` | Update `AnnotationStatus` type; remove resolved from all tables, transitions, acceptance tests; update section 6.2.3c button visibility |
| `CLAUDE.md` | Update schema (remove `resolvedAt`, update status enum); update MCP tools table (rename tool, remove autoResolve) |
| `docs/guides/2026-02-28-annotation-status-workflows.md` | Rewrite for three-status model |
| `docs/reviews/2026-02-28-annotation-status-workflow-review.md` | Update to reflect resolved removal |
| `docs/reviews/2026-02-28-api-and-state-machine-review.md` | Add "resolution" annotations for addressed findings |

### External Repository: `astro-inline-review-tests`

| File | Changes |
|------|---------|
| `tests/14-mcp-and-resolved.spec.ts` | Rename to `tests/14-mcp-and-addressed.spec.ts`; rewrite Group A (resolved panel tests → addressed panel tests); rewrite Group C (resolved highlights → addressed highlights); update Group D (export tests — remove `[Resolved]` checks, add `[Addressed]` checks); update Group E (API tests — `resolvedAt` → `addressedAt`); update Group F edge cases; keep Group B (agent replies) largely unchanged |

## Session Plan

### Session 1: Core Changes — Types, Server, MCP

**Goal**: Remove `resolved` from the type system, server, and MCP layer. All unit tests pass.

**Entry point**: Clean `main` branch, all tests passing.

**Tasks**:
1. Update `AnnotationStatus` type and `getAnnotationStatus()` in `src/shared/types.ts`
2. Remove resolved from `VALID_STATUSES` and timestamp logic in `src/server/middleware.ts`; add explicit `status: 'open'` on creation
3. Rename and simplify `resolve-annotation.ts` → `address-annotation.ts`; update `src/mcp/server.ts`
4. Set `role: 'agent'` explicitly in `src/mcp/tools/add-agent-reply.ts`
5. Update all affected tests: `types.test.ts`, `middleware.test.ts`, `resolve-annotation.test.ts` (renamed), `server.test.ts`
6. Run `npm test` — all tests pass
7. Commit

**Exit point**: Types, server, and MCP layer have no `resolved` references. Tests pass but client tests may fail (they reference resolved).

### Session 2: Client Changes — UI, Highlights, Export

**Goal**: Remove `resolved` from the client layer. All unit tests pass and build succeeds.

**Entry point**: Session 1 committed.

**Tasks**:
1. Remove `RESOLVED_HIGHLIGHT_STYLE` and resolved branches from `src/client/highlights.ts`
2. Remove resolved CSS class, badge, and simplify conditions in `src/client/ui/panel.ts`
3. Remove resolved label from `src/shared/export.ts`
4. Update tests: `panel.test.ts`, `highlights.test.ts`, `export.test.ts`, `client/export.test.ts`
5. Run `npm test && npm run build && npm run lint` — all pass
6. Commit

**Exit point**: All code changes complete. Full test suite passes. Build clean.

### Session 3: Documentation

**Goal**: Update specification, CLAUDE.md, and guides to reflect three-status model.

**Entry point**: Sessions 1-2 committed.

**Tasks**:
1. Update `docs/spec/specification.md` — status type, transitions, button tables, acceptance tests
2. Update `CLAUDE.md` — schema, MCP tools table, status references
3. Rewrite `docs/guides/2026-02-28-annotation-status-workflows.md` for three-status model
4. Update `docs/reviews/2026-02-28-annotation-status-workflow-review.md`
5. Add resolution notes to `docs/reviews/2026-02-28-api-and-state-machine-review.md`
6. Commit and push; create PR

**Exit point**: PR ready for review with all code + docs.

### Session 4: Scenario Tests (External Repository)

**Goal**: Update Playwright acceptance tests to match the new status model.

**Entry point**: Main repo PR merged or ready.

**Tasks**:
1. Rename `tests/14-mcp-and-resolved.spec.ts` → `tests/14-mcp-and-addressed.spec.ts`
2. Rewrite test groups to use `addressed` instead of `resolved`
3. Update `createAndEnrich` helper calls (use `addressedAt` instead of `resolvedAt`)
4. Remove resolved-specific assertions (green highlights, `✅ [Resolved]` export, resolved badge)
5. Add addressed-specific assertions (blue highlights, `🔧 [Addressed]` export, addressed badge)
6. Run Playwright tests locally against dev server
7. Commit and push

**Exit point**: Scenario tests pass against the updated main package.

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Breaking change for agent configs referencing `resolve_annotation` | Pre-1.0 software; document in changelog and release notes |
| Existing `inline-review.json` files with `resolved` data | `getAnnotationStatus()` backward compat mapping; data converges on next update |
| Scenario tests fail in CI before external repo is updated | Coordinate: merge main repo first, then external repo immediately after |
| Loss of auto-resolve capability | Can be re-added later with proper UX (per-annotation/per-session settings) |
