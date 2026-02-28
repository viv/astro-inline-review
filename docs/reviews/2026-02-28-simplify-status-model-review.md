---
generated_by: Claude Opus 4.6
generation_date: 2026-02-28
model_version: claude-opus-4-6
purpose: code_review
status: final
human_reviewer: matthewvivian
tags: [review, status-model, refactor, simplify, resolved, autoResolve]
---

# Review: Simplify Annotation Status Model

**Branch**: `refactor/simplify-status-model`
**PR**: #38
**Reviewed by**: Claude Opus 4.6 (independent review agent)
**Date**: 2026-02-28

## Summary

Single commit modifying 20 files (+193 lines, -487 lines). The change removes the `resolved` status and `autoResolve` feature from the annotation lifecycle, simplifying from four statuses to three: `open -> in_progress -> addressed`. The MCP tool `resolve_annotation` is renamed to `address_annotation`. All 463 tests pass, the build succeeds, and lint reports no issues.

## Review Aspects

### 1. Completeness — Remaining References to `resolved` or `autoResolve`

**Source code (`src/`)**:

| File | Reference | Verdict |
|------|-----------|---------|
| `src/shared/types.ts:30` | `resolvedAt?: string` field on `BaseAnnotation` | **Intentional** — kept for backward compat reads |
| `src/shared/types.ts:37-46` | `getAnnotationStatus()` maps `resolved` -> `addressed` | **Intentional** — backward compat helper |
| `src/server/middleware.ts:192,196,200` | `statusUpdates.resolvedAt = undefined` in PATCH handler | **Intentional** — clears legacy `resolvedAt` on any status transition |

**No remaining references to `autoResolve` in source code.** Clean removal.

### 2. Backward Compatibility

`getAnnotationStatus()` in `src/shared/types.ts` correctly handles:
- `status === 'resolved'` (cast via `as string`) returns `'addressed'`
- Legacy annotations without `status` but with `resolvedAt` returns `'addressed'`
- Status field takes precedence over timestamps
- `resolvedAt` field kept as optional on `BaseAnnotation` for reading old data

Tests in `tests/shared/types.test.ts` cover all four backward compat scenarios (lines 31-63). The middleware clears `resolvedAt` on all status transitions (lines 192, 196, 200), which means old data naturally converges to the new model.

**Assessment**: Backward compatibility is well-implemented and thoroughly tested.

### 3. MCP Tool Rename

| Location | Old Name | New Name | Status |
|----------|----------|----------|--------|
| `src/mcp/tools/address-annotation.ts` | `resolve-annotation.ts` | `address-annotation.ts` | Done |
| Handler function | `resolveAnnotationHandler` | `addressAnnotationHandler` | Done |
| Tool registration | `resolve_annotation` | `address_annotation` | Done |
| `src/mcp/server.ts` import | `registerResolveAnnotation` | `registerAddressAnnotation` | Done |
| `tests/mcp/tools/address-annotation.test.ts` | `resolve-annotation.test.ts` | `address-annotation.test.ts` | Done |
| `tests/mcp/server.test.ts` | `resolve_annotation` | `address_annotation` | Done |
| `CLAUDE.md` MCP tools table | `resolve_annotation` | `address_annotation` | Done |
| `src/mcp/tools/set-in-progress.ts` | Description referenced old name | Updated | Done |

### 4. Test Coverage

All 463 tests pass across 30 test files. Key test updates:

| Test File | Changes | Coverage |
|-----------|---------|----------|
| `tests/shared/types.test.ts` | Updated: `resolved` -> `addressed` mapping, `resolvedAt` backward compat | Good — 7 tests cover all paths |
| `tests/shared/export.test.ts` | Updated: removed `[Resolved]` assertions, added backward compat tests | Good — 19 tests |
| `tests/mcp/tools/address-annotation.test.ts` | Renamed; removed `autoResolve` tests; added `resolvedAt` undefined check | Good — 11 tests |
| `tests/mcp/server.test.ts` | Updated tool name in integration workflow test | Good — 10 tests |
| `tests/server/middleware.test.ts` | Added: `resolved` rejection test, explicit status on creation | Good — 52 tests |
| `tests/client/ui/panel.test.ts` | Removed resolved-specific tests; kept addressed equivalents | Good — 61 tests |
| `tests/client/export.test.ts` | Updated backward compat tests for `resolvedAt` -> `[Addressed]` | Good — 14 tests |

