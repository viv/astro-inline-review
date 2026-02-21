---
generated_by: Claude Opus 4.6
generation_date: 2026-02-21
model_version: claude-opus-4-6
purpose: test_coverage_gaps
status: draft
human_reviewer: matthewvivian
tags: [testing, coverage, gaps, acceptance-tests]
source: Extracted from docs/spec/specification.md Appendix A
---

# Acceptance Test Coverage Gaps

> **Audience**: Test authors, not implementers.
>
> This document was extracted from the component specification (formerly Appendix A)
> because test coverage tracking is a living concern that changes as tests are written,
> and does not belong in a specification of component behaviour.

The following areas are specified in the [component specification](spec/specification.md) but have **incomplete or missing coverage** in the acceptance test suite.

## Status Key

Items are annotated with their current status based on the test coverage review and test quality review (both 2026-02-21):

- **Covered** — test has since been written and is passing
- **Open** — still lacks test coverage

---

## 1. Gaps in Existing Tests

1. **Orphaned annotations in panel** (Tier 3 restoration) — **Covered**
   No test verifies that when a highlight cannot be restored (DOM changed since annotation was created), the annotation still appears in the panel with an orphaned warning. The `.air-annotation-item__orphan` CSS class exists but is untested.
   > *Now covered by T2 in `05-persistence.spec.ts`.*

2. **Context matching fallback** (Tier 2 restoration) — **Covered**
   No acceptance test verifies that when XPath restoration fails but context matching succeeds, the highlight is still restored. All persistence tests rely on the DOM being unchanged between save and reload.
   > *Now covered by T1 in `05-persistence.spec.ts`.*

3. **Page note edit flow** — **Partially Covered**
   The acceptance test `07-page-notes.spec.ts` tests the edit happy path (click Edit, modify text, click Save, verify updated text persists). It does not test cancelling an edit or editing to empty text.
   > *Cancel path now covered by T5 in `07-page-notes.spec.ts`. Editing to empty text remains untested.*

4. **Toast notification content** — **Open**
   The export test (`09-export.spec.ts`) checks that a toast is visible after export, but doesn't verify the exact toast message ("Copied to clipboard!" vs "Export failed"). The `expectToastVisible` helper accepts optional text but most tests don't use it.

5. **Panel tab counts** (including page notes) — **Covered**
   The test for "annotation count appears in tab label" (`06-panel.spec.ts`) only checks that the tab contains "2". It doesn't verify the count includes page notes (the implementation counts both annotations and page notes). There is no test for the All Pages tab count.
   > *Now covered by T7 in `06-panel.spec.ts`.*

6. **Clear All confirmation auto-reset** (3-second timeout) — **Covered**
   The Clear All test verifies the confirmation step appears, but doesn't test that the confirmation auto-resets after 3 seconds if the user doesn't click again.
   > *Now covered by T4 in `06-panel.spec.ts`.*

7. **Popup positioning** — **Open**
   The selection test checks that the popup is "positioned near the selection" but uses a broad check (popup y-coordinate within 200px of selection). There's no test for the specific above/below fallback logic or horizontal clamping to viewport edges.

8. **Highlight removal normalises text nodes** — **Open**
   The highlight test `04-highlights.spec.ts` tests deletion but doesn't explicitly verify that `parent.normalize()` was called and adjacent text nodes were merged. This is important for subsequent selections to work correctly.

---

## 2. Missing Test Scenarios

1. **Clipboard API fallback** — **Open**
   No test for the `execCommand('copy')` fallback path when `navigator.clipboard` is unavailable.

2. **Concurrent API requests** — **Open**
   No acceptance test for rapid concurrent operations (e.g. creating and deleting simultaneously). The edge case test covers rapid creation but not mixed operations.

3. **External JSON file editing** — **Open**
   No test verifies that externally editing `inline-review.json` (e.g. in a text editor) and reloading the page picks up the changes. This is guaranteed by the storage design (always reads from disk) but untested.

4. **Storage file permissions** — **Open**
   No test for when the JSON file exists but is not writable (permission error).

5. **API error responses** — **Open**
   No acceptance test verifies client behaviour when the API returns 500 or other error status codes.

6. **Multiple browser tabs** — **Open**
   No test for the scenario where the same dev site is open in multiple tabs and annotations are created in both. The JSON file serialisation queue prevents corruption on the server side, but the client-side caches may become stale.

7. **Annotation on text within inline elements** — **Open**
   No explicit test for selecting text that spans across `<strong>`, `<em>`, `<a>`, or other inline elements within the same paragraph (distinct from the cross-element test which spans block elements).

8. **Very large store performance** — **Open**
   No test for performance with hundreds of annotations. The storage design reads/writes the entire file on each operation.

9. **Page note form cancel** — **Covered**
   No test verifies that cancelling the add-note or edit-note form discards changes and doesn't create/update a note.
   > *Now covered by T5 in `07-page-notes.spec.ts`.*

10. **Panel scroll position** — **Open**
    No test verifies that the panel's scroll position is preserved when switching between tabs, or that long lists of annotations are scrollable.

11. **Dev Toolbar companion** — **Open** (not yet implemented)
    The plan includes an Astro Dev Toolbar companion app (Session A5), but no tests exist for this yet as it hasn't been implemented.

---

## Cross-References

- **Component specification**: [`docs/spec/specification.md`](spec/specification.md)
- **Test coverage review**: [`docs/reviews/2026-02-21-test-coverage-review.md`](reviews/2026-02-21-test-coverage-review.md)
- **Test quality review**: [`docs/reviews/2026-02-21-test-quality-review.md`](reviews/2026-02-21-test-quality-review.md)
