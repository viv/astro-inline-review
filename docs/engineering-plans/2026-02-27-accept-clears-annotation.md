---
generated_by: Claude Opus 4.6
generation_date: 2026-02-27
model_version: claude-opus-4-6
purpose: implementation_plan
status: complete
human_reviewer: matthewvivian
tags: [panel, buttons, accept, delete, workflow]
---

# Accept Button Should Clear Annotation (#25)

## Problem

The Accept button on addressed annotations transitions to `resolved` status, leaving the annotation visible at reduced opacity. This adds clutter without value — if the reviewer has approved a change, the annotation should disappear.

## Desired Behaviour

| Status | Buttons shown | Accept action |
|--------|--------------|---------------|
| `open` | Delete | — |
| `addressed` | Accept | **Deletes the annotation entirely** |
| `resolved` | Reopen | — |

Key changes:
1. **Accept = delete**: clicking Accept on an addressed annotation removes it completely
2. **Delete button only in `open` status**: once workflow buttons (Accept/Reopen) are present, the Delete button is hidden

## Implementation

### Session 1: Implementation

#### Files to modify

1. **`src/client/ui/panel.ts`**
   - `appendStatusActions()` (line ~708-710): Change Accept button click handler from `callbacks.onAnnotationStatusChange(id, 'resolved')` to `callbacks.onAnnotationDelete(id)`
   - `createTextAnnotationItem()` (lines ~421-424): Only append delete button when `status === 'open'`
   - `createElementAnnotationItem()` (lines ~485-488): Same conditional for element annotations

2. **`src/client/index.ts`**
   - No changes needed — `onAnnotationDelete` callback already handles API deletion, highlight removal, badge refresh, and panel refresh

3. **`tests/client/ui/panel.test.ts`**
   - Update test "Accept button calls onAnnotationStatusChange with resolved" → should now call `onAnnotationDelete`
   - Add tests: Delete button hidden on addressed annotations
   - Add tests: Delete button hidden on resolved annotations
   - Add tests: Delete button visible on open annotations

4. **`docs/spec/specification.md`** (section 6.2.3c)
   - Update Accept button description: deletes annotation instead of transitioning to resolved
   - Update button visibility table: Delete only shown in `open` status

#### Approach (TDD)
1. Write failing tests first
2. Implement changes to pass tests
3. Update specification
4. Run full test suite + lint
5. Create independent review
6. Create PR
