---
generated_by: Claude Opus 4.6
generation_date: 2026-02-22
model_version: claude-opus-4-6
purpose: comprehensive_review
status: draft
human_reviewer: matthewvivian
scope: [specification, implementation, documentation, tests, cicd, design, architecture]
tags: [review, comprehensive, multi-agent, quality-assurance]
review_agents:
  - spec-reviewer
  - impl-reviewer
  - docs-reviewer
  - test-reviewer
  - cicd-reviewer
  - design-reviewer
  - arch-reviewer
---

# Comprehensive Review — astro-inline-review

**Date:** 2026-02-22
**Method:** Parallel multi-agent review across 7 dimensions
**Repositories:** `astro-inline-review`, `astro-inline-review-tests`

## Executive Summary

astro-inline-review is a well-architected, dev-only Astro integration with clean separation of concerns across client, server, and MCP layers. The codebase is mature for its stage (~7,000 lines of TypeScript across source and tests) with comprehensive documentation, a thorough specification, and good test infrastructure.

**Overall health: Good — with targeted improvements needed in accessibility, concurrency safety, and test coverage.**

### Key Metrics

| Dimension | Critical | High | Medium | Low | Info | Total |
|-----------|----------|------|--------|-----|------|-------|
| Specification | 0 | 3 | 8 | 6 | 4 | 21 |
| Implementation | 3 | 5 | 10 | 7 | 5 | 30 |
| Documentation | 0 | 1 | 5 | 6 | 4 | 16 |
| Tests | 1 | 4 | 8 | 3 | 1 | 17 |
| CI/CD | 0 | 1 | 5 | 9 | 2 | 17 |
| Design & UX | 2 | 7 | 8 | 6 | 4 | 27 |
| Architecture | 0 | 0 | 4 | 5 | 7 | 16 |
| **Totals** | **6** | **21** | **48** | **42** | **27** | **144** |

### Top Priorities

1. **Read-modify-write race condition** (Critical, Implementation + Architecture) — Storage mutations are not atomic, risking data loss during concurrent access
2. **Accessibility gaps** (Critical, Design) — No focus trap in popup, panel lacks ARIA semantics, no `prefers-reduced-motion` support
3. **Core module untested** (Critical, Tests) — `annotator.ts` (577 lines, the central controller) has zero unit tests
4. **XSS risk from `innerHTML` patterns** (Critical, Implementation) — Multiple `innerHTML` usages normalise an unsafe pattern
5. **Specification drift** (High, Specification) — Three High findings where spec doesn't match implementation

---

## 1. Specification Review

**Individual report:** [2026-02-22-review-specification.md](./2026-02-22-review-specification.md)

### Critical and High Findings

| ID | Severity | Finding | Files |
|----|----------|---------|-------|
| SPEC-H1 | High | `BaseAnnotation.type` field present in code but missing from spec | `src/shared/types.ts:16`, spec §3.2.1 |
| SPEC-H2 | High | `refreshPanel` is `Promise<void>` in code but `void` in spec | `src/client/mediator.ts:7`, spec §5.6.2 |
| SPEC-H3 | High | Spec says panel shows CSS selector for elements; code shows description | `src/client/ui/panel.ts:374`, spec §6.2.3a |

### Medium Findings

| ID | Finding |
|----|---------|
| SPEC-M1 | Contradictory FAB badge count description between §6.1 and §6.2.1 |
| SPEC-M2 | Resolved annotation green highlight styling not documented in spec |
| SPEC-M3 | 5 `data-air-el` values missing from automation contract table |
| SPEC-M4 | 1MB body size limit and 413 status code undocumented |
| SPEC-M5 | Dual export implementations risk divergence (shared vs client) |
| SPEC-M6 | `addPageNote` shortcut bypasses FAB icon sync |
| SPEC-M7 | Client doesn't use `GET /export` endpoint despite spec claiming it does |
| SPEC-M8 | `PanelCallbacks` interface incomplete in callback injection table |

---

## 2. Implementation Review

**Individual report:** [2026-02-22-review-implementation.md](./2026-02-22-review-implementation.md)

### Critical Findings

