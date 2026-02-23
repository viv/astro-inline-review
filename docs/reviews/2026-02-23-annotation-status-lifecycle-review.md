---
review_date: 2026-02-23
reviewer: Claude Opus 4.6 (independent review)
scope: "Annotation status lifecycle — open/addressed/resolved states across all layers"
engineering_plan: docs/engineering-plans/2026-02-23-annotation-status-lifecycle.md
status: complete — findings F1, F2, F5 addressed
---

# Code Review: Annotation Status Lifecycle

## Summary

This review covers the annotation status lifecycle feature, which introduces a three-state model (`open` -> `addressed` -> `resolved`) for annotations. The changes span all layers of the system: shared types, MCP tools, REST API middleware, client UI (panel, highlights, styles), and the export module. The specification has been updated. All 357 tests pass, the build succeeds, and lint reports no issues.

**Files modified (12):**

| File | Change |
|------|--------|
| `src/shared/types.ts` | `AnnotationStatus` type, `addressedAt` field, `getAnnotationStatus()` helper |
| `src/types.ts` | Re-export new types |
| `src/client/types.ts` | Re-export new types |
| `src/mcp/tools/resolve-annotation.ts` | Default to `addressed`, add `autoResolve` parameter |
| `src/server/middleware.ts` | PATCH `status` field with validation and timestamp management |
| `src/client/ui/panel.ts` | Status badges, Accept/Reopen buttons, addressed styling |
| `src/client/styles.ts` | Addressed badge, addressed item, and accept button styles |
| `src/client/highlights.ts` | Three-colour highlight system (open/addressed/resolved) |
| `src/client/annotator.ts` | Pass `AnnotationStatus` to highlight functions |
| `src/client/index.ts` | `onAnnotationStatusChange` callback wiring |
| `src/shared/export.ts` | Addressed label in markdown export |
| `docs/spec/specification.md` | Section 3.2.5 — lifecycle documentation |

**Test files modified (7):**

| File | Change |
|------|--------|
| `tests/mcp/tools/resolve-annotation.test.ts` | Split into default and autoResolve describe blocks |
| `tests/mcp/server.test.ts` | Updated integration and end-to-end workflow tests |
| `tests/server/middleware.test.ts` | New `PATCH status` test section (5 tests) |
| `tests/client/ui/panel.test.ts` | Status lifecycle buttons (8 tests), callback wiring |
| `tests/client/annotator.test.ts` | Updated highlight call expectations |
| `tests/shared/export.test.ts` | Addressed/resolved/open label tests (4 tests) |
| (All panel test suites) | Added `onAnnotationStatusChange` mock to callbacks |

**Verdict: Approved with findings below. No critical issues. Two important findings should be addressed before merging.**

---

## Findings

### F1 — Important: MCP `resolve_annotation` does not clear stale timestamps on re-transition

**Location:** `src/mcp/tools/resolve-annotation.ts`, lines 18-24

**Issue:** When the MCP handler sets `status: 'addressed'`, it only sets `addressedAt` but does not clear `resolvedAt`. Conversely, when `autoResolve: true` sets `status: 'resolved'`, it only sets `resolvedAt` but does not clear `addressedAt`. This creates inconsistent state when an annotation is re-addressed after being resolved (e.g., a reviewer reopens via the UI, and then the agent re-addresses it).

Consider the sequence:
1. Agent calls `resolve_annotation` with `autoResolve: true` -- sets `status: 'resolved'`, `resolvedAt: T1`
2. Reviewer clicks Reopen in the UI -- sets `status: 'open'`, clears both timestamps (correct, REST API does this)
3. Agent calls `resolve_annotation` (default) -- sets `status: 'addressed'`, `addressedAt: T2`, but `resolvedAt` was already cleared by step 2, so this is actually fine in this sequence.

However, consider this sequence:
1. Agent calls `resolve_annotation` (default) -- sets `status: 'addressed'`, `addressedAt: T1`
2. Agent calls `resolve_annotation` with `autoResolve: true` -- sets `status: 'resolved'`, `resolvedAt: T2`, but `addressedAt: T1` remains

