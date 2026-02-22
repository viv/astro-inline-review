# Test Coverage and Quality Review

**Date:** 2026-02-22
**Reviewer:** test-reviewer agent
**Repository:** astro-inline-review
**Test Framework:** Vitest 3.2.4
**Test Status:** All 161 tests passing (18 test files)

---

## Executive Summary

The test suite is well-structured with good coverage of core functionality across three environment-specific projects (client/happy-dom, server/node, mcp/node). The MCP integration tests are notably thorough, including a full end-to-end workflow test. However, there are significant coverage gaps in several untested modules, missing edge case coverage, and no tests for the most complex client module (annotator.ts).

---

## 1. Vitest Configuration

**File:** `vitest.config.ts`

| Finding | Severity |
|---------|----------|
| Configuration is clean and well-organised with three test projects | **Info** |
| `globals: true` at root level may not apply to workspace projects — each project should set it independently | **Low** |
| No coverage configuration (`--coverage` flag, thresholds, reporters) | **Medium** |
| No timeout configuration — MCP server integration tests (195–482ms each) may be fragile on slow CI | **Medium** |

**Details:**

The three-project setup (client/happy-dom, server/node, mcp/node) correctly isolates environments. The `globals: true` is set at the root but vitest workspace projects don't always inherit root-level test config. Each project block should explicitly set `globals: true` if relying on it.

No coverage thresholds are configured, meaning coverage can degrade silently. Adding `coverage: { provider: 'v8', thresholds: { lines: 70 } }` would protect against regression.

---

## 2. Unit Test Coverage Gaps

### Critical — Completely Untested Modules

| Module | Lines | Severity | Impact |
|--------|-------|----------|--------|
| `src/client/annotator.ts` | 577 | **Critical** | Core orchestrator — selection detection, element annotation, inspector overlay, popup display, highlight injection, API persistence. The most complex module with zero unit tests. |
| `src/client/element-selector.ts` | 210 | **High** | CSS selector generation, element resolution, description generation. Four distinct strategies for selector generation, none tested. |
| `src/client/ui/popup.ts` | 243 | **High** | Popup positioning, show/hide/edit modes, footer button rebuilding. UI-critical with positioning logic. |
| `src/client/ui/host.ts` | 33 | **Medium** | Shadow DOM host creation, idempotency guard, style injection. |
| `src/client/ui/toast.ts` | 31 | **Low** | Toast show/dismiss — simple but auto-dismiss timer logic is testable. |
| `src/client/styles.ts` | 458 | **Info** | CSS template strings — testing would be low value. |
| `src/client/index.ts` | 187 | **Medium** | Client entry point — bootstraps all components, registers shortcuts, sets up mediator. Integration-level testing needed. |
| `src/index.ts` | 49 | **Medium** | Astro integration entry point — `astro:config:setup` hook, Vite plugin registration. |
| `src/shared/export.ts` | 100 | **Medium** | Server-side export markdown generation — nearly identical to client export but never tested directly. |

### Analysis: annotator.ts (Critical Gap)

`annotator.ts` is the central controller with these untested flows:
- **Text selection detection** (`onMouseUp`) — ignore clicks in shadow DOM, ignore whitespace, handle existing highlights
- **Inspector mode** (`onKeyDown`, `onKeyUp`, `onMouseMove`) — Alt+hover element inspection
- **Alt+click element annotation** (`onClickCapture`) — capture phase, prevent default, build selector
- **Save flows** (`handleSave`, `handleElementSave`) — API calls, highlight application, fallback range matching
- **Edit flows** (`handleHighlightClick`, `handleElementHighlightClick`) — popup display, update/delete
- **Highlight restoration** (`restoreHighlights`) — three-tier fallback (XPath, context, orphan)
- **Scroll to annotation** (`scrollToAnnotation`) — text marks + element highlights
- **Event listener cleanup** (`destroy`) — 6 event listeners registered/unregistered

This module has the highest complexity and the most user-facing behaviour in the codebase. Its absence from the test suite is the single most critical gap.

### Analysis: element-selector.ts (High Gap)

Four CSS selector strategies are untested:
1. `#id` — basic but needs uniqueness check
2. `[data-testid]` — data attribute lookup
3. `tag.class` combo — multi-class joining with CSS.escape
4. Positional `parent > tag:nth-child(n)` — tree walking

The `resolveElement` function (CSS → XPath → null fallback) and `generateDescription` are also untested. These are critical for element annotation accuracy.