| ID | Severity | Finding | Files |
|----|----------|---------|-------|
| IMPL-C1 | Critical | XSS risk — `innerHTML` used in panel with template strings, normalising unsafe patterns | `panel.ts:240-241, 201, 268-269` |
| IMPL-C2 | Critical | Race condition — MCP tools read-then-write without transactional locking | `resolve-annotation.ts:10-24`, `add-agent-reply.ts:17-35` |
| IMPL-C3 | Critical | Race condition — same pattern in REST middleware (all mutation endpoints) | `middleware.ts:52-84, 88-101, 103-111` |

### High Findings

| ID | Finding | Files |
|----|---------|-------|
| IMPL-H1 | Dead code: `scrollToAnnotation` in annotator never called | `annotator.ts:520-535` |
| IMPL-H2 | Client export duplicates shared export with drift risk | `client/export.ts` vs `shared/export.ts` |
| IMPL-H3 | No input validation on REST POST endpoints (accepts any JSON shape) | `middleware.ts:52-84` |
| IMPL-H4 | `existsSync` then async `readFile` is a TOCTOU race | `storage.ts:22-24` |
| IMPL-H5 | No size limit on MCP tool string inputs | `add-agent-reply.ts:49` |

### Notable Medium Findings

- **M4**: Escape handler doesn't stop propagation when handling the event
- **M5**: "Clear All" makes N sequential API calls (no bulk endpoint)
- **M6**: Inspector overlay in light DOM, inconsistent with shadow DOM pattern
- **M7**: `SerializedSelection` type defined twice (client + shared)
- **M8**: `generateId()` uses `Math.random()`, not `crypto.randomUUID()`

---

## 3. Documentation & Plans Review

**Individual report:** [2026-02-22-review-documentation.md](./2026-02-22-review-documentation.md)

### Key Findings

| ID | Severity | Finding |
|----|----------|---------|
| DOCS-H1 | High | CLAUDE.md missing `resolvedAt`, `replies` fields and annotation dismissal feature |
| DOCS-M1 | Medium | Agent-prompt-export plan status unclear — likely superseded by MCP |
| DOCS-M2 | Medium | Spec Review Round 3 critical findings may not be fully addressed |
| DOCS-M3 | Medium | Outstanding tech debt from system review has no tracking mechanism |
| DOCS-M4 | Medium | Test quality review P0 recommendations not tracked |

### Positive Findings

- README is accurate and well-written
- MCP guides are comprehensive and match implementation
- Engineering plans follow consistent format with good session boundaries
- All key file paths in CLAUDE.md verified correct

---

## 4. Test Coverage & Quality Review

**Individual report:** [2026-02-22-review-tests.md](./2026-02-22-review-tests.md)

**Current state:** 161 tests passing across 18 files (3 environments)

### Critical Gap

| Module | Lines | Status | Impact |
|--------|-------|--------|--------|
| `annotator.ts` | 577 | **Zero tests** | Core orchestrator — selection, highlights, inspector, popup, API |
| `element-selector.ts` | 210 | **Zero tests** | CSS selector generation, element resolution |
| `popup.ts` | 243 | **Zero tests** | Popup positioning, show/hide, button management |

### Other High Gaps

| ID | Finding |
|----|---------|
| TEST-H1 | No `deserializeRange` tests (primary highlight restoration path) |
| TEST-H2 | No Unicode edge case tests for selection |
| TEST-H3 | No special character tests for annotation IDs (path traversal) |
| TEST-H4 | Orphan detection logic in `index.ts` only tested via mocks |

### Medium Gaps

- No vitest coverage thresholds configured
- No timeout configuration for MCP integration tests
- API test coverage thin (5 of 8 methods tested)
- `shared/export.ts` has no direct unit tests
- Test helpers (`makeTextAnnotation`) duplicated across MCP test files

---

## 5. CI/CD Pipeline Review

**Individual report:** [2026-02-22-review-cicd.md](./2026-02-22-review-cicd.md)

### Key Findings

| ID | Severity | Finding |
|----|----------|---------|
| CICD-H1 | High | No Dependabot/Renovate for dependency updates |
| CICD-M1 | Medium | Node matrix includes EOL Node 18, skips Node 20 LTS |
| CICD-M2 | Medium | No ESLint or Prettier in CI |
| CICD-M3 | Medium | No `permissions` blocks on workflows (overly broad defaults) |
| CICD-M4 | Medium | Acceptance tests don't run on PRs (only push to main) |
| CICD-M5 | Medium | Release workflow doesn't run acceptance tests |

### Quick Wins (Low Effort)