This is mildly inconsistent rather than a bug, since `getAnnotationStatus` uses the `status` field first. However, the stale `addressedAt` timestamp could be misleading if anyone inspects the raw JSON.

**Contrast with REST API:** The REST API middleware (`src/server/middleware.ts`, lines 180-187) correctly handles the `open` -> clears both timestamps case, but also does not clear cross-timestamps for `addressed` and `resolved` transitions.

**Recommendation:** For both the MCP handler and the REST API middleware, when setting `addressed`, consider clearing `resolvedAt`; when setting `resolved`, the `addressedAt` timestamp is arguably useful to keep (shows when the agent first acted). At minimum, document the intended semantics of having both timestamps set simultaneously.

**Severity:** Important (data inconsistency, not a functional bug)

---

### F2 — Important: `getAnnotationStatus` has no unit tests

**Location:** `src/shared/types.ts`, lines 37-41

**Issue:** The `getAnnotationStatus` function is a critical piece of the backward compatibility strategy -- it is called from 5 different modules (annotator, highlights, panel, export, types re-exports). Yet there are no dedicated unit tests for this function.

The function has three code paths:
1. `a.status` is truthy -- return `a.status`
2. `a.status` is falsy, `a.resolvedAt` is truthy -- return `'resolved'`
3. `a.status` is falsy, `a.resolvedAt` is falsy -- return `'open'`

While these paths are indirectly exercised by the panel and export tests, there are no tests that specifically verify the backward compatibility behaviour with legacy annotations (those created before the `status` field existed). A regression in this function would silently break the entire status display for existing annotation stores.

**Recommendation:** Add a small unit test file (`tests/shared/types.test.ts`) or a describe block in an existing shared test file that explicitly tests:
- Annotation with `status: 'open'` returns `'open'`
- Annotation with `status: 'addressed'` returns `'addressed'`
- Annotation with `status: 'resolved'` returns `'resolved'`
- Legacy annotation with no `status` field and `resolvedAt` set returns `'resolved'`
- Legacy annotation with no `status` field and no `resolvedAt` returns `'open'`
- Edge case: `status: 'open'` with `resolvedAt` set returns `'open'` (status takes precedence)

**Severity:** Important (test coverage gap for critical logic)

---

### F3 — Minor: `pulseHighlight` and `pulseElementHighlight` use hardcoded open-status colours

**Location:** `src/client/highlights.ts`, lines 86-101 and 139-152

**Issue:** The pulse animation functions (`pulseHighlight` and `pulseElementHighlight`) use hardcoded amber colours (`rgba(217,119,6,...)`) regardless of the annotation's current status. If a user clicks on an addressed (blue) or resolved (green) annotation in the panel, the pulse will flash amber instead of the corresponding status colour.

This is purely a visual inconsistency -- the pulse is a momentary attention-drawing effect and does not affect functionality. However, it may cause momentary confusion when an addressed annotation briefly flashes amber before returning to blue.

**Recommendation:** Consider making the pulse colour status-aware in a follow-up, or accept the minor visual inconsistency as-is since the pulse is transient (900ms). This is not blocking.

**Severity:** Minor (visual inconsistency only)

---

### F4 — Minor: `onAnnotationStatusChange` callback uses type assertion

**Location:** `src/client/index.ts`, line 86

```typescript
await api.updateAnnotation(id, { status } as Partial<import('./types.js').Annotation>);
```

**Issue:** The `{ status }` object is cast to `Partial<Annotation>` using a dynamic import type assertion. This works but is unusual. The `status` field exists on `BaseAnnotation` (and therefore on `Annotation`), so the cast is correct. However, the `api.updateAnnotation` function accepts `Partial<Annotation>`, and `{ status: AnnotationStatus }` is assignable to `Partial<BaseAnnotation>` but TypeScript cannot confirm it is assignable to `Partial<TextAnnotation | ElementAnnotation>` without the type assertion because the discriminated union requires a `type` field.

**Recommendation:** The assertion is pragmatically correct and safe here. An alternative would be to add a dedicated `updateAnnotationStatus(id, status)` method to the API module, but this adds surface area for little benefit. Accept as-is.

**Severity:** Minor (type ergonomics, not a bug)

---

