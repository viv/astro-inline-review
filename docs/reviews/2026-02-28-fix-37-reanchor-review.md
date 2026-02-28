---
generated_by: Claude Opus 4.6
generation_date: 2026-02-28
model_version: claude-opus-4-6
purpose: independent_review
status: draft
human_reviewer: matthewvivian
tags: [fix, re-anchor, highlight-restoration, range-data, review]
---

# Independent Review: PR #44 — Re-anchor Annotations After Fallback Tier Match

**Branch**: `fix/37-reanchor-stale-range`
**Issue**: #37 — Stale range data after Tier 2.5/3 restoration
**Reviewer**: Claude Opus 4.6 (independent code review)
**Date**: 2026-02-28

## Summary

This PR fixes a data staleness issue where annotations restored via fallback tiers (2.5 or 3) continued to use stale range data on subsequent page loads, repeatedly falling back instead of promoting to Tier 1. The fix serialises the successfully-matched Range and PATCHes the stored annotation with fresh XPath/offset data.

**Changes**:
- `src/client/annotator.ts` — Detects Tier 2.5/3 matches in `restoreHighlights`, serialises the live Range, and fires an async PATCH to update stored range data
- `src/client/api.ts` — New `reanchorAnnotation()` method sending `{ range, replacedText: null }` via PATCH
- `src/server/middleware.ts` — Extended PATCH handler to accept `range` (for text annotations only) and `replacedText: null` (to clear the field)
- Test files — Comprehensive test coverage for both client and server changes

## Architecture Assessment

The approach is architecturally sound. The change follows the existing patterns well:

1. **Separation of concerns**: The client detects the condition, the API provides the transport, the server validates and persists. No layer overreaches.
2. **Fire-and-forget with deduplication**: The PATCH is async with `.catch()` error handling and a `reanchoredIds` Set prevents redundant calls. This avoids blocking highlight restoration while ensuring the fix is durable.
3. **Minimal surface area**: Only the PATCH endpoint is extended — no new routes. The `reanchorAnnotation` API method is a thin wrapper around an existing endpoint.
4. **Backward compatibility**: The change is additive — existing PATCH calls continue to work without a `range` field.

## Changes Reviewed

### 1. `src/client/annotator.ts` — Re-anchor detection and dispatch

**Correctness**: The `needsReanchor` flag is correctly set only for Tier 2.5 and Tier 3 matches. Tier 1 (exact XPath match) and Tier 2 (original text found by context) do not trigger re-anchoring, which is correct:
- Tier 1: Range data is already accurate
- Tier 2: The original text is still present in the DOM, so the stored `selectedText` remains valid for future Tier 2 matches. The stale XPath is a minor inefficiency but not a correctness issue.
- Tier 2.5/3: The text has changed — range data must be updated for future Tier 1 matches

**Deduplication**: The `reanchoredIds` Set (line 79) prevents the same annotation from being PATCHed multiple times across consecutive `restoreHighlights` calls within a session. This is important because `restoreHighlights` is called from the store poller, page transitions, and panel operations.

**Error handling**: The `.catch()` on the fire-and-forget PATCH (line 540) logs the error without disrupting the highlight restoration flow. If the PATCH fails, the ID remains in `reanchoredIds`, so no retry happens within the session. This is an acceptable trade-off — the next page load will attempt the re-anchor again (since `reanchoredIds` is per-annotator-instance).

**`clearReplacedText` logic** (line 539): `!!annotation.replacedText` correctly passes `true` only when `replacedText` is truthy. After re-anchoring, the new range's `selectedText` contains the current text, making the `replacedText` field redundant. Clearing it avoids stale fallback paths.

### 2. `src/client/api.ts` — `reanchorAnnotation` method

**Correctness**: Cleanly sends `{ range, replacedText: null }` when clearing, or just `{ range }` when not. The conditional spread `...(clearReplacedText ? { replacedText: null } : {})` correctly omits the field when not clearing, avoiding accidental null writes.

**Type safety**: The `SerializedRange` import is correctly added and used for the `range` parameter.

### 3. `src/server/middleware.ts` — PATCH handler extensions

**Range validation** (lines 177-181): The validation pattern `typeof body.range !== 'object' || body.range === null || Array.isArray(body.range)` is consistent with the POST handler's range validation (line 43). It checks for the correct structural type without validating individual fields — this is consistent with the existing approach for a dev-only tool.

**Range application** (lines 233-236): The spread pattern `...(isTextAnnotation(existing) && body.range && typeof body.range === 'object' ? { range: ... } : {})` correctly:
- Only applies to text annotations (via `isTextAnnotation` guard)
- Only applies when `range` is present and is an object
- Silently ignores `range` on element annotations