- Add concurrency controls to prevent duplicate runs
- Add job-level timeouts (currently defaults to 6 hours)
- Add `.node-version` file and `engines` field
- Cache Playwright browsers in acceptance workflow
- Add CODEOWNERS file

---

## 6. UI/UX Design & Accessibility Review

**Individual report:** [2026-02-22-review-design.md](./2026-02-22-review-design.md)

### Critical Findings

| ID | Finding | WCAG |
|----|---------|------|
| UX-C1 | Panel lacks landmark role (`role="dialog"` or `role="complementary"`, `aria-label`) | 4.1.2 |
| UX-C2 | No focus trap in popup — users can Tab into underlying page | 2.4.3, 2.1.2 |

### High Findings

| ID | Finding |
|----|---------|
| UX-H1 | Tabs lack WAI-ARIA tab pattern (`role="tablist"`, `role="tab"`, `aria-selected`) |
| UX-H2 | Popup lacks dialog semantics (`role="dialog"`, `aria-modal`) |
| UX-H3 | Panel has no focus management (no focus on open, no return on close) |
| UX-H4 | Annotation items not keyboard-navigable (no `tabindex`, no key handlers) |
| UX-H5 | No `prefers-reduced-motion` support for any animations |
| UX-H6 | Save button contrast fails WCAG AA (`#fff` on `#D97706` ≈ 3.0:1) |
| UX-H7 | Delete buttons have no confirmation (inconsistent with "Clear All") |

### Text Selection UX Issue

The popup dismisses on any scroll event, losing unsaved note text. Consider adding a scroll threshold or fixing popup position relative to viewport.

---

## 7. Architecture Review

**Individual report:** [2026-02-22-review-architecture.md](./2026-02-22-review-architecture.md)

### Key Findings

| ID | Severity | Finding |
|----|----------|---------|
| ARCH-M1 | Medium | Cross-process race between MCP server and browser middleware |
| ARCH-M2 | Medium | localStorage cache has no invalidation strategy |
| ARCH-M3 | Medium | Export logic duplicated across client and shared modules |
| ARCH-M4 | Medium | JSON storage: no file locking, silent data loss on parse errors |

### Strengths Identified

- Clean separation with acyclic dependency graph
- Dev-only enforcement is robust (single guard, no secondary paths)
- Three-bundle tsup config correctly maps to three runtime contexts
- Type sharing chain is well-structured
- MCP tool registration pattern is clean and extensible
- Good extension points for new tools and annotation types

---

## Cross-Cutting Themes

Several findings appear across multiple review dimensions:

### Theme 1: Read-Modify-Write Race Condition
- **Implementation** (C2, C3): Both MCP and REST endpoints read-then-write without locking
- **Architecture** (M1): Cross-process races between browser and MCP server
- **Tests** (no coverage): No concurrent access tests exist

### Theme 2: Export Logic Duplication
- **Specification** (M5): Spec acknowledges identical output but not dual implementation
- **Implementation** (H2): Two files with ~100 lines of identical logic
- **Architecture** (M3): Build boundary makes sharing non-obvious, but it's possible

### Theme 3: Accessibility Deficit
- **Design** (C1, C2, H1-H7): Comprehensive ARIA, focus, and motion gaps
- **Specification**: No accessibility requirements section
- **Tests**: No accessibility tests

### Theme 4: Test Coverage of Core Logic
- **Tests** (Critical): `annotator.ts`, `element-selector.ts`, `popup.ts` untested
- **Implementation**: These are the most complex modules in the codebase
- **Architecture**: The annotator is the central controller — its correctness is assumed

---

## Prioritised Action Plan

### Priority 1: Safety & Correctness (Critical)

#### 1.1 Fix read-modify-write race condition

Add a transactional `mutate()` method to `ReviewStorage` that serialises read-modify-write operations:

```
File: src/server/storage.ts
Add: async mutate(fn: (store: ReviewStore) => ReviewStore | Promise<ReviewStore>): Promise<ReviewStore>
```

Update all mutation endpoints in `middleware.ts` and MCP tools to use `mutate()` instead of separate `read()` → modify → `write()`.

#### 1.2 Replace innerHTML patterns

Replace all `innerHTML` assignments in `panel.ts` with DOM API calls (`createElement`, `textContent`, `appendChild`). This prevents future contributors from following the pattern with user-controlled data.

#### 1.3 Add input validation to REST POST endpoints