### F5 — Minor: REST API `PATCH` does not clear `resolvedAt` when setting `addressed`, or `addressedAt` when setting `resolved`

**Location:** `src/server/middleware.ts`, lines 180-187

**Issue:** Same as F1 but specifically for the REST API path. When setting `status: 'addressed'`, only `addressedAt` is set. When setting `status: 'resolved'`, only `resolvedAt` is set. Neither clears the other timestamp.

The `open` case correctly clears both. But `addressed` and `resolved` do not clear each other.

This means if a reviewer uses the UI to: Accept (resolved) -> Reopen (open, clears both) -> then an agent addresses again, the flow is clean. But if the REST API is called directly to go from `resolved` to `addressed` (skipping `open`), both `addressedAt` and `resolvedAt` would be set.

This is the same root cause as F1. Grouped separately because the fix locations differ.

**Recommendation:** Same as F1. The current transition diagram shows `resolved -> open -> addressed`, not `resolved -> addressed` directly. If direct transitions are not intended, consider adding validation to reject them. If they are intended, clear stale timestamps.

**Severity:** Minor (only occurs with non-standard transition paths)

---

### F6 — Nit: Duplicate status label construction in export

**Location:** `src/shared/export.ts`, lines 60-63 and 84-87

**Issue:** The status label logic is duplicated verbatim between text annotations and element annotations:

```typescript
const status = getAnnotationStatus(a);
const statusLabel = status === 'resolved' ? ' ✅ [Resolved]'
  : status === 'addressed' ? ' 🔧 [Addressed]'
  : '';
```

**Recommendation:** Extract to a small helper function `getStatusLabel(a: Annotation): string` within the export module. This is a minor DRY improvement and is not blocking.

**Severity:** Nit

---

### F7 — Nit: Engineering plan references renaming `resolve-annotation.ts` to `address-annotation.ts`

**Location:** `docs/engineering-plans/2026-02-23-annotation-status-lifecycle.md`, line 76

**Issue:** The engineering plan section header says "Rename to `address-annotation.ts`" but the actual implementation kept the file name as `resolve-annotation.ts`, which is the correct decision (backward compatibility). The plan document is slightly inconsistent with the implementation.

**Recommendation:** Update the engineering plan to reflect the actual decision (keeping the file name). This is documentation hygiene only.

**Severity:** Nit

---

### F8 — Nit: Panel badge `data-air-el` attribute renamed from `resolved-badge` to `status-badge`

**Location:** `src/client/ui/panel.ts`, line 796

**Issue:** The `data-air-el` attribute was changed from `resolved-badge` to `status-badge`. This is a sensible rename for the new multi-status world. All existing tests have been updated to use the new attribute. However, if any external tools or scripts query for `[data-air-el="resolved-badge"]`, they would break.

**Recommendation:** This is dev-only UI and unlikely to have external consumers. The rename is correct. No action needed.

**Severity:** Nit

---

## Review by Criteria

### 1. Correctness

The open -> addressed -> resolved lifecycle is correctly implemented across all layers. The MCP tool defaults to `addressed` (not `resolved`), matching the design intent. The `autoResolve: true` escape hatch allows direct resolution when needed. The UI provides Accept (addressed -> resolved) and Reopen (resolved -> open) buttons. The REST API correctly validates the `status` field against the allowed values.

**Assessment:** Correct.

### 2. Backward Compatibility

Handled well via the `getAnnotationStatus()` helper function. Annotations without a `status` field gracefully fall back to `'resolved'` if `resolvedAt` is set, or `'open'` otherwise. The `status` field is optional in `BaseAnnotation`. No schema version bump is needed. Existing JSON stores will work unchanged.

**Assessment:** Well handled. See F2 for the test coverage concern.

### 3. Type Safety

The `AnnotationStatus` type is properly defined and used throughout. The type is re-exported correctly from `src/types.ts` and `src/client/types.ts`. The `getAnnotationStatus` function provides a type-safe way to derive status from potentially-missing fields. The REST API uses `VALID_STATUSES` array with proper type checking before the cast.

One minor concern is the type assertion in `src/client/index.ts` (F4), but it is pragmatically correct.

**Assessment:** Good. Minor type assertion noted in F4.

### 4. Test Coverage

