---
generated_by: Claude Opus 4.6
generation_date: 2026-02-22
model_version: claude-opus-4-6
purpose: remaining_review_findings
status: draft
human_reviewer: matthewvivian
scope: [specification, implementation, tests, cicd, design, architecture, documentation]
tags: [review, remaining-findings, second-wave, quality-assurance]
prior_review: docs/reviews/2026-02-22-comprehensive-review.md
---

# Remaining Review Findings — astro-inline-review

**Date:** 2026-02-22
**Context:** The comprehensive review identified 144 findings across 7 dimensions and produced 10 implementation prompts, all now completed. This document captures the remaining valid findings from all individual reviews that were not addressed by those 10 prompts.

**Source reviews:**
- 7 parallel reviews (2026-02-22): specification, implementation, documentation, tests, CI/CD, design, architecture
- 6 earlier reviews (2026-02-21): spec rounds 1-3, security rounds 1-2, system review, test coverage, test quality
- 3 MCP reviews (2026-02-22): security, code, design

---

## Status Summary

| Review | Total Findings | Done | Previously Resolved | Remaining |
|--------|---------------|------|-------------------|-----------|
| Spec Review (2026-02-22) | 21 | 11 (H1-3, M1-8) | — | 10 (L1-6, I1-4) |
| Spec Review Round 3 (2026-02-21) | 15 | 0 | Marked resolved but content unverified | 15 (needs verification) |
| Implementation Review (2026-02-22) | 30 | 6 (C1-3, H3, M1, M10) | — | 24 |
| Documentation Review (2026-02-22) | 16 | 6 (H1, M1, L3-4, L6) | — | 10 |
| Test Coverage Review (2026-02-22) | 17 | 2 (annotator, element-selector) | — | 15 |
| CI/CD Review (2026-02-22) | 17 | 9 (H1, M1, M3-4, L10, L12, L15, L17) | — | 8 |
| Design & Accessibility Review (2026-02-22) | 27 | 13 (C1-2, H1-7, scroll, badge, toast) | — | 14 |
| Architecture Review (2026-02-22) | 16 | 1 (M1) | — | 15 (mostly Info/Low) |
| Comprehensive Review Priority 7 | 4 | 1 (7.4 delete confirm) | — | 3 (7.1-7.3) |
| Comprehensive Review Priority 3 | 4 | 2 (3.1-3.2) | — | 2 (3.3-3.4) |
| Spec Reviews Rounds 1-2 (2026-02-21) | 39 | — | All resolved | 0 |
| Security Reviews 1-2 (2026-02-21) | 18 | — | All resolved | 0 |
| MCP Reviews (2026-02-22) | 17 | — | All resolved | 0 |
| System Review (2026-02-21) | 10 | — | 3 resolved | 7 (overlap with impl review) |
| Test Quality Review (2026-02-21) | ~20 | — | External test repo | Not verifiable |

---

## Remaining Findings — Prioritised

### Priority 1: Code Quality & Correctness (Medium)

These are concrete code improvements from the implementation and architecture reviews.