Add validation (Zod or manual) to POST `/annotations` and POST `/page-notes` to reject malformed payloads before they reach storage.

### Priority 2: Accessibility (High)

#### 2.1 Add ARIA semantics

- Panel: `role="complementary"`, `aria-label="Inline Review Panel"`
- Popup: `role="dialog"`, `aria-modal="true"`, `aria-label`
- Tabs: Full WAI-ARIA tabs pattern
- Toast: `role="status"`, `aria-live="polite"`
- Badge: `aria-live="polite"` or dynamic `aria-label`

#### 2.2 Implement focus management

- Focus trap in popup (Tab cycles through textarea + buttons)
- Panel: move focus on open, return to FAB on close
- Annotation items: `tabindex="0"`, Enter/Space activation

#### 2.3 Add prefers-reduced-motion support

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

Plus JS checks in `highlights.ts` pulse functions.

#### 2.4 Fix colour contrast

- Save button: darken background to `#92400E` or use dark text on amber
- Empty state text: lighten from `#666` to `#999`
- Timestamps: increase from `#888` to `#aaa`

### Priority 3: Test Coverage (High)

#### 3.1 Add annotator.ts unit tests

Cover: text selection → save, element click → save, highlight click → edit, restore highlights (all 3 tiers), destroy cleanup.

#### 3.2 Add element-selector.ts tests

Test all 4 CSS selector strategies, `resolveElement` fallback chain, `generateDescription`.

#### 3.3 Add deserializeRange tests

Test the primary highlight restoration path (Tier 1).

#### 3.4 Configure coverage thresholds

Add to `vitest.config.ts`:
```ts
coverage: {
  provider: 'v8',
  thresholds: { lines: 70, functions: 70, branches: 60 }
}
```

### Priority 4: Specification Accuracy (High)

#### 4.1 Fix data model

- Add `type: 'text' | 'element'` to `BaseAnnotation` in spec §3.2.1
- Fix `refreshPanel` return type to `Promise<void>` in spec §5.6.2
- Fix element annotation display text (description not CSS selector) in spec §6.2.3a

#### 4.2 Document new features

- Add resolved highlight colours to spec §8.1, §8.5.1, and colour palette §17.1
- Add missing `data-air-el` values to automation contract §14.1
- Add missing panel callbacks to §5.6.1
- Document 1MB body limit and 413 in §4.2.4

### Priority 5: CI/CD Hardening (Medium)

#### 5.1 Add Dependabot

Create `.github/dependabot.yml` for both npm and GitHub Actions dependencies.

#### 5.2 Update Node matrix

Replace `[18, 22]` with `[20, 22]` (drop EOL 18, add current LTS).

#### 5.3 Add workflow permissions

Add `permissions: contents: read` to all workflows.

#### 5.4 Enable acceptance tests on PRs

Add `pull_request` trigger to `acceptance.yml`.

### Priority 6: Documentation (Medium)

#### 6.1 Update CLAUDE.md

Add `resolvedAt`, `replies` to schema section. Mention annotation dismissal feature.

#### 6.2 Clarify plan statuses

Mark agent-prompt-export as `deferred` (superseded by MCP). Fix metadata inconsistencies.

#### 6.3 Create tech debt tracking

Document outstanding items from previous reviews in `docs/engineering-plans/tech-debt-backlog.md`.

### Priority 7: Code Quality (Medium-Low)

#### 7.1 Unify export logic

Have client import from `shared/export.ts` via the build config's `noExternal` setting.

#### 7.2 Remove dead code

Delete `scrollToAnnotation` from `annotator.ts:520-535`.

#### 7.3 Add atomic writes

Write to temp file + rename in `ReviewStorage.write()`.

#### 7.4 Add delete confirmation

Add two-click confirmation to individual annotation delete buttons (matching "Clear All" pattern).

---

## Implementation Prompts

Below are ready-to-use prompts for independent AI agents to implement each recommendation.

### Prompt 1: Fix Read-Modify-Write Race Condition — ✅ Implemented

