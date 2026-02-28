---
generated_by: Claude Opus 4.6
generation_date: 2026-02-28
model_version: claude-opus-4-6
purpose: issue_review
status: draft
human_reviewer: matthewvivian
tags: [status, workflow, reopen, addressed, review, gap-analysis]
---

# Annotation Status Workflow Review

Review of the annotation status system following the merge of PR #32 (follow-up notes on reopen) and PR #33 (in_progress status and orphan grace period). Identifies a design gap where `addressed` annotations lack a Reopen option.

## Context

Two features were developed in parallel and merged within 12 minutes of each other:

- **PR #33** (merged 08:53 UTC): Added `in_progress` status, orphan grace period, `set_in_progress` MCP tool
- **PR #32** (merged 09:05 UTC): Added follow-up notes when reopening annotations, role-aware replies

Both PRs built on PR #30 which introduced the Accept button. The merge conflict resolution (commit `ca61cf8`) integrated both features cleanly — all 476 tests pass and the build succeeds.

## Current State

### Button Visibility by Status

```
+--------------+---------+---------+---------+
|   Status     | Delete  | Accept  | Reopen  |
+--------------+---------+---------+---------+
| open         |   Yes   |   No    |   No    |
| in_progress  |   No    |   No    |   No    |
| addressed    |   No    |   Yes   |   NO    | <-- Gap
| resolved     |   No    |   Yes   |   Yes   |
+--------------+---------+---------+---------+
```

### MCP Agent Default Produces `addressed`

The MCP `resolve_annotation` tool defaults to `addressed` status (without `autoResolve`). This is the recommended and most common agent workflow:

```
  set_in_progress(id)
       |
  (edit source code)
       |
  resolve_annotation(id)          <-- no autoResolve
       |
  Result: status = "addressed"    <-- only Accept button, NO Reopen
```

## Issue #1: No Reopen on `addressed` Annotations

### Problem

When an annotation has `addressed` status, the reviewer's only option is **Accept** (which deletes the annotation). There is no way to reopen it with feedback.

This is the most common scenario because the default MCP `resolve_annotation` call produces `addressed` status. Reviewers who disagree with the agent's work must delete the annotation and create a new one from scratch, losing the entire conversation history.

### Root Cause

In `src/client/ui/panel.ts`, the `appendStatusActions()` function (line 743) only renders the Reopen button for `resolved` status:

```typescript
// Accept: shown on addressed OR resolved
if (status === 'addressed' || status === 'resolved') {
  // ... Accept button
}

// Reopen: shown ONLY on resolved  <-- THE GAP
if (status === 'resolved') {
  // ... Reopen button
}
```

### Impact

```
  Agent resolves annotation (default)
       |
       v
  Status: "addressed"
       |
  Reviewer sees: [Accept]
       |
  Reviewer disagrees with agent's work
       |
  Options:
    1. Accept (deletes annotation) --> loses history
    2. Create new annotation       --> loses conversation thread
    3. Nothing                     --> annotation stays "addressed" forever
```

### Proposed Fix

Change line 743 in `appendStatusActions()` from:

```typescript
if (status === 'resolved') {
```

to:

```typescript
if (status === 'addressed' || status === 'resolved') {
```

This gives `addressed` annotations the same Reopen + follow-up note capability that `resolved` annotations already have. The reviewer can then push back on the agent's work whilst preserving the full conversation history.

### Updated Button Matrix After Fix

```
+--------------+---------+---------+---------+
|   Status     | Delete  | Accept  | Reopen  |
+--------------+---------+---------+---------+
| open         |   Yes   |   No    |   No    |
| in_progress  |   No    |   No    |   No    |
| addressed    |   No    |   Yes   |   Yes   | <-- Fixed
| resolved     |   No    |   Yes   |   Yes   |
+--------------+---------+---------+---------+
```

### Updated Workflow After Fix

```
  Agent resolves annotation (default)
       |
       v
  Status: "addressed"
       |
  Reviewer sees: [Accept] [Reopen]
       |
  +----+----+
  v         v
Accept    Reopen (shows textarea for follow-up note)
  |         |
  v         v
DELETED   Status: "open"
          + optional reviewer reply appended
          Agent can see feedback and re-address
```

### Files to Update

| File | Change |
|------|--------|
| `src/client/ui/panel.ts` | `appendStatusActions()`: add `addressed` to Reopen condition |
| `tests/client/ui/panel.test.ts` | Add test: "shows Reopen button on addressed annotation" |
| `tests/client/ui/panel.test.ts` | Update test: "does not show Reopen button on open annotation" (confirm no regression) |
| `docs/spec/specification.md` | Update section 6.2.3c button visibility table |
| `docs/guides/2026-02-28-annotation-status-workflows.md` | Update button matrix and diagrams |

## Issue #2: Semantic Mismatch Between `addressed` and `resolved`

### Observation

The distinction between `addressed` and `resolved` has shifted across PRs:

- **Original spec** (pre-PR #32): `resolved` meant "human reviewer accepted the work"
- **After PR #32**: `resolved` was redefined to mean "agent auto-resolved, skipping human review"

This creates a semantic inversion:
- `addressed` = "awaiting human review" but has **fewer** reviewer actions (only Accept)
- `resolved` = "skipped human review" but has **more** reviewer actions (Accept + Reopen)

The status that explicitly invites human review (`addressed`) should logically offer more reviewer options, not fewer.

### Recommendation

Fixing Issue #1 (adding Reopen to `addressed`) resolves this semantic mismatch. Both statuses would then offer the same reviewer actions, with the distinction being purely about how they were reached:

- `addressed`: Agent explicitly requested human review
- `resolved`: Agent auto-resolved; reviewer can still intervene if needed

## Issue #3: Spec Documentation Gaps

### Status Transition Table

The specification at `docs/spec/specification.md` section 5.3 lists the forward transitions clearly but does not document:

1. **Reopen transition**: `resolved` -> `open` (via reviewer Reopen button)
2. **Missing `addressed` -> `open`**: If Issue #1 is fixed, this transition needs documenting

### Recommended Spec Updates

Add to the status transitions section:

```
- `addressed` -> `open`: Reviewer clicks Reopen, optionally with follow-up note
- `resolved` -> `open`: Reviewer clicks Reopen, optionally with follow-up note
```

## Summary of Issues

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 | No Reopen button on `addressed` annotations | High | Fixed |
| 2 | Semantic mismatch between `addressed`/`resolved` reviewer options | Medium | Fixed (resolved by fixing #1) |
| 3 | Spec doesn't document reopen transitions | Low | Fixed |

## Action Items

1. **Fix `appendStatusActions()`** to show Reopen on `addressed` annotations
2. **Add tests** for the new `addressed` + Reopen behaviour
3. **Update spec** section 6.2.3c and status transitions
4. **Update the canonical workflow guide** with corrected button matrix
