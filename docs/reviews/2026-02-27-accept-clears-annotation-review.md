---
generated_by: Claude Opus 4.6
generation_date: 2026-02-27
model_version: claude-opus-4-6
purpose: code_review
status: complete
human_reviewer: matthewvivian
tags: [review, panel, accept-button, delete-button]
---

# Code Review: Accept Button Clears Annotation (#25)

## Scope

Review of changes to make the Accept button delete annotations instead of transitioning to `resolved` status, and to hide the Delete button when workflow buttons are present.

## Files Changed

| File | Change Type | Lines Changed |
|------|-------------|---------------|
| `src/client/ui/panel.ts` | Behaviour change | ~6 lines |
| `tests/client/ui/panel.test.ts` | Test update + additions | ~40 lines |
| `docs/spec/specification.md` | Spec update | ~15 lines |
| `docs/engineering-plans/2026-02-27-accept-clears-annotation.md` | New | Engineering plan |

## Review Findings

### Correctness

- **Accept button handler**: Changed from `onAnnotationStatusChange(id, 'resolved')` to `onAnnotationDelete(id)`. The `onAnnotationDelete` callback (in `src/client/index.ts:89-99`) correctly handles API deletion, highlight removal, badge refresh, and panel refresh. No changes needed to the callback itself.

- **Delete button visibility**: Conditional `if (status === 'open')` correctly gates the delete button in both `createTextAnnotationItem` and `createElementAnnotationItem`. The three states are mutually exclusive, so this is safe.

- **No regression risk**: The `onAnnotationStatusChange` callback is still used by the Reopen button, so removing the Accept button's usage of it doesn't break anything.

### Test Coverage

- Updated existing test to verify Accept calls `onAnnotationDelete` instead of `onAnnotationStatusChange`
- Added explicit assertion that `onAnnotationStatusChange` is NOT called when Accept is clicked
- Added tests for Delete button hidden on `addressed` and `resolved` statuses
- Added test confirming Delete button visible only on `open` annotations
- All 431 tests pass (56 in panel test file)

### Spec Consistency

- Section 6.2.3c updated with new button/action table
- Delete button descriptions in sections 6.2.3 and 6.2.3a updated to mention `open` status restriction
- Data element table entry for `annotation-delete` updated
- User interaction table updated for Accept action

### Edge Cases Considered

1. **MCP `resolve_annotation` tool**: Still works — it sets `addressed` status, not `resolved`. The Accept button now deletes rather than resolves, but the MCP tool's `autoResolve: true` option still works independently of the UI button. No changes needed to MCP tools.

2. **Resolved annotations**: Can still be reached via MCP `autoResolve: true` or direct API `PATCH`. The Reopen button on resolved annotations is unchanged.

3. **Clear All**: Still deletes all annotations regardless of status — not affected by this change since it operates directly via the API, not through status action buttons.

## Verdict

Changes are minimal, well-tested, and correctly scoped. No issues found.