```
Read src/server/storage.ts in the astro-inline-review repository.

Add a new async method `mutate(fn)` to the ReviewStorage class that:
1. Queues behind the existing writeQueue
2. Reads the store from disk
3. Calls `fn(store)` to get the modified store
4. Writes the modified store back to disk
5. Returns the modified store

Then update ALL mutation endpoints in src/server/middleware.ts to use
`storage.mutate()` instead of separate `storage.read()` + `storage.write()`.

Also update src/mcp/tools/resolve-annotation.ts and
src/mcp/tools/add-agent-reply.ts to use `storage.mutate()`.

Run `npm test` to verify all tests pass after the change.

Files to modify:
- src/server/storage.ts (add mutate method)
- src/server/middleware.ts (refactor all POST/PATCH/DELETE handlers)
- src/mcp/tools/resolve-annotation.ts (use mutate)
- src/mcp/tools/add-agent-reply.ts (use mutate)

Add a unit test for the new mutate method in tests/server/storage.test.ts
that verifies concurrent mutate calls are serialised correctly.

After implementation, check that any relevant documentation and plan
files are updated (CLAUDE.md, docs/spec/specification.md, engineering
plans in docs/). Commit all changes and push.
```

### Prompt 2: Replace innerHTML with DOM API — ✅ Implemented

```
Read src/client/ui/panel.ts in the astro-inline-review repository.

Find all instances of `innerHTML` assignment and replace them with
equivalent DOM API calls using createElement, textContent, and appendChild.

Specific locations to fix:
- Line ~186: content.innerHTML = '' (replace with while loop removing children)
- Line ~201: "Failed to load annotations" (create div + text node)
- Line ~240-241: Empty state HTML with arrow (create elements programmatically)
- Line ~268-269: Any other innerHTML assignments

Also check src/client/ui/fab.ts:38 where innerHTML swaps the SVG icon.
Replace with a stable icon container that swaps just the SVG content.

Run `npm test` to verify all tests pass. Pay special attention to
tests/client/ui/panel.test.ts and tests/client/ui/fab.test.ts.

After implementation, check that any relevant documentation and plan
files are updated (CLAUDE.md, docs/spec/specification.md, engineering
plans in docs/). Commit all changes and push.
```

### Prompt 3: Add REST API Input Validation — ✅ Implemented

```
Read src/server/middleware.ts in the astro-inline-review repository.

The POST /annotations and POST /page-notes endpoints accept arbitrary
JSON. Add validation to reject malformed payloads.

For POST /annotations, validate:
- body.type is 'text' or 'element' (return 400 if invalid)
- body.pageUrl is a string
- body.note is a string
- When type='text': body.selectedText is a string, body.range is an object
- When type='element': body.elementSelector is an object

For POST /page-notes, validate:
- body.pageUrl is a string
- body.note is a string

Return 400 with descriptive error messages for validation failures.

Add corresponding tests in tests/server/middleware.test.ts:
- Test that invalid type values return 400
- Test that missing required fields return 400
- Test that valid payloads still work

Run `npm test` to verify.

After implementation, check that any relevant documentation and plan
files are updated (CLAUDE.md, docs/spec/specification.md, engineering
plans in docs/). Commit all changes and push.
```

### Prompt 4: Add ARIA Semantics and Focus Management — ✅ Implemented

```
Read the following files in astro-inline-review:
- src/client/ui/panel.ts
- src/client/ui/popup.ts
- src/client/ui/fab.ts
- src/client/ui/toast.ts
- src/client/styles.ts
- src/client/index.ts

Add ARIA accessibility attributes:

1. Panel (panel.ts):
   - Add role="complementary" and aria-label="Inline Review Panel" to container
   - Add WAI-ARIA tabs pattern to the tab buttons:
     role="tablist" on tabs container, role="tab" on buttons,
     role="tabpanel" on content, aria-selected on active tab
   - Make annotation items keyboard-navigable: add tabindex="0"
     and keydown handler for Enter/Space

2. Popup (popup.ts):
   - Add role="dialog", aria-modal="true", aria-label="Add annotation"
   - Implement focus trap: Tab cycles through textarea and buttons only
   - On dismiss, return focus to triggering element

3. FAB (fab.ts):
   - Update aria-label to include count: "Toggle inline review (N annotations)"

4. Toast (toast.ts):
   - Add role="status" and aria-live="polite"

5. Focus management (index.ts):
   - On panel open: move focus to first focusable element in panel
   - On panel close: return focus to FAB

6. Styles (styles.ts):
   - Add prefers-reduced-motion media query

Run `npm test` to verify existing tests pass.

After implementation, check that any relevant documentation and plan
files are updated (CLAUDE.md, docs/spec/specification.md, engineering
plans in docs/). Commit all changes and push.
```