---

## 3. Test Quality Assessment

### Strengths

| Area | Assessment |
|------|------------|
| **Behaviour-focused** | Tests verify observable behaviour (DOM output, API responses), not implementation details. Well-named tests describe what should happen. |
| **Isolation** | Each test file uses `beforeEach` to reset state. Server tests use temp directories. Client tests clear `document.body.innerHTML`. |
| **MCP integration tests** | The `server.test.ts` file spawns a real MCP server process and exercises the full JSON-RPC protocol. The end-to-end workflow test (`list → resolve → reply → export`) is excellent. |
| **Security tests** | PATCH field allowlist tests verify that `id`, `selectedText`, `pageUrl` cannot be overwritten — good defensive testing. Request body size limit (413) is tested. |
| **Error paths** | Tests cover corrupted JSON, invalid schema, non-existent IDs, missing params. |

### Weaknesses

| Area | Severity | Details |
|------|----------|---------|
| **No negative/boundary tests for selection** | **Medium** | `serializeRange` lacks tests for: empty ranges, collapsed ranges, ranges spanning >3 elements, ranges in iframes, ranges in SVG content. |
| **Middleware mock fidelity** | **Medium** | `mockRequest` and `mockResponse` in `middleware.test.ts` are minimal — they don't emulate stream backpressure, chunked transfer, or error events. The `on()` method fires synchronously, which doesn't match real Node.js streams. |
| **API test coverage is thin** | **Medium** | `api.test.ts` only tests 5 of 8 API methods. Missing: `createPageNote`, `updatePageNote`, `deletePageNote`, `updateAnnotation`. |
| **Client export vs shared export** | **Low** | `generateExportMarkdown` is tested in `tests/client/export.test.ts` but the nearly-identical `src/shared/export.ts` → `generateExport` has no direct tests. Server export is indirectly tested via middleware, but the shared function isn't tested in isolation. |
| **No tests for `deserializeRange`** | **Medium** | `selection.test.ts` tests `serializeRange` and `findRangeByContext` but not `deserializeRange`. This is the primary restore path (Tier 1). |
| **No tests for `resolveXPath`** | **Medium** | XPath resolution is tested implicitly through `findRangeByContext` but the function itself has no dedicated tests. |

---

## 4. Edge Cases — Missing Boundary Tests

### High Priority

| Missing Test | Module | Severity |
|-------------|--------|----------|
| Unicode text selection (emoji, CJK, RTL, combining characters) | `selection.ts` | **High** |
| Very long annotation notes (>10KB text) | `middleware.ts` | **Medium** |
| Special characters in annotation IDs (path traversal: `../`, URL-encoded) | `middleware.ts` | **High** |
| Concurrent read/write from multiple browser tabs | `storage.ts` | **Medium** |
| Empty/whitespace-only pageUrl or pageTitle | `middleware.ts` | **Medium** |
| Annotations with all optional fields missing (no note, no replies, no resolvedAt) | `export.ts` | **Low** |
| Store file with hundreds of annotations (performance) | `storage.ts` | **Medium** |
| CSS selector with special characters (backticks, quotes, brackets) | `element-selector.ts` | **High** |
| Annotation ID with CSS selector meta-characters in `getHighlightMarks` (the `CSS.escape` call) | `highlights.ts` | **Medium** |

### Medium Priority

| Missing Test | Module | Severity |
|-------------|--------|----------|
| `findRangeByContext` with very long document (>1MB of text) | `selection.ts` | **Medium** |
| Multiple annotations on same text range | `highlights.ts` | **Medium** |
| Highlight applied to text that subsequently has innerHTML modified | `highlights.ts` | **Medium** |
| Page notes with empty note string | `middleware.ts` | **Low** |
| `serializeRange` when range container is not a text node | `selection.ts` | **Medium** |
| Keyboard shortcuts when ContentEditable element is focused | `shortcuts.ts` | **Low** |
| Badge count exceeding display width (999+) | `fab.ts` | **Low** |

---

## 5. Mock Quality

| Mock | Quality | Notes |
|------|---------|-------|
| `globalThis.fetch` in `api.test.ts` | **Good** | Uses `vi.spyOn` with realistic `Response` objects. |
| `api` module mock in `panel.test.ts` | **Good** | Module-level mock prevents real fetch calls. Returns realistic store shapes. |
| `mockRequest`/`mockResponse` in `middleware.test.ts` | **Adequate** | Functional but simplified — synchronous event emission differs from real streams. Missing `headers` method on response. |
| `ReviewMediator` mock in `panel.test.ts` | **Good** | Properly mocked with `vi.fn()`, correctly tests that `refreshPanel` gets wired up. |
| `localStorage` in `cache.test.ts` | **Good** | happy-dom provides a working localStorage implementation. Tests clear it in `beforeEach`. |