| ID | Source | Severity | Finding | Status |
|----|--------|----------|---------|--------|
| REM-01 | IMPL-H1 | High | Dead code: `scrollToAnnotation` in annotator.ts:530 — never called | **Resolved** (Session 1) |
| REM-02 | IMPL-H2, ARCH-M3 | High | Client export.ts duplicates shared/export.ts (~100 lines identical logic) | **Resolved** (Session 1) |
| REM-03 | IMPL-H4 | High | `existsSync` then async `readFile` is a TOCTOU race in storage.ts:22-24 | Confirmed still present |
| REM-04 | IMPL-H5 | High | No size limit on MCP tool string inputs (message param) | Still present |
| REM-05 | IMPL-M4 | Medium | Escape handler doesn't call stopPropagation when handling event | Partially — shortcuts.ts has preventDefault on Cmd shortcuts but not on Escape |
| REM-06 | IMPL-M5 | Medium | Clear All sends N sequential DELETE API calls (no bulk endpoint) | Still present |
| REM-07 | IMPL-M7 | Medium | `SerializedSelection` in selection.ts duplicates `SerializedRange` in shared/types.ts | **Resolved** (Session 1) |
| REM-08 | IMPL-M8 | Medium | `generateId()` uses `Math.random()` not `crypto.randomUUID()` | **Resolved** (Session 1) |
| REM-09 | IMPL-M9 | Medium | Storage migration silently converts unknown shapes without validation | Still present |
| REM-10 | IMPL-M6 | Medium | Inspector overlay is in light DOM, inconsistent with shadow DOM pattern | Still present |
| REM-11 | Comp-7.3 | Medium | No atomic writes — storage.write() should use temp file + rename | Still present |
| REM-12 | ARCH-M2 | Medium | localStorage cache has no invalidation strategy | Still present |
| REM-13 | SYS-4 | Medium | FAB state desync — FAB's internal `isOpen` can desync from panel state | Still present |
| REM-14 | SYS-5 | Medium | Escape handler bypasses `hidePopup()` — stale textarea content possible | Still present |
| REM-15 | SYS-7 | Medium | Double API fetch on panel open — `refreshPanel()` and `updateTabCounts()` both fetch | Still present |
| REM-16 | IMPL-L1 | Low | `readBody` with empty body returns 500 instead of 400 | **Resolved** (Session 1) |
| REM-17 | IMPL-L7 | Low | Client API `getExport()` doesn't check `res.ok` | **Resolved** (Session 1) |
| REM-18 | MCP-L1 | Low | `src/mcp/index.ts` barrel re-export is unused dead code | **Resolved** (Session 1) |
| REM-19 | ARCH-M4 | Low | JSON storage: silent data loss on parse errors (returns empty store) | Still present |

### Priority 2: Specification Accuracy (Medium)

These are from Spec Review Round 3 (2026-02-21). The review was marked `status: resolved` but the actual spec content changes were NOT verified. Prompt 7 from the comprehensive review addressed different findings from the 2026-02-22 spec review, not these Round 3 items.

| ID | Source | Severity | Finding |
|----|--------|----------|---------|
| REM-20 | SPEC3-001 | Critical | PATCH mutability table says multiple fields mutable — code only allows `note` |
| REM-21 | SPEC3-002 | Critical | Element highlight opacity: spec says 0.7, code uses 0.8 (three spec sections) |
| REM-22 | SPEC3-003 | Major | Inspector overlay colours: spec says `rgb(59,130,246)`, code uses `rgb(66,133,244)` |
| REM-23 | SPEC3-004 | Major | Spec claims resolveElement verifies CSS selector uniqueness — code does not |
| REM-24 | SPEC3-005 | Major | Spec says captured attributes are tag-conditional — code captures unconditionally |
| REM-25 | SPEC3-006 | Major | Element description format examples don't match code output |
| REM-26 | SPEC3-007 | Major | Spec says inspector listeners attached/detached dynamically — code registers all once |
| REM-27 | SPEC3-008 | Major | `__restoreHighlights` missing from shadow root bridge table in spec |
| REM-28 | SPEC3-009 | Minor | First-use tooltip text doesn't match code |
| REM-29 | SPEC3-010 | Minor | Export outerHtmlPreview: spec says 100 chars, code stores 200 |
| REM-30 | SPEC3-011 | Minor | Appendix A test count still says "110" |
| REM-31 | SPEC3-012 | Minor | Element click walks ancestors — not documented |
| REM-32 | SPEC3-013 | Minor | Clear All highlight cleanup description outdated |
| REM-33 | SPEC3-014 | Suggestion | Document onAnnotationClick callback duplication |
| REM-34 | SPEC3-015 | Suggestion | Destroy method event listener list incomplete |

Plus remaining Low items from the 2026-02-22 spec review:

| ID | Source | Severity | Finding |
|----|--------|----------|---------|
| REM-35 | SPEC-L1 | Low | Popup positioning threshold description imprecise |
| REM-36 | SPEC-L3 | Low | Clear All data-air-state tracking inconsistent with table pattern |
| REM-37 | SPEC-L4 | Low | Tooltip fade-out class and 300ms timeout undocumented |
| REM-38 | SPEC-L5 | Low | Section 4.3 heading level inconsistent (H2 instead of H3) |
| REM-39 | SPEC-L6 | Low | add_agent_reply non-empty message validation undocumented |

### Priority 3: Test Coverage Gaps (Medium)

