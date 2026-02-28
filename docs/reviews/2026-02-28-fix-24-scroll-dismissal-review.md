---
generated_by: Claude Opus 4.6
generation_date: 2026-02-28
model_version: claude-opus-4-6
purpose: independent_review
status: draft
human_reviewer: matthewvivian
tags: [fix, popup, scroll-dismissal, shadow-dom, review]
---

# Independent Review: Fix #24 — Scroll Dismissal During Annotation Input

**PR**: #43 (`fix/24-scroll-dismissal-popup`)
**Issue**: #24 — popup dismisses on scroll when annotation input box is open
**Commit**: `c651443` — fix: prevent scroll from dismissing popup during annotation input

## Summary

This PR adds a single-line focus check to the scroll dismissal handler in `src/client/annotator.ts` to prevent the popup from being dismissed while the user is actively interacting with it. The fix uses `shadowRoot.activeElement` to detect whether focus is inside the popup container, which correctly handles the Shadow DOM boundary that regular `document.activeElement` cannot pierce.

The implementation is minimal and well-targeted. The accompanying unit tests are thorough, covering four distinct scenarios. The fix correctly addresses the bug described in issue #24.

## Test Failure Analysis

### Failing Check

**Playwright E2E** (`acceptance.yml`) — 1 of 210 tests failed, all 3 retries.

### Failing Test

`tests/03-selection.spec.ts:157` — "popup is dismissed when user scrolls"

### Root Cause

The E2E test selects text, which opens the popup and auto-focuses the textarea (via `requestAnimationFrame(() => textarea.focus())`). It then immediately scrolls by 200px and expects the popup to be hidden. With the new focus check, the popup correctly remains visible because `shadowRoot.activeElement` is the textarea.

This is not a bug in the implementation — it is an expected behavioural change. The test was written for the old behaviour (dismiss on any scroll > 50px regardless of focus state). The new behaviour intentionally preserves the popup when the textarea is focused, which is exactly what issue #24 requests.

### Fix Applied

The acceptance test in `astro-inline-review-tests` was updated:

1. **Renamed and modified** the existing test to "popup is dismissed when user scrolls in passive mode" — it now explicitly blurs the textarea before scrolling, simulating a user who has moved focus away from the popup.
2. **Added new test** "popup is NOT dismissed when textarea is focused and user scrolls" — verifies the new behaviour that the popup remains visible when the textarea has focus.

Both tests pass locally (211/211 acceptance tests pass).

## Changes Reviewed

### `src/client/annotator.ts` (2 lines added)

```typescript
// Don't dismiss if user is actively interacting with the popup
if (popup.container.contains(shadowRoot.activeElement)) return;
```

**Assessment**: Correct and minimal. Key observations:

1. **Shadow DOM correctness**: Uses `shadowRoot.activeElement` rather than `document.activeElement`, which is necessary because the popup lives inside a Shadow DOM. `document.activeElement` would return the shadow host element, not the actual focused element within the shadow tree.

2. **`contains()` over direct equality**: The check uses `popup.container.contains(...)` rather than `=== popup.textarea`, which correctly covers all focusable elements within the popup (textarea, Save button, Cancel button, Delete button). This handles tab navigation between popup elements.

3. **Guard ordering**: The focus check runs after the content check (`popup.textarea.value.trim()`), which is correct — if there is content, we already bail early regardless of focus. The focus check handles the remaining case: empty textarea but focused.

4. **Null safety**: `shadowRoot.activeElement` can be `null` when nothing in the shadow root has focus. `contains(null)` returns `false`, so this case correctly falls through to dismissal. No null-guard needed.

### `tests/client/annotator.test.ts` (128 lines added, 4 changed)

New "scroll dismissal" test suite with four tests:

| Test | Scenario | Expected |
|------|----------|----------|
| textarea focused, empty | User has textarea focused but hasn't typed | NOT dismissed |
| textarea has content | Existing safeguard (content in textarea) | NOT dismissed |
| no focus, no content | Passive mode — user scrolled away | Dismissed |
| button inside popup focused | Tab navigation to Save/Cancel button | NOT dismissed |

**Assessment**: Good coverage of the key scenarios. The tests correctly set up the Shadow DOM structure for focus detection (appending elements to `shadowRoot` so `shadowRoot.activeElement` works in happy-dom).

### Section numbering

Existing test sections were renumbered (3→4, 4→5, 5→6, 6→7) to accommodate the new "3. Scroll Dismissal" section. This is a mechanical change with no functional impact.

## Findings

### F1: Specification not updated (Medium) — ADDRESSED

**Original state**: Spec Section 7.4 only documented the "unsaved changes protection" (textarea content check) but not the new focus-based exemption.

**Action taken**: Updated Section 7.4 to add an "Active interaction protection" paragraph documenting the `shadowRoot.activeElement` check, the `contains()` approach, and the definition of "passive mode".

### F2: Acceptance test needed updating (High) — ADDRESSED

**Original state**: The Playwright E2E test "popup is dismissed when user scrolls" failed because it did not account for the auto-focus behaviour.

**Action taken**: Updated the test in `astro-inline-review-tests` to blur the textarea before scrolling (testing passive mode) and added a companion test verifying the new focus-preservation behaviour. All 211 acceptance tests pass.

### F3: No edge case for mobile/touch scroll (Informational)

On mobile devices, scroll events may fire without any prior focus interaction. The current implementation handles this correctly — if nothing in the popup has focus, the popup will be dismissed. No action needed, but worth noting for future mobile testing.

### F4: `requestAnimationFrame` timing in auto-focus (Informational)

The popup auto-focuses via `requestAnimationFrame(() => textarea.focus())`. There is a theoretical race condition where a very fast scroll event could fire before the `rAF` callback, meaning `shadowRoot.activeElement` would not yet be the textarea. In practice, this is extremely unlikely (the user cannot physically scroll > 50px within a single animation frame after selecting text), and even if it occurred, the popup would be dismissed and the user could simply re-select. No action needed.

## Documentation Scan

| Document | Status |
|----------|--------|
| Spec Section 7.4 (Scroll Dismissal) | Updated with focus-based exemption |
| CLAUDE.md | No changes needed — architecture section is accurate |
| Issue #24 | All code and test tasks are addressed |
| PR #43 description | Accurate and complete |

## Verdict

**APPROVE with changes applied**. The implementation is correct, minimal, and well-tested. The two findings (spec update and acceptance test fix) have been addressed in this review cycle. The fix correctly solves the bug described in issue #24 without introducing regressions.