---

## 6. Test Organisation and Maintainability

### Structure

```
tests/
├── client/
│   ├── api.test.ts           (5 tests)
│   ├── cache.test.ts         (4 tests)
│   ├── export.test.ts        (14 tests)
│   ├── highlights.test.ts    (12 tests)
│   ├── selection.test.ts     (16 tests)
│   ├── shortcuts.test.ts     (8 tests)
│   └── ui/
│       ├── fab.test.ts       (8 tests)
│       └── panel.test.ts     (25 tests)
├── server/
│   ├── middleware.test.ts    (13 tests)
│   └── storage.test.ts      (8 tests)
└── mcp/
    ├── parse-storage-path.test.ts  (5 tests)
    ├── server.test.ts              (13 tests)
    └── tools/
        ├── add-agent-reply.test.ts    (7 tests)
        ├── get-annotation.test.ts     (4 tests)
        ├── get-export.test.ts         (4 tests)
        ├── list-annotations.test.ts   (5 tests)
        ├── list-page-notes.test.ts    (5 tests)
        └── resolve-annotation.test.ts (5 tests)
```

| Aspect | Assessment |
|--------|------------|
| **Mirror structure** | Test directory mirrors `src/` structure — easy to locate tests for any module. |
| **Test file naming** | Consistent `*.test.ts` convention, matched by vitest include patterns. |
| **Describe/it grouping** | Well-organised with nested `describe` blocks for logical grouping. |
| **Helper duplication** | `makeTextAnnotation` helper is duplicated across 5+ MCP test files with slight variations. Should be extracted to a shared `tests/helpers/fixtures.ts`. |
| **Test data constants** | `TEST_DIR` uses `Date.now()` for uniqueness — good for parallel runs. |
| **Cleanup** | `afterEach` blocks properly clean up temp files. No orphaned test data risk. |

**Severity: Low** — The helper duplication is a maintainability concern but doesn't affect correctness.

---

## 7. Flakiness Risks

| Risk | Severity | Details |
|------|----------|---------|
| MCP server process spawn timing | **Medium** | `server.test.ts` spawns a real Node.js process. No explicit "ready" signal — relies on JSON-RPC response timing. Could fail under heavy CI load. |
| `Date.now()` in test directories | **Low** | If tests run within the same millisecond, directory names could collide. Extremely unlikely. |
| happy-dom Range behaviour | **Medium** | `selection.test.ts` and `highlights.test.ts` rely on happy-dom's Range/Selection implementation. happy-dom's Range handling has known quirks compared to real browsers. Cross-element range tests may behave differently in actual Chrome. |
| `requestAnimationFrame` in popup.ts | **Low** | Popup uses `requestAnimationFrame` for focus — not currently tested, but if tested, would need timer mocking. |
| `setTimeout` in toast.ts and clearAll | **Low** | Auto-dismiss timers and confirmation resets — would need `vi.useFakeTimers()` if tested. |

---

## 8. MCP Tool Test Completeness

| Tool | Handler Tests | Integration Tests | Coverage |
|------|--------------|-------------------|----------|
| `list_annotations` | 5 tests | 2 tests | **Good** |
| `list_page_notes` | 5 tests | 0 tests (indirectly via export) | **Adequate** |
| `get_annotation` | 4 tests | 2 tests | **Good** |
| `get_export` | 4 tests | 1 test | **Good** |
| `resolve_annotation` | 5 tests | 1 test | **Good** |
| `add_agent_reply` | 7 tests | 1 test | **Good** |

**Missing MCP tests:**
- **Medium:** No test for calling an unknown tool name
- **Medium:** No test for `list_page_notes` via JSON-RPC integration
- **Low:** No test for server behaviour when storage file is deleted mid-operation
- **Low:** No test for very large store files (performance)

---

## 9. New Feature Test Coverage

### Annotation Dismissal / Resolved State