Remaining from the comprehensive review's Priority 3 (items 3.3 and 3.4) plus the test review's other findings.

| ID | Source | Severity | Finding |
|----|--------|----------|---------|
| REM-40 | Comp-3.3 | High | No `deserializeRange` tests (primary highlight restoration path, Tier 1) |
| REM-41 | Comp-3.4 | High | No vitest coverage thresholds configured |
| REM-42 | TEST | High | popup.ts untested (243 lines — positioning, show/hide, button management) |
| REM-43 | TEST | Medium | API test coverage thin — 5 of 8 methods tested (missing page note CRUD + updateAnnotation) |
| REM-44 | TEST | Medium | shared/export.ts has no direct unit tests |
| REM-45 | TEST | Medium | Test helpers (`makeTextAnnotation`) duplicated across 5+ MCP test files |
| REM-46 | TEST | Medium | Resolved highlight styling (green vs amber) untested |
| REM-47 | TEST | Medium | No Unicode edge case tests for selection (emoji, CJK, RTL) |
| REM-48 | TEST | Medium | No special character tests for annotation IDs in middleware (path traversal) |
| REM-49 | TEST | Medium | Orphan detection logic in index.ts only tested via mocks |
| REM-50 | TEST | Medium | No timeout configuration for MCP integration tests |
| REM-51 | TEST | Low | host.ts untested (33 lines — shadow DOM creation, idempotency) |
| REM-52 | TEST | Low | toast.ts untested (31 lines — auto-dismiss timer) |

### Priority 4: UX & Design Improvements (Medium-Low)

Remaining from the design review that weren't addressed by Prompts 4 and 10.

| ID | Source | Severity | Finding |
|----|--------|----------|---------|
| REM-53 | UX | High | Panel overlaps content on small viewports (380px wide, full-width < 480px, no tablet breakpoint) |
| REM-54 | UX | Medium | API errors are console-only — no user-visible feedback via toast |
| REM-55 | UX | Medium | No unsaved changes warning when popup dismissed with text in textarea |
| REM-56 | UX | Medium | Inspector label can overflow (no max-width on long selectors) |
| REM-57 | UX | Medium | Dynamic content updates not announced (no aria-live on panel content refresh) |
| REM-58 | UX | Medium | FAB and panel share z-index 10000 — FAB occluded on narrow full-width panel |
| REM-59 | UX | Medium | Potential keyboard shortcut conflicts with host apps (Cmd+Shift+E = VS Code Explorer) |
| REM-60 | UX | Medium | Popup positioning can be obscured by open panel |
| REM-61 | UX | Medium | Panel "Failed to load annotations" gives no guidance (e.g. "Is dev server running?") |
| REM-62 | UX | Medium | Inspector mode (Alt+hover) is mouse-only — no keyboard equivalent |
| REM-63 | UX | Low | Keyboard shortcuts not discoverable in UI (no help dialog or tooltips) |
| REM-64 | UX | Low | Tooltip lacks `role="tooltip"` and FAB lacks `aria-describedby` linkage |
| REM-65 | UX | Low | Z-index values scattered — no centralised constants |

### Priority 5: CI/CD (Low)

| ID | Source | Severity | Finding |
|----|--------|----------|---------|
| REM-66 | CICD-M2 | Medium | No ESLint or Prettier in CI (no code style enforcement) |
| REM-67 | CICD-M5 | Medium | Release workflow doesn't run acceptance tests |
| REM-68 | CICD-L4 | Low | Security audit condition coupled to specific Node version (22) |
| REM-69 | CICD-L13 | Low | No CODEOWNERS file |
| REM-70 | CICD-L18 | Low | Playwright browsers not cached in acceptance workflow |
| REM-71 | CICD-L16 | Low | Coverage thresholds not enforced in CI |
| REM-72 | CICD-L5 | Low | Acceptance workflow missing npm cache |

### Priority 6: Documentation (Low)

| ID | Source | Severity | Finding |
|----|--------|----------|---------|
| REM-73 | DOCS-M3 | Medium | Outstanding tech debt has no tracking mechanism — needs backlog document |
| REM-74 | DOCS-M4 | Medium | Test quality review P0 recommendations not tracked (external test repo) |
| REM-75 | DOCS-L2 | Low | MCP Server plan Session 7 status says `complete` not `completed` |
| REM-76 | DOCS-L5 | Low | README has stale TODO comment for screenshot (`<!-- TODO: Add screenshot/GIF here -->`) |

