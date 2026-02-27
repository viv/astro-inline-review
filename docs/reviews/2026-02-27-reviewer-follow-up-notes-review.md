---
generated_by: Claude Opus 4.6
generation_date: 2026-02-27
model_version: claude-opus-4-6
purpose: code_review
status: complete
human_reviewer: matthewvivian
tags: [review, panel, reopen, replies, follow-up]
---

# Code Review: Reviewer Follow-Up Notes (#16)

## Scope

Review of changes to allow reviewers to add follow-up notes when reopening addressed/resolved annotations.

## Data Model Decision

Extended `AgentReply` with `role?: 'agent' | 'reviewer'` rather than adding a separate `reviewerReplies` array or updating the `note` field in-place. This preserves a single chronological timeline that both agents and reviewers can follow.

## Files Changed

| File | Change Type | Lines Changed |
|------|-------------|---------------|
| `src/shared/types.ts` | Data model | +1 (role field) |
| `src/server/middleware.ts` | API extension | +12 (reply validation + append) |
| `src/client/ui/panel.ts` | UI: reopen form + reply rendering | +60 |
| `src/client/index.ts` | Callback update | +4 |
| `src/shared/export.ts` | Export prefix | +2 |
| `tests/server/middleware.test.ts` | New tests | +6 tests |
| `tests/client/ui/panel.test.ts` | New + updated tests | +9 tests |
| `tests/shared/export.test.ts` | New tests | +4 tests |
| `docs/spec/specification.md` | Spec updates | Multiple sections |
| `CLAUDE.md` | Schema + endpoint docs | +2 |

## Review Findings

### Correctness

- **Data model**: `role` is optional with `'agent'` as implicit default. Existing data without the field continues to work unchanged.
- **Middleware**: Reply validation (`reply.message` must be non-empty string) is consistent with existing validation patterns. The reply is appended inside the `mutate()` call ensuring atomicity with status changes.
- **Panel UI**: The reopen form follows the same patterns as the existing page note form (`createNoteForm`). Form is self-cleaning (removed on submit/cancel). `stopPropagation` prevents scroll-to-annotation when interacting with the form.
- **Export**: Role-based prefix (`Reviewer:` vs `Agent:`) with backward-compatible default.

### Test Coverage

- **Middleware**: 6 new tests covering reply append, role/timestamp, combined status+reply, preserving existing replies, and two validation error cases. Total: 49 tests.
- **Panel**: 9 new tests: reopen form display, submit without note, submit with note, cancel, form DOM cleanup, reviewer reply rendering, agent reply backward compat, mixed replies. Total: 63 tests.
- **Export**: 4 new tests: reviewer prefix, mixed prefixes in order, backward compat, element annotations. Total: 17 tests.
- **Full suite**: 448 tests pass.

### Edge Cases Considered

1. **Empty follow-up note**: Submitting the reopen form with an empty textarea sends `replyMessage: undefined`, so no reply is appended — just the status change. Tested.
2. **Multiple reopen form instances**: `showReopenForm` checks for existing `.air-reopen-form` to prevent duplicates.
3. **MCP compatibility**: `add_agent_reply` continues to append without a `role` field. Agents will see reviewer replies with `role: 'reviewer'` via `list_annotations` and `get_annotation` automatically.
4. **Backward compatibility**: Replies without `role` render as "Agent:" in both panel and export.

### Potential Improvements (not blocking)

1. The `AgentReply` interface name is now slightly misleading since it holds both agent and reviewer replies. A rename to `Reply` would be cleaner but is a breaking change for consumers of the type — not worth the churn now.

## Verdict

Implementation is clean, well-tested, and follows existing codebase patterns. No blocking issues found.