| Feature | Test Coverage | Severity |
|---------|--------------|----------|
| `resolvedAt` field set by MCP `resolve_annotation` | 5 handler tests + 1 integration test | **Good** |
| Resolved badge display in panel | 4 tests (text + element annotations) | **Good** |
| Resolved class on annotation item | 2 tests | **Good** |
| Resolved timestamp formatting | 1 test | **Adequate** |
| Resolved indicator in markdown export | 3 tests (text, element, not-resolved) | **Good** |
| Resolved highlight styling (green vs amber) | 0 tests | **Medium** — `applyHighlight(range, id, resolved=true)` style change untested |

### Orphan Detection

| Feature | Test Coverage | Severity |
|---------|--------------|----------|
| Orphan indicator display in panel | 3 tests (show/hide, text + element) | **Good** |
| Orphan CSS class application | 2 tests | **Good** |
| `isAnnotationOrphaned` callback invocation | 1 test | **Good** |
| Actual orphan detection logic in `client/index.ts` | 0 tests | **High** — The real `isAnnotationOrphaned` implementation checks `getHighlightMarks` and `getElementByAnnotationId`, but this is only tested via mocked callbacks |

### Delete Button

| Feature | Test Coverage | Severity |
|---------|--------------|----------|
| Delete button render on text annotation | 1 test | **Good** |
| Delete button render on element annotation | 1 test | **Good** |
| Delete callback invocation | 1 test | **Good** |
| Event propagation (delete doesn't trigger click) | 1 test | **Good** |
| Delete actually removes from server + DOM | 0 tests | **Medium** — tested only via mocked callback |

### Agent Replies

| Feature | Test Coverage | Severity |
|---------|--------------|----------|
| Reply creation via MCP | 7 handler tests + 1 integration test | **Good** |
| Reply display in panel | 3 tests | **Good** |
| Reply display in export markdown | 2 tests | **Good** |

---

## 10. Missing Test Categories

| Category | Status | Severity | Notes |
|----------|--------|----------|-------|
| **Unit tests** | Partial | **Critical** | Major modules untested (annotator, element-selector, popup) |
| **Integration tests** | Good (MCP) | **Medium** | MCP server has full integration tests. Missing: REST API integration (real HTTP), Astro integration hook |
| **End-to-end / Acceptance** | None | **High** | No browser-based tests (Playwright, Cypress). The `astro-inline-review-test` repo does not exist. No tests verify the tool works in an actual Astro dev server. |
| **Performance tests** | None | **Medium** | No tests for large stores (1000+ annotations), DOM with 10,000+ text nodes, rapid annotation creation |
| **Accessibility tests** | None | **Medium** | FAB has `aria-label` (tested), but no tests for panel keyboard navigation, screen reader compatibility, focus management |
| **Snapshot tests** | None | **Low** | Could be useful for export markdown format stability |
| **Contract tests** | None | **Low** | No tests verifying the REST API contract matches the documented API |

---

## Recommendations — Prioritised

### P0 (Critical)
1. **Add unit tests for `annotator.ts`** — Cover the core flows: text selection → save, element click → save, highlight click → edit, restore highlights (all 3 tiers), destroy cleanup. This is the most impactful gap.

### P1 (High)
2. **Add unit tests for `element-selector.ts`** — Test all 4 CSS selector strategies, `resolveElement` fallback chain, `generateDescription` formatting.
3. **Add `deserializeRange` tests** — This is the primary highlight restoration path.
4. **Add Unicode edge case tests** — Emoji, CJK characters, combining diacritics in `serializeRange` and `findRangeByContext`.
5. **Add special character tests for annotation IDs** — Path traversal attempts in middleware route params.
6. **Configure vitest coverage thresholds** — Prevent coverage regression.

### P2 (Medium)
7. **Extract shared test helpers** — `makeTextAnnotation`, `makeElementAnnotation`, `makePageNote` duplicated across MCP test files.
8. **Add `popup.ts` unit tests** — Positioning logic, show/hide state, button rebuilding.
9. **Add missing API client tests** — `createPageNote`, `updatePageNote`, `deletePageNote`, `updateAnnotation`.
10. **Add timeout config for MCP integration tests** — Prevent CI flakiness.
11. **Test `shared/export.ts` directly** — Even though it's indirectly tested, a direct test guards against client/server export drift.

### P3 (Low)
12. **Add `host.ts` and `toast.ts` tests** — Low complexity but easy wins for coverage.
13. **Consider Playwright acceptance tests** — A minimal test that boots Astro dev, creates an annotation, and verifies persistence would catch integration issues.
14. **Add snapshot tests for export format** — Catch unintended formatting changes.