### Prompt 5: Add annotator.ts Unit Tests

```
Read src/client/annotator.ts in the astro-inline-review repository.
Also read tests/client/highlights.test.ts and tests/client/selection.test.ts
for examples of how the test environment is set up.

Create tests/client/annotator.test.ts with tests covering:

1. Text selection flow:
   - onMouseUp with valid selection creates popup
   - onMouseUp with whitespace-only selection is ignored
   - onMouseUp inside shadow DOM host is ignored

2. Element annotation flow:
   - Alt+click on element captures selector and shows popup
   - Inspector overlay appears/disappears with Alt key

3. Save flows:
   - handleSave creates annotation via API and applies highlight
   - handleElementSave creates element annotation via API

4. Edit flows:
   - Clicking highlight shows popup with existing note
   - Saving edit updates annotation via API

5. Restore highlights:
   - restoreHighlights applies marks for all page annotations
   - Three-tier fallback: XPath success, context match, orphan

6. Lifecycle:
   - destroy() removes all event listeners

Mock the following:
- api module (getStore, createAnnotation, updateAnnotation, deleteAnnotation)
- popup module (showPopup, hidePopup)
- highlights module (applyHighlight, removeHighlight)
- cache module (readCache, writeCache)

Use the happy-dom environment (vitest project 'client').

Run `npm test` to verify.

After implementation, check that any relevant documentation and plan
files are updated (CLAUDE.md, docs/spec/specification.md, engineering
plans in docs/). Commit all changes and push.
```

### Prompt 6: Add element-selector.ts Unit Tests

```
Read src/client/element-selector.ts in the astro-inline-review repository.

Create tests/client/element-selector.test.ts with tests covering:

1. buildElementSelector():
   - Element with unique ID generates #id selector
   - Element with data-testid generates [data-testid="value"] selector
   - Element with classes generates tag.class selector
   - Fallback to positional selector (parent > tag:nth-child)
   - Generates human-readable description

2. resolveElement():
   - Resolves by CSS selector (primary)
   - Falls back to XPath when CSS fails
   - Returns null when neither works

3. Edge cases:
   - Elements with special characters in class names (CSS.escape)
   - Elements with no ID, no testid, no classes
   - Deeply nested elements
   - SVG elements

Use the happy-dom environment.
Run `npm test` to verify.

After implementation, check that any relevant documentation and plan
files are updated (CLAUDE.md, docs/spec/specification.md, engineering
plans in docs/). Commit all changes and push.
```

### Prompt 7: Update Specification — ✅ Implemented

```
Read docs/spec/specification.md in the astro-inline-review repository.
Also read src/shared/types.ts, src/client/mediator.ts, and
src/client/ui/panel.ts for the current implementation.

Make the following corrections:

1. Section 3.2.1 (BaseAnnotation): Add `type: 'text' | 'element'` field

2. Section 5.6.2 (Typed Mediator): Change refreshPanel return type
   from `void` to `Promise<void>`

3. Section 6.2.3a (Element Annotation Items): Change "CSS selector"
   to "description" — the panel shows elementSelector.description,
   not elementSelector.cssSelector

4. Section 6.1 vs 6.2.1: Fix badge count contradiction — both should
   say "all annotations (text + element, not page notes)"

5. Section 8.1/8.5.1: Add resolved annotation green styling
   - Text: rgba(34,197,94,0.2) background
   - Element: 2px dashed rgba(34,197,94,0.5) outline

6. Section 14.1: Add missing data-air-el values:
   panel-content, resolved-badge, agent-reply, first-use-tooltip, empty-arrow

7. Section 4.2.4: Add 413 status code row, document 1MB body limit

8. Section 5.6.1: Add onAnnotationDelete, isAnnotationOrphaned,
   and onExport to callback injection table

9. Section 5.5: Remove GET /export from "endpoints used by client" —
   client generates markdown locally

10. Section 17.1 (colour palette): Add resolved highlight colours

After implementation, check that any relevant documentation and plan
files are updated (CLAUDE.md, engineering plans in docs/). Commit all
changes and push.
```

### Prompt 8: Configure CI/CD Improvements

