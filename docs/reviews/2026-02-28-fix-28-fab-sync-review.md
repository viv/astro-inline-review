---
generated_by: Claude Opus 4.6
generation_date: 2026-02-28
model_version: claude-opus-4-6
purpose: independent_review
status: draft
human_reviewer: matthewvivian
tags: [fix, fab, keyboard-shortcut, review]
---

# Independent Review: PR #41 — Fix FAB sync for addPageNote shortcut

**PR**: #41 (branch `fix/28-fab-sync-page-note`)
**Issue**: #28 — addPageNote shortcut does not sync FAB to open state
**Commit**: `dd56df2` — `fix: sync FAB to open state when addPageNote shortcut opens panel`

## Summary

This PR adds a single `openFab(fab)` call to the `addPageNote` keyboard shortcut handler so that when `Cmd/Ctrl+Shift+N` opens the panel, the FAB icon correctly transitions from the clipboard (closed) to the X (open) state. It also exports two new helper functions (`openFab`, `resetFab`) from `src/client/ui/fab.ts` with dedicated unit tests.

## Changes Reviewed

| File | Change |
|------|--------|
| `src/client/index.ts` | Added `openFab(fab)` call in the `addPageNote` handler after manually opening the panel |
| `tests/client/ui/fab.test.ts` | Added `openFab` and `resetFab` describe blocks with unit tests |

## Findings

### F1: Panel state restoration path missing `openFab(fab)` call — Medium

**Severity**: Medium
**Location**: `src/client/index.ts`, lines 237-248

The panel state restoration path (which fires on page reload and cross-page navigation) opens the panel by adding CSS classes and setting `data-air-state`, but does not call `openFab(fab)`. This is the same class of bug that #28 fixed for the `addPageNote` shortcut.

**Impact**: After a page reload or cross-page navigation, if the panel was open before, the panel will be open again but the FAB will show the clipboard icon (closed state) instead of the X icon (open state). This is a visual inconsistency that confuses users about the panel state.

**Evidence**: Lines 238-248 — the code adds `air-panel--open` and sets `data-air-state` to `open` on the panel container, but there is no `openFab(fab)` call.

For comparison, the `togglePanel` shortcut handler (line 190) and the `addPageNote` handler (line 228) both correctly call `openFab(fab)`.

**Fix**: Add `openFab(fab)` after line 240 in the panel state restoration block.

### F2: `openFab` and `resetFab` tests do not verify icon SVG swap — Low

**Severity**: Low
**Location**: `tests/client/ui/fab.test.ts`, lines 59-100

The tests for `openFab` and `resetFab` verify the CSS class (`air-fab--open`) and `data-air-state` attribute, but do not verify that the SVG icon is actually swapped from clipboard to plus (or vice versa). The `openFab` function calls `setIcon(fab.button, PLUS_PATH)` and `resetFab` calls `setIcon(fab.button, CLIPBOARD_PATH)`, so the icon swap is a meaningful part of the contract.

**Impact**: A regression that breaks the icon swap but preserves the class/attribute changes would not be caught.

**Mitigation**: The existing `createFab` test `'toggles open class on click'` also does not check the SVG path, so this is consistent with the existing test style. Consider adding SVG path assertions in a follow-up if desired, but this is not blocking.

### F3: Specification does not document `openFab()` for non-click panel opening — Low

**Severity**: Low
**Location**: `docs/spec/specification.md`, Section 6.1, "State Synchronisation" (lines 828-832)

The spec documents `resetFab()` for when the panel is closed by means other than a FAB click, but does not document the symmetric `openFab()` function for when the panel is opened by means other than a FAB click (keyboard shortcuts, state restoration). The spec should document both directions of synchronisation.

**Fix**: Update the State Synchronisation section to cover `openFab()` and list all panel-open pathways that require it.

## Documentation Scan

- **CLAUDE.md**: Up to date, mentions `openFab` and `resetFab` exports from fab module.
- **Specification Section 10.1**: Correctly lists `Cmd/Ctrl+Shift+N` as "Opens panel if closed, displays add-note form". Does not mention FAB sync but the FAB sync requirement is implied by Section 6.1.
- **Specification Section 6.1**: Documents `resetFab()` but not `openFab()` — see F3.

## Verdict

**Approve with findings**. The core fix (F1 aside) is correct, minimal, and well-tested. The commit message is clear and correctly references the issue.

F1 (panel state restoration missing `openFab`) is a pre-existing bug of the same class as #28 and should be fixed in this PR to avoid shipping a known inconsistency. F2 and F3 are low-severity improvements that can be addressed in this PR or tracked separately.

### Action Items

| ID | Action | Severity | Status |
|----|--------|----------|--------|
| F1 | Add `openFab(fab)` to panel state restoration path | Medium | Addressed |
| F3 | Update spec Section 6.1 to document `openFab()` for non-click open paths | Low | Addressed |
| F2 | Consider adding SVG icon assertions to fab tests | Low | Deferred |