---

## Implementation Prompts

Below are ready-to-use prompts for implementing the remaining findings, organised into independent sessions.

### Session 1: Code Cleanup — Dead Code, Deduplication, and Minor Fixes

**Findings addressed:** REM-01, REM-02, REM-07, REM-08, REM-16, REM-17, REM-18

```
Read the following files in the astro-inline-review repository:
- src/client/annotator.ts
- src/client/export.ts
- src/shared/export.ts
- src/client/selection.ts
- src/shared/types.ts
- src/server/middleware.ts
- src/client/api.ts
- src/mcp/index.ts

Make these targeted fixes:

1. Remove dead code: Delete the `scrollToAnnotation` function from
   annotator.ts (around line 530). It is never called — the panel's
   onAnnotationClick callback in index.ts handles this directly.

2. Unify export logic: The client's export.ts duplicates shared/export.ts
   (~100 lines of identical markdown generation). Refactor client/export.ts
   to import `generateExport` from shared/export.ts instead of duplicating
   it. The client bundle's `noExternal: [/.*/]` tsup setting will inline
   the shared code. Keep only the `exportToClipboard` wrapper in
   client/export.ts.

3. Unify SerializedSelection: In selection.ts, the `SerializedSelection`
   interface duplicates `SerializedRange` from shared/types.ts. Replace
   all uses of `SerializedSelection` in selection.ts with `SerializedRange`
   from shared/types.ts. Remove the duplicate interface.

4. Use crypto.randomUUID(): In middleware.ts, replace the `generateId()`
   function (which uses Date.now() + Math.random()) with
   `crypto.randomUUID()`. Import from 'node:crypto'.

5. Fix readBody empty body: In middleware.ts, ensure that a POST request
   with an empty body returns 400 (not 500). The `readBody` function's
   catch block should be handled as a 400 in the outer catch of
   `createMiddleware`.

6. Fix getExport error handling: In api.ts, the `getExport()` method
   doesn't check `res.ok`. Add error checking matching the pattern used
   by the `request()` helper.

7. Remove unused barrel: Delete src/mcp/index.ts — it's a re-export
   that nothing imports. The MCP entry point is src/mcp/server.ts
   configured directly in tsup.config.ts.

Run `npm run build && npm test` to verify all tests pass.

Update all applicable Markdown files — including
docs/reviews/2026-02-22-remaining-findings.md — to reflect the
current status of findings addressed in this session.

After implementation, commit changes.

Print the Session 2 prompt from docs/reviews/2026-02-22-remaining-findings.md
to get started on the next session.
```

### Session 2: Storage Robustness

**Findings addressed:** REM-03, REM-09, REM-11, REM-19

```
Read src/server/storage.ts in the astro-inline-review repository.

Make these improvements to the ReviewStorage class:

1. Remove TOCTOU race: Delete the `existsSync` check on line 22-24.
   The try/catch on the readFile call already handles ENOENT (missing
   file). The `existsSync` check is redundant and creates a race
   condition between checking existence and reading.

2. Add atomic writes: In the `write()` method, instead of writing
   directly to `this.filePath`, write to a temporary file
   (`this.filePath + '.tmp'`) then rename it. Use `writeFile` for
   the temp file and `rename` from 'node:fs/promises' to atomically
   replace the target. This prevents truncated files from crashes.

3. Improve migration validation: In the `read()` method's migration
   logic (around line 36-42), after adding `type: 'text'` to annotations
   without a type field, validate that the migrated object has at least
   `id`, `pageUrl`, and `note` fields. Log a warning (not throw) for
   any annotations that fail validation, and filter them out.

4. Handle parse errors with a warning: When `JSON.parse` fails (line 45
   catch block), instead of silently returning an empty store, log a
   console.warn with the file path and error message. Still return
   the empty store, but the warning helps debugging when data is
   unexpectedly lost.

Run `npm test` to verify all tests pass. Update tests/server/storage.test.ts
to add tests for:
- Atomic write (verify temp file pattern)
- Migration validation (corrupt annotation filtered out)
- Parse error warning (verify console.warn called)

Update all applicable Markdown files — including
docs/reviews/2026-02-22-remaining-findings.md — to reflect the
current status of findings addressed in this session.

After implementation, commit changes.

Print the Session 3 prompt from docs/reviews/2026-02-22-remaining-findings.md
to get started on the next session.
```