**Test gaps**: None identified.

### 5. Documentation Consistency

| Document | Three-Status Model | `address_annotation` Name | `autoResolve` Removed | Verdict |
|----------|-------------------|--------------------------|----------------------|---------|
| `CLAUDE.md` | Yes | Yes | Yes | Up to date |
| `docs/spec/specification.md` | Yes | Yes | Yes | Up to date |
| `docs/guides/2026-02-28-annotation-status-workflows.md` | Yes | Yes | Yes | Up to date |
| `docs/guides/mcp-tools.md` | Yes | Yes | Yes | Updated (finding #3) |
| `docs/guides/mcp-setup.md` | Yes | Yes | N/A | Updated (finding #4) |

### 6. CSS/Styling

Removed from `src/client/styles.ts`:
- `.air-annotation-item--resolved` (opacity + line-through)
- `.air-annotation-item__resolved-badge` (green badge styling)
- `.air-annotation-item__resolved-time` (timestamp styling)

`RESOLVED_HIGHLIGHT_STYLE` removed from `highlights.ts` (green `rgba(34,197,94,0.2)` colour gone).

**Assessment**: Clean removal.

### 7. Export

`src/shared/export.ts` correctly produces only two status labels:
- `🔧 [Addressed]` for `status === 'addressed'`
- `⏳ [In Progress]` for `status === 'in_progress'`

No `[Resolved]` label remains. Backward compat flows through `getAnnotationStatus()`.

**Assessment**: Correct.

### 8. API — Rejection of `resolved` as a New Status

`VALID_STATUSES` in `src/server/middleware.ts` is `['open', 'in_progress', 'addressed']`. The middleware rejects `resolved` with a 400 error. Test at `tests/server/middleware.test.ts` explicitly verifies this.

**Assessment**: Correctly rejected with proper test coverage.

## Findings

### Finding #1 — Minor: Stale `resolve_annotation` in `set-in-progress.ts` tool description (FIXED)

**File**: `src/mcp/tools/set-in-progress.ts:39`
The tool description said "call resolve_annotation when done" — updated to `address_annotation`.

### Finding #2 — Minor: Stale `resolve_annotation` in orphan-tracker comment (FIXED)

**File**: `src/client/orphan-tracker.ts:7`
Comment referenced old tool name — updated.

### Finding #3 — Major: `docs/guides/mcp-tools.md` not updated (FIXED)

The MCP tools reference guide still documented `resolve_annotation`, `autoResolve`, and the four-status lifecycle — rewritten for the three-status model.

### Finding #4 — Major: `docs/guides/mcp-setup.md` not updated (FIXED)

The feedback loop diagram and workflow description referenced old tool names — rewritten.

### Finding #5 — Info: Panel test describe block name (FIXED)

`tests/client/ui/panel.test.ts:98` — describe block said "resolved annotations" — updated to "addressed annotations".

### Finding #6 — Info: Server test variable naming (FIXED)

`tests/mcp/server.test.ts:321-325` — variables named `resolveResponse`/`resolved` — renamed to `addressResponse`/`addressed`.

## Overall Assessment

The core refactoring is **well-executed**. The type system, server middleware, MCP tool implementation, client UI, highlights, styles, and export are all correctly updated. Backward compatibility is properly handled. All 463 tests pass.

Six findings were identified during review — all have been fixed in the follow-up commit. No outstanding issues remain.

**Recommendation**: Ready to merge after CI passes.