**`replacedText: null` handling** (lines 220-228): The new `replacedTextUpdate` block cleanly separates the three cases:
- `replacedText` is a string: set the value
- `replacedText` is `null`: clear (set to `undefined`, which `JSON.stringify` omits)
- `replacedText` is absent: no change (empty object spread)

This is a refactor of the previous inline ternary, which only handled the string case. The refactor is correct and more maintainable.

**Ordering of spreads** (line 230-241): The object spread order is `...existing, note, range, replacedTextUpdate, statusUpdates, replies, updatedAt`. This means `range` overwrites `existing.range` (correct), `replacedTextUpdate` overwrites any `existing.replacedText` (correct for null case), and later fields take precedence.

### 4. Test Coverage

**Client tests** (`tests/client/annotator.test.ts`): 5 new test cases covering:
- Tier 2.5 re-anchor with `replacedText`
- Tier 3 re-anchor via context seam
- No re-anchor on Tier 1 match
- `clearReplacedText` flag correctness
- Session deduplication (no double PATCH)

**Server tests** (`tests/server/middleware.test.ts`): 5 new test cases covering:
- Range update on text annotation
- `replacedText: null` clearing
- Combined range + replacedText null (full re-anchor payload)
- Invalid range validation (400 response)
- Range ignored on element annotations

## Findings

### Severity: Low — Missing test for Tier 2 non-re-anchor

**Location**: `tests/client/annotator.test.ts`

There is a test for "does NOT re-anchor after Tier 1 match" but no explicit test for "does NOT re-anchor after Tier 2 match". While the code is correct (Tier 2 success sets `range` and skips 2.5/3, leaving `needsReanchor` as `false`), having an explicit test would document this design decision and prevent regressions.

**Recommendation**: Consider adding a test case like "does NOT re-anchor after Tier 2 match (original text found by context)".

### Severity: Low — No retry on failed re-anchor PATCH

**Location**: `src/client/annotator.ts`, line 536-542

If the PATCH request fails (e.g., network hiccup, server restart), the annotation ID is already in `reanchoredIds`, so the re-anchor won't be retried during the current session. The annotation will continue to fall back on each page load until the next session.

**Assessment**: This is an acceptable trade-off for a dev tool. The alternative (retry logic, removing from `reanchoredIds` on failure) adds complexity with minimal benefit. The next page load creates a new annotator instance with a fresh `reanchoredIds` set, so the re-anchor will be retried automatically.

**Recommendation**: No code change needed. The current behaviour is reasonable.

### Severity: Info — Spec says `range` is not PATCH-mutable

**Location**: `docs/spec/specification.md`, line 451

The specification's field mutability table currently states `range | No | Preserved from original`. This PR deliberately makes `range` mutable via PATCH (for text annotations only) to support re-anchoring. The spec, PATCH request body example, and field mutability table need updating to reflect this.

**Recommendation**: Update Section 4.2.1 to:
1. Add `range` to the PATCH request body example
2. Change the `range` row in the mutability table to `Yes (text only)` with appropriate notes
3. Document the `replacedText: null` clearing behaviour

### Severity: Info — Spec Section 8.4 doesn't mention re-anchoring

**Location**: `docs/spec/specification.md`, Section 8.4 (line 1232)

Section 8.4 describes the four-tier restoration but does not mention that Tier 2.5 and 3 matches trigger re-anchoring to update stored range data. This should be documented to explain the self-healing behaviour.

**Recommendation**: Add a paragraph to Section 8.4 after the Tier 4 description, explaining the re-anchoring mechanism.

### Severity: Info — Range field validation depth

**Location**: `src/server/middleware.ts`, line 177-181

The PATCH range validation only checks that `range` is a non-null, non-array object. It does not validate the presence of required fields (`startXPath`, `startOffset`, `endXPath`, `endOffset`, `selectedText`, `contextBefore`, `contextAfter`). This is consistent with the POST handler's approach, and acceptable for a dev-only tool where the client is trusted.

**Recommendation**: No change needed. Consistency with POST validation is the right approach.

## Documentation Scan

The following documentation updates are needed to keep the spec consistent with the implementation:

1. **Section 4.2.1** — PATCH request body, field mutability table, and `replacedText: null` semantics
2. **Section 8.4** — Re-anchoring after fallback tier matches
3. **Section 15** — Mention that range updates are persisted after successful fallback match

These are addressed in the companion commit.

## Verdict

**APPROVE** with spec updates required.

The implementation is correct, well-tested, and architecturally consistent with the existing codebase. The changes are minimal in scope, the deduplication logic is sound, and the test coverage is thorough. The only required changes are specification updates to document the new behaviour (range mutability via PATCH, re-anchoring after fallback match).

The two low-severity findings (missing Tier 2 non-re-anchor test, no retry on failed PATCH) are reasonable trade-offs and do not block approval.