### Session 3: Specification Round 3 Fixes

**Findings addressed:** REM-20 through REM-39

```
Read docs/spec/specification.md in the astro-inline-review repository.
Also read src/server/middleware.ts, src/client/annotator.ts,
src/client/element-selector.ts, and src/client/highlights.ts
for reference.

Fix the following spec-vs-code discrepancies identified in the
Round 3 specification review:

CRITICAL:
1. Section 4.2.1 (PATCH field mutability): Update the table to show
   that ONLY `note` is mutable. All other fields (pageUrl, pageTitle,
   selectedText, range, elementSelector, createdAt) are preserved.
   Add a note about the allowlist pattern.

2. Sections 8.5.1, 8.5.3, 17.1: Change element highlight outline
   opacity from 0.7 to 0.8 in all three locations.

MAJOR:
3. Section 6.5 and 17.1: Update inspector overlay colours from
   rgb(59,130,246) to rgb(66,133,244). Fix border to
   `2px solid rgba(66,133,244,0.6)` and label background to
   `rgba(66,133,244,0.9)`.

4. Section 3.4.4 (Element Resolution): Remove the uniqueness
   verification claim. The code uses querySelector (returns first
   match) without querySelectorAll uniqueness check. Note that
   uniqueness is verified at generation time, not resolution time.

5. Section 3.4.2 (Captured Attributes): Remove the tag-conditional
   rules. The code captures all listed attributes unconditionally
   from any element.

6. Section 3.4.3 (Description Format): Rewrite to show the actual
   format: `tag#id` or `tag.firstClass` as base, with parenthetical
   attributes excluding id and class. Add note about 40-char
   truncation. Fix all examples.

7. Section 6.5 (Inspector Implementation): Change from "listeners
   attached on keydown, removed on keyup" to "all listeners registered
   once, handlers short-circuit with early return when not active".

8. Section 5.6.2 (Shadow Root Bridge): Add `__restoreHighlights`
   to the bridge table. Set by Annotator, used by Clear All.

MINOR:
9. Section 19.2: Fix tooltip text to match code:
   "Select text to annotate it, or Alt+click any element"

10. Section 9.2.1: Change "truncated to 100 chars" to "up to 200
    characters, as stored".

11. Appendix A: Remove the specific "110 scenarios" count or update
    to "12 spec files".

12. Section 7.6: Document that element click detection walks ancestors
    via findAnnotatedAncestor.

13. Section 6.2.5: Update Clear All highlight cleanup to say
    restoreHighlights is called explicitly during Clear All, not
    lazily on next restore cycle.

14. Section 5.1: Update destroy() listener list to include keyup,
    mousemove, and destroyInspector() call.