```
Read .github/workflows/ci.yml, .github/workflows/acceptance.yml,
and .github/workflows/release.yml in the astro-inline-review repository.

Make the following changes:

1. Create .github/dependabot.yml:
   - Weekly npm dependency updates
   - Weekly GitHub Actions updates
   - Limit to 10 open PRs

2. Update ci.yml:
   - Change node-version matrix from [18, 22] to [20, 22]
   - Add permissions: contents: read at job level
   - Add concurrency group to cancel duplicate runs
   - Add timeout-minutes: 15 to the job

3. Update acceptance.yml:
   - Add pull_request trigger for main branch
   - Add permissions: contents: read
   - Add cache: npm to setup-node step
   - Add concurrency group
   - Add timeout-minutes: 20

4. Update release.yml:
   - Add permissions: contents: read
   - Move inputs.version to env variable (avoid shell injection)
   - Add timeout-minutes: 15

5. Create .node-version file containing: 22

6. Add to package.json:
   "engines": { "node": ">=20" }

After implementation, check that any relevant documentation and plan
files are updated (CLAUDE.md, engineering plans in docs/). Commit all
changes and push.
```

### Prompt 9: Update CLAUDE.md and Documentation

```
Read CLAUDE.md in the astro-inline-review repository root.

1. Update the Schema section to add these fields to the annotation example:
   "resolvedAt": "ISO 8601 (optional)",
   "replies": [{ "message": "string", "createdAt": "ISO 8601" }]

2. Add a brief note about annotation dismissal to the Architecture section:
   mention that the panel includes per-annotation delete buttons and
   orphan indicators for annotations whose target elements have changed.

3. Read docs/engineering-plans/2026-02-22-agent-prompt-export.md
   Update its frontmatter status to: deferred
   Add: superseded_by: docs/engineering-plans/2026-02-22-mcp-server.md
   Add a note at the top explaining MCP provides a more powerful
   agent integration path.

4. Read docs/engineering-plans/2026-02-22-annotation-dismissal.md
   Add to frontmatter: implementation_tracking: completed

5. Read docs/engineering-plans/2026-02-22-export-button.md
   Add to frontmatter: implementation_tracking: completed

6. Read docs/reviews/2026-02-22-mcp-design-review.md
   Update frontmatter status from draft to resolved

Commit all changes and push.
```

### Prompt 10: Add Delete Confirmation and Scroll Threshold

```
Read src/client/ui/panel.ts in the astro-inline-review repository.
Focus on the annotation delete button and the "Clear All" confirmation pattern.

1. Add a two-click confirmation to individual delete buttons,
   matching the "Clear All" pattern:
   - First click: button text changes to "Sure?" with red background
   - Second click within 3 seconds: executes delete
   - After 3 seconds: reverts to original state
   Use the same data-air-state="confirming" pattern as clearAll.

2. Read src/client/annotator.ts.
   In the onScroll handler (around line 129-135), instead of immediately
   dismissing the popup, only dismiss if the user has scrolled more than
   50px from the popup's original position. Track the initial scrollY
   when the popup is shown and compare against current scrollY.

Run `npm test` to verify all tests pass.
Update tests/client/ui/panel.test.ts to add tests for the new
delete confirmation behaviour.

After implementation, check that any relevant documentation and plan
files are updated (CLAUDE.md, docs/spec/specification.md, engineering
plans in docs/). Commit all changes and push.
```

---

## Starting the Next Session

Use the following prompt to begin the next implementation session. Replace `N` with the prompt number you want to work on.

```
Read docs/reviews/2026-02-22-comprehensive-review.md in the astro-inline-review
repo. This is a consolidated review with prioritised findings.

Prompt 1 (race condition fix) is already implemented. Continue with
Prompt N from the Implementation Prompts section.

Current state: main branch, all 192 tests passing, build clean.
```

---

## Individual Review Reports

Full details for each dimension are available in these individual reports:

1. [Specification Review](./2026-02-22-review-specification.md) — 21 findings
2. [Implementation Review](./2026-02-22-review-implementation.md) — 30 findings
3. [Documentation Review](./2026-02-22-review-documentation.md) — 16 findings
4. [Test Coverage Review](./2026-02-22-review-tests.md) — 17 findings
5. [CI/CD Pipeline Review](./2026-02-22-review-cicd.md) — 17 findings
6. [Design & Accessibility Review](./2026-02-22-review-design.md) — 27 findings
7. [Architecture Review](./2026-02-22-review-architecture.md) — 16 findings