Test coverage is thorough for the new functionality:
- **MCP tools:** 9 tests covering default (addressed), autoResolve (resolved), persistence, timestamp updates, and error cases
- **REST API:** 5 new tests covering addressed, resolved, reopen, invalid status rejection, and combined status + note updates
- **Panel UI:** 8 new tests covering badge rendering, CSS classes, button presence/absence, and click callbacks
- **Export:** 4 new tests covering addressed, resolved, open, and no-status-field labels
- **Annotator:** 3 existing tests updated for the new signature

Missing: dedicated `getAnnotationStatus` unit tests (F2), and no test for the `open -> addressed -> resolved -> reopen -> addressed` full cycle at the REST API level.

**Assessment:** Good coverage. F2 is the main gap.

### 5. Security

The REST API validates the `status` field against a whitelist (`VALID_STATUSES`) before processing. Invalid values return a 400 error. The validation uses `includes()` with a type assertion, which is correct since the input is already confirmed to be a string at that point. No injection vectors are introduced.

The `status` field is not user-controllable from the creation endpoint (POST) -- it can only be set via PATCH. This is correct: annotations are always created as `open`.

**Assessment:** No security issues.

### 6. Consistency

The status model is consistently applied across all layers:
- **MCP:** `resolve_annotation` tool sets status and timestamps
- **REST API:** PATCH endpoint accepts status and manages timestamps
- **Client UI:** Panel shows badges, buttons trigger PATCH calls
- **Highlights:** Three-colour system (amber/blue/green) for open/addressed/resolved
- **Export:** Three-label system (none/Addressed/Resolved)
- **Types:** Single source of truth in `src/shared/types.ts`

The only inconsistency is in the pulse animation colours (F3).

**Assessment:** Consistent.

### 7. Edge Cases

| Edge Case | Handled? | Notes |
|-----------|----------|-------|
| Legacy annotation without `status` field | Yes | `getAnnotationStatus` falls back correctly |
| Legacy annotation with `resolvedAt` but no `status` | Yes | Returns `'resolved'` |
| Reopen clears both timestamps | Yes | REST API clears `addressedAt` and `resolvedAt` |
| Re-addressing a resolved annotation via MCP | Partially | Sets `addressed` but does not clear `resolvedAt` (F1) |
| Double-accepting (clicking Accept twice) | Safe | Second PATCH simply re-sets `resolvedAt` timestamp |
| Invalid status value via REST API | Yes | Returns 400 with descriptive error |
| Setting status alongside other fields (note, replacedText) | Yes | Tested in middleware tests |
| Status on element annotations (not just text) | Yes | Both annotation types use `getAnnotationStatus` |

**Assessment:** Good edge case handling. F1 is the main gap.

### 8. Code Quality

No dead code or unused imports detected. The changes follow established patterns in the codebase (e.g., the `appendStatusActions` function mirrors the existing `createDeleteButton` pattern). The `createStatusBadge` function cleanly replaces the old `createResolvedBadge`.

Minor duplication in the export module (F6) is the only code quality observation.

**Assessment:** Clean implementation.

---

## Recommendations

### Must address before merge

None. All findings are non-blocking.

### Should address before merge

1. **F1/F5:** Decide on timestamp clearing semantics and either clear stale timestamps on transition, or document that both timestamps may coexist. A one-line comment in each location explaining the intent would suffice if the current behaviour is desired.
2. **F2:** Add unit tests for `getAnnotationStatus`. This is the backward compatibility lynchpin and deserves direct test coverage.

### Nice to have

3. **F3:** Make pulse colours status-aware in a follow-up.
4. **F6:** Extract the duplicate status label logic into a helper.
5. **F7:** Update the engineering plan to reflect the actual file name decision.

---

## Overall Assessment

This is a well-structured feature implementation that correctly introduces a three-state lifecycle across all system layers. The engineering plan was followed closely, the specification was updated, and test coverage is comprehensive. The backward compatibility strategy using `getAnnotationStatus()` is elegant and avoids any migration requirements.

The two important findings (F1 on stale timestamps and F2 on missing unit tests) are worth addressing but do not block the feature. The implementation is production-ready for a dev-only tool.