15. Various Low items from 2026-02-22 spec review:
    - Section 6.3: Clarify popup threshold (MARGIN + 200 = 208)
    - Section 14.2: Use "confirming | (not set)" for consistency
    - Section 19.2: Document 300ms fade-out timeout
    - Section 4.3: Fix heading level (### not ##)
    - Section 4.3.2: Document non-empty message validation

Update all applicable Markdown files — including
docs/reviews/2026-02-22-remaining-findings.md — to reflect the
current status of findings addressed in this session.

After implementation, commit changes.

Print the Session 4 prompt from docs/reviews/2026-02-22-remaining-findings.md
to get started on the next session.
```

### Session 4: Escape/FAB/Panel Behaviour Fixes

**Findings addressed:** REM-05, REM-13, REM-14, REM-15

```
Read the following files in the astro-inline-review repository:
- src/client/shortcuts.ts
- src/client/index.ts
- src/client/ui/fab.ts
- src/client/ui/panel.ts
- src/client/ui/popup.ts

Fix these related behaviour issues:

1. Escape propagation (shortcuts.ts): When the Escape handler
   actually closes something (popup or panel), call
   e.stopPropagation() and e.preventDefault(). When nothing is
   open to close, let the event pass through without handling it.
   Currently closeActive() is always called even when nothing is open.

2. Escape bypass (index.ts): In the closeActive handler, instead of
   manually manipulating popup CSS classes (classList.remove,
   setAttribute), call the proper hidePopup() function. This ensures
   the textarea is cleared on dismiss, preventing stale content when
   the popup reopens. The popup reference needs to be accessible to
   the closeActive handler.

3. FAB state desync (index.ts/fab.ts): When the panel is closed via
   Escape or keyboard shortcut (not via FAB click), the FAB's internal
   isOpen boolean and icon are not updated. Fix by having the
   closePanel path also update the FAB state. Either pass the FAB
   elements to closePanel, or remove the internal isOpen boolean from
   createFab and derive state from the panel's data-air-state.

4. Double fetch (panel.ts): Both refreshPanel() and updateTabCounts()
   independently call api.getStore(). Refactor so the panel refresh
   fetches once and passes the result to both functions.

Run `npm test` to verify all tests pass. Add/update tests in:
- tests/client/shortcuts.test.ts — verify stopPropagation on Escape
  when popup/panel is open
- tests/client/ui/panel.test.ts — verify single fetch per refresh

Update all applicable Markdown files — including
docs/reviews/2026-02-22-remaining-findings.md — to reflect the
current status of findings addressed in this session.

After implementation, commit changes.

Print the Session 5 prompt from docs/reviews/2026-02-22-remaining-findings.md
to get started on the next session.
```

### Session 5: Test Coverage — Remaining Gaps

**Findings addressed:** REM-40 through REM-52

```
Read the following test files for patterns:
- tests/client/selection.test.ts
- tests/client/highlights.test.ts
- tests/client/ui/panel.test.ts
- tests/mcp/tools/add-agent-reply.test.ts

And the following source files for what to test:
- src/client/selection.ts (deserializeRange function)
- src/client/ui/popup.ts
- src/shared/export.ts

1. Add deserializeRange tests (tests/client/selection.test.ts):
   - Valid XPath resolves to correct range
   - Invalid XPath returns null
   - XPath with wrong offsets returns null
   - Edge case: XPath to removed node returns null

2. Add popup.ts unit tests (tests/client/ui/popup.test.ts):
   - showPopup positions correctly (above selection by default)
   - showPopup falls back to below when not enough room above
   - showEditPopup pre-fills textarea with existing note
   - hidePopup clears textarea and hides element
   - rebuildFooter creates correct buttons for new vs edit mode

3. Add shared/export.ts direct tests (tests/shared/export.test.ts):
   - Empty store produces minimal markdown
   - Text annotations grouped by page
   - Element annotations include selector and preview
   - Resolved annotations show checkmark
   - Agent replies included in export

4. Add missing API client tests (tests/client/api.test.ts):
   - createPageNote, updatePageNote, deletePageNote, updateAnnotation

5. Configure vitest coverage thresholds (vitest.config.ts):
   Add to the root config:
   ```
   coverage: {
     provider: 'v8',
     thresholds: { lines: 70, functions: 70, branches: 60 }
   }
   ```

6. Extract shared MCP test helpers:
   Create tests/mcp/helpers/fixtures.ts with makeTextAnnotation,
   makeElementAnnotation, makePageNote helpers. Update all MCP test
   files to import from the shared helper.

Run `npm test` to verify all tests pass.

Update all applicable Markdown files — including
docs/reviews/2026-02-22-remaining-findings.md — to reflect the
current status of findings addressed in this session.

After implementation, commit changes.

Print the Session 6 prompt from docs/reviews/2026-02-22-remaining-findings.md
to get started on the next session.
```

### Session 6: UX Improvements — Error Feedback and Inspector Polish

**Findings addressed:** REM-54, REM-55, REM-56, REM-57, REM-61

```
Read the following files in the astro-inline-review repository:
- src/client/annotator.ts
- src/client/ui/panel.ts
- src/client/ui/toast.ts
- src/client/styles.ts

Make these UX improvements:

1. Surface API errors via toast (annotator.ts, panel.ts):
   In all catch blocks that currently only do console.error, also
   call showToast() with a user-friendly message. Examples:
   - "Failed to save annotation" (annotator.ts save flows)
   - "Failed to delete annotation" (panel.ts delete handler)
   - "Failed to load annotations" (panel.ts refresh)
   Keep the console.error for debugging.

2. Improve "Failed to load" message (panel.ts):
   Change the static "Failed to load annotations" to include guidance:
   "Failed to load annotations. Is the dev server running?"

3. Add unsaved changes protection (annotator.ts):
   Before dismissing the popup (in onScroll and Escape handlers),
   check if the textarea has content. If so, skip the dismiss.
   Only dismiss when the textarea is empty or the user explicitly
   clicks Cancel.

4. Clamp inspector label overflow (annotator.ts or styles.ts):
   Add max-width: 400px, overflow: hidden, text-overflow: ellipsis
   to the inspector label element.

5. Add aria-live to panel content (panel.ts):
   Set aria-live="polite" on the panel content container so screen
   readers announce when the content refreshes.

Run `npm test` to verify all tests pass.

Update all applicable Markdown files — including
docs/reviews/2026-02-22-remaining-findings.md — to reflect the
current status of findings addressed in this session.

After implementation, commit changes.

Print the Session 7 prompt from docs/reviews/2026-02-22-remaining-findings.md
to get started on the next session.
```

### Session 7: CI/CD — Lint, Coverage, and Cache

**Findings addressed:** REM-66, REM-67, REM-70, REM-71, REM-72

```
Read the CI/CD configuration files:
- .github/workflows/ci.yml
- .github/workflows/acceptance.yml
- .github/workflows/release.yml
- package.json

1. Add ESLint to the project:
   - Install eslint and @typescript-eslint as devDependencies
   - Create a minimal eslint.config.js (flat config)
   - Add "lint" script to package.json
   - Add a lint step to ci.yml after the build step

2. Add acceptance test step to release workflow:
   Either add the acceptance test steps directly to release.yml,
   or add a comment documenting that acceptance tests should be
   verified separately before publishing.

3. Cache Playwright browsers in acceptance workflow:
   Add an actions/cache step for ~/.cache/ms-playwright before
   the Playwright install step.

4. Add npm cache to acceptance workflow:
   Add cache: npm to the setup-node step with
   cache-dependency-path pointing to both lockfiles.

5. Enforce coverage thresholds in CI:
   If vitest coverage thresholds were configured in Session 5,
   the existing `npm test -- --coverage` step will enforce them.
   If not, add the thresholds to vitest.config.ts here.

Run the CI workflow locally if possible to verify.

Update all applicable Markdown files — including
docs/reviews/2026-02-22-remaining-findings.md — to reflect the
current status of findings addressed in this session.

After implementation, commit changes.

Print the Session 8 prompt from docs/reviews/2026-02-22-remaining-findings.md
to get started on the next session.
```

### Session 8: Documentation Housekeeping

**Findings addressed:** REM-73, REM-74, REM-75, REM-76

```
Read the following files in the astro-inline-review repository:
- docs/engineering-plans/2026-02-22-mcp-server.md
- docs/reviews/2026-02-21-test-quality-review.md
- README.md

1. Create tech debt backlog:
   Create docs/engineering-plans/tech-debt-backlog.md documenting
   outstanding items from previous reviews. Include:
   - N+1 delete in Clear All (IMPL-M5/REM-06)
   - Inspector overlay in light DOM (IMPL-M6/REM-10)
   - localStorage cache no invalidation (ARCH-M2/REM-12)
   - MCP tool input size limits (IMPL-H5/REM-04)
   - Panel overlaps on small viewports (UX/REM-53)
   - FAB/panel z-index overlap (UX/REM-58)
   - Keyboard shortcut conflicts with host apps (UX/REM-59)
   - Extract inspector from annotator.ts (SYS-8)
   Each item should have: description, severity, source review,
   and suggested approach.

2. Fix MCP plan metadata:
   In docs/engineering-plans/2026-02-22-mcp-server.md, change
   Session 7 status from `complete` to `completed`.

3. Track test quality review status:
   Add a "Resolution Status" section to
   docs/reviews/2026-02-21-test-quality-review.md noting that
   P0 items are in the external test repo and their status is
   unverified from this repository.

4. Handle README screenshot TODO:
   Remove the `<!-- TODO: Add screenshot/GIF here -->` comment
   from README.md. A screenshot can be added separately when one
   is available.

Update all applicable Markdown files — including
docs/reviews/2026-02-22-remaining-findings.md — to reflect the
current status of findings addressed in this session.

After implementation, commit changes.

Print the Session 9 prompt from docs/reviews/2026-02-22-remaining-findings.md
to get started on the next session.
```

### Session 9: UX Polish and Minor CI Fix

**Findings addressed:** REM-60, REM-63, REM-64, REM-65, REM-68

```
Read the following files in the astro-inline-review repository:
- src/client/ui/popup.ts
- src/client/ui/panel.ts
- src/client/ui/fab.ts
- src/client/styles.ts
- src/client/shortcuts.ts
- .github/workflows/ci.yml

Make these improvements:

1. Popup avoids open panel (REM-60):
   In popup.ts, when calculating popup position, check whether the
   panel is currently open (data-air-state="open" on the panel host).
   If the panel is open on the right side, constrain the popup's
   max-left so it doesn't render behind the panel. A simple approach:
   get the panel element's offsetLeft and ensure the popup's right
   edge stays to the left of it.

2. Keyboard shortcuts help (REM-63):
   Add a small help row at the bottom of the panel showing available
   shortcuts. This can be a simple <div> with muted text listing:
   - Cmd/Ctrl+Shift+A — Toggle panel
   - Cmd/Ctrl+Shift+E — Export to clipboard
   - Escape — Close popup/panel
   - Alt+hover — Inspect elements
   Place it after the annotation list, inside the panel footer area.

3. Tooltip ARIA attributes (REM-64):
   In fab.ts, add role="tooltip" and an id (e.g., "air-tooltip") to
   the tooltip element. Add aria-describedby="air-tooltip" to the
   FAB button so screen readers associate the two.

4. Centralise z-index values (REM-65):
   In styles.ts, create a Z_INDEX constant object:
   ```
   const Z_INDEX = {
     fab: 10000,
     panel: 9999,
     popup: 10001,
     inspector: 10002,
     toast: 10003,
   } as const;
   ```
   Replace all hard-coded z-index values in styles.ts with references
   to this object using template literals. Update any z-index values
   set directly in JS (annotator.ts inspector overlay, toast.ts) to
   import and use these constants.

5. Decouple audit from Node version (REM-68):
   In .github/workflows/ci.yml, the security audit step has a
   condition like `matrix.node-version == '22'`. Change this to
   always run (remove the condition) or use a simpler approach like
   running it only once by extracting it to a separate job that
   doesn't use the matrix.

Run `npm run build && npm test` to verify all tests pass.

Update all applicable Markdown files — including
docs/reviews/2026-02-22-remaining-findings.md — to reflect the
current status of findings addressed in this session.

After implementation, commit changes.

This is the final session. All remaining findings from
docs/reviews/2026-02-22-remaining-findings.md are now complete.
```

---

## Findings Not Included (Intentionally Deferred)

These findings were assessed as valid but not worth addressing now:

| Finding | Reason for Deferral |
|---------|-------------------|
| IMPL-M3: Module-level mutable state in toast.ts | Extremely unlikely to cause issues — single-mount assumption is valid |
| IMPL-L2: removeAllElementHighlights inefficiency | Minor performance, acceptable for dev tool |
| IMPL-L4: writeQueue error handling | All current callers await correctly |
| IMPL-L5: data-air-el inconsistently applied | Not blocking — coverage is sufficient for testing |
| IMPL-L6: CORS note not prominent | Dev-only tool, localhost only |
| UX: Popup clipped on mobile (< 320px) | Dev tool, primarily desktop use |
| UX: Inspector mode mouse-only | Fundamental design limitation, document rather than fix |
| CICD-L13: CODEOWNERS | Single-maintainer project |
| ARCH: Hidden coupling (cache key, API prefix) | Acceptable for current codebase size |
| ARCH: MCP deps installed when unused | Accepted trade-off, documented |
| SPEC: INFO-level findings | Informational, no action needed |

---

## Starting the Next Session

Use the following prompt to begin working on remaining findings:

```
Read docs/reviews/2026-02-22-remaining-findings.md in the astro-inline-review
repo. This document captures all findings from the independent reviews that
were not addressed by the comprehensive review's 10 prompts.

Continue with Session N from the Implementation Prompts section.

Current state: main branch, all tests passing, build clean.
```
