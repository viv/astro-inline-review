---
review_date: 2026-02-23
reviewer: Claude Sonnet 4.6 (independent review)
issue: "#12 — Annotations become orphaned after agent resolves them by changing page content"
scope: replacedText feature — all changed files
status: complete — findings F1 and F2 addressed
---

# Code Review: `replacedText` Feature (Issue #12)

## Summary

The implementation adds an optional `replacedText` field to `TextAnnotation` that enables a new location tier (Tier 2.5) when an agent changes page content. The approach is sound and the implementation is clean. All 336 tests pass and lint is clean.

**Verdict: Approved. Minor findings F1 and F2 were addressed in-session.**

---

## File-by-File Review

---

### 1. `src/shared/types.ts` — Schema change

**Change**: Added `replacedText?: string` to `TextAnnotation`.

The field is correctly placed on `TextAnnotation` only (not `ElementAnnotation` or `BaseAnnotation`), and it is optional — making it backward-compatible with all existing stores. The existing type guards (`isTextAnnotation`, `isElementAnnotation`) require no changes.

No schema version bump is needed, and the decision not to bump is correct: the field is optional and absent fields in existing JSON files will read as `undefined`, which is precisely the condition the Tier 2.5 guard checks.

**Findings**: None.

---

### 2. `src/mcp/tools/update-annotation-target.ts` — New MCP tool

The handler follows the established pattern from `add-agent-reply.ts` and `resolve-annotation.ts`. The guard sequencing is correct:

1. Empty `replacedText` check runs first (before any storage access) — efficient.
2. Annotation lookup is done inside `storage.mutate()` — correct, as it atomically reads and writes.
3. `isTextAnnotation` guard produces a clear error message for element annotations.
4. `updatedAt` is updated — consistent with other write tools.
5. The return value re-reads the annotation from the mutated store rather than returning the params — this guarantees the response reflects what was actually persisted.

**Minor observation about Zod schema**: The `replacedText` parameter is declared as `z.string()` with no `.min(1)` constraint at the Zod layer. The empty-string guard is handled manually inside the handler body (`.trim()` check). This is inconsistent with how `id` is validated (`z.string().min(1)`). The behaviour is correct, but the validation signal is weaker at the schema boundary. The `add_agent_reply` tool has the same pattern for `message`, so this is not a regression — it is a pre-existing inconsistency. See the observation below.

🟢 **Observation — Validation layer inconsistency**: Both `update_annotation_target` and `add_agent_reply` validate their string content fields by hand (`.trim()` check in the handler) rather than using Zod `.min(1)`. The `id` field uses `.min(1)`. This is internally consistent within this PR but is an opportunity to standardise. Not a blocker.

---

### 3. `src/mcp/server.ts` — Tool registration

The import alias (`registerUpdateAnnotationTarget`) and the registration call are both present and correct. The tool is registered in the same pattern as all other tools. The MCP integration test (`tests/mcp/server.test.ts`) verifies the existing tool list — it would catch a registration failure, though it does not enumerate `update_annotation_target` by name. This is adequate.

**Findings**: None.

---

### 4. `src/server/middleware.ts` — PATCH endpoint extension

The allowlist extension at lines 167–169 is the critical change:

```typescript
...(isTextAnnotation(existing) && typeof body.replacedText === 'string'
  ? { replacedText: body.replacedText }
  : {}),
```

This is correct: it uses `isTextAnnotation` to guard the field (preventing `replacedText` from being set on element annotations), and `typeof body.replacedText === 'string'` to guard against absent/non-string values.

🟡 **Minor — No empty-string validation on REST API PATCH**: The REST API accepts an empty string `""` as a valid `replacedText` via PATCH. The MCP tool explicitly rejects empty and whitespace-only values (`.trim()` check), but the REST endpoint has no equivalent guard. A client could PATCH `{ replacedText: "" }` and an empty string would be stored. When Tier 2.5 runs, `findRangeByContext("", ...)` would search for an empty string — the behaviour of that function with an empty needle is not immediately obvious and could produce unexpected matches.

The spec document states that `replacedText` must be non-empty (the MCP tool description says "must not be empty"), but the REST API does not enforce this. The inconsistency should be resolved by adding a server-side check:

```typescript
// In the PATCH handler, before or inside storage.mutate():
if (typeof body.replacedText === 'string' && !body.replacedText.trim()) {
  throw new ValidationError('"replacedText" must not be empty or whitespace-only');
}
```

This also needs a corresponding test in `tests/server/middleware.test.ts`.

---

### 5. `src/client/annotator.ts` — Tier 2.5 location logic

The implementation at lines 504–511:

```typescript
// Tier 2.5: Try context matching with replacement text
if (!range && annotation.replacedText) {
  range = findRangeByContext(
    annotation.replacedText,
    annotation.range.contextBefore,
    annotation.range.contextAfter,
  );
}
```

This is exactly right. Key observations:

- The guard `annotation.replacedText` is falsy-safe: an empty string would short-circuit (not attempt the search). This means that even if an empty `replacedText` were stored via the REST API gap described above, Tier 2.5 would be safely skipped.
- The same `contextBefore`/`contextAfter` values from the original range are reused — this is architecturally correct because the agent changed the annotated text, not the surrounding text. The engineering plan explicitly notes this reasoning.
- The tier ordering (1 → 2 → 2.5 → 3) is correct: Tier 2.5 is only attempted when both Tier 1 and Tier 2 have failed.
- The `resolved` flag is correctly passed to `applyHighlight` — resolved annotations will still display with the resolved styling even when located via Tier 2.5.

**Findings**: None.

---

### 6. `src/client/ui/panel.ts` — Panel display with replacement text

The `createTextAnnotationItem` function at lines 366–392 handles the two rendering cases:

**With `replacedText`**: Renders struck-through original text → replacement text, both truncated at 80 characters.

**Without `replacedText`**: Renders plain quoted text as before.

Both branches truncate at 80 characters with the `'…'` suffix — consistent with each other and with the existing pattern.

The truncation limit (80 characters) is applied independently to `selectedText` and `replacedText`. This means the struck-through original and the replacement text can each be up to 80 characters, so the combined display could be up to ~180 characters plus the arrow. This seems acceptable for a panel sidebar but is worth being aware of.

🟢 **Observation — Inline styles for strike-through**: The strike-through effect uses inline styles (`original.style.textDecoration = 'line-through'; original.style.opacity = '0.6'`). The codebase uses inline styles in several places (e.g., action divs), so this is consistent. A CSS class would be more maintainable, but this is a low-value improvement.

🟢 **Observation — No `aria-label` or semantic markup for the struck/replaced display**: A screenreader user would hear the original text followed by the arrow symbol (` → `) and then the replacement text, without context. Adding an `aria-label` like "original text replaced by: replacement text" to the container `div` would improve accessibility. This is a nice-to-have.

---

### 7. `tests/mcp/tools/update-annotation-target.test.ts` — MCP tool tests

Seven tests covering:

- Happy path: sets `replacedText`, returns updated annotation
- Non-existent ID returns error
- Element annotation returns error
- Empty (whitespace-only) `replacedText` returns error
- Persists to JSON file
- Updates `updatedAt` timestamp
- Overwrites previous `replacedText` value

All critical paths are tested. The `updatedAt` test (line 101–102) verifies the timestamp changed without fixing it to a specific value — this is the right approach.

🟢 **Observation — No test for purely empty string `""`**: The whitespace-only test uses `'   '`. A test for `''` (empty string) would confirm that `.trim()` handles both cases. Given that `.trim()` on `''` returns `''` which is falsy, it would pass — but it is worth being explicit. Minor.

---

### 8. `tests/server/middleware.test.ts` — REST API tests (new `describe` block)

Three tests at lines 469–547:

- PATCH with `replacedText` updates the field on a text annotation
- PATCH with `replacedText` is silently ignored on element annotations
- PATCH with both `note` and `replacedText` updates both fields

These cover the stated requirements. The test for "ignored on element annotations" correctly asserts `patched.replacedText` is `undefined` — good.

**Missing test**: No test for PATCH with `replacedText: ""` (empty string). This directly corresponds to the validation gap identified in the middleware review above. Without the validation fix, this would be a passing test that demonstrates the bug; after the fix, it becomes a regression guard.

---

### 9. `tests/client/annotator.test.ts` — Annotator tests (new tests)

Four new tests in the `restoreHighlights` describe block:

- Tier 2.5 locates via replacement text when Tiers 1 and 2 fail — verifies both `findRangeByContext` call arguments and the applied highlight
- All tiers including 2.5 fail → annotation remains orphaned
- Tiers 1 and 2 fail with no `replacedText` → annotation remains orphaned (regression guard)
- The existing Tier 2 test (line 548) remains unchanged

The Tier 2.5 test at line 573 is thorough: it uses `mockReturnValueOnce` to sequence the mocked return values, then asserts both calls to `findRangeByContext` with their exact arguments. This is the right approach.

🟢 **Observation — The `replacedText` orphan test (line 625) uses the default range from `makeTextAnnotation`**: The annotation has `contextBefore: ''` and `contextAfter: ' world'`. The test asserts that all three `findRangeByContext` calls return null and no highlight is applied. This is correct, but the test name says "all tiers including Tier 2.5 fail" — yet `findRangeByContext` would only be called twice (once for Tier 2, once for Tier 2.5). The mock `mockReturnValue(null)` covers any number of calls, so the test works correctly. The wording is unambiguous. No issue.

---

### 10. `tests/client/ui/panel.test.ts` — Panel tests (new `describe` block)

Four new tests in the `createPanel — replacedText rendering` block:

- With `replacedText`: struck-through original text is present
- With `replacedText`: arrow separator `→` is present
- With `replacedText`: replacement text is present without line-through
- Without `replacedText`: plain quoted text, no line-through, no arrow

These cover all the rendering branches. The CSS selector `span[style*="line-through"]` used to find the struck-through span is robust for inline-style-based rendering.

**Findings**: None.

---

### 11. `docs/spec/specification.md` — Specification updates

The diff adds:

- `replacedText?: string` to the `TextAnnotation` interface example (Section 3.2.2) with an inline comment
- A prose paragraph explaining the field, where it is set, and backward-compatibility
- Updated PATCH endpoint description in the route table (Section 4.2.1)
- Updated PATCH request body and field-mutability table
- Updated MCP tool table (Section 4.3.2) with the new tool
- Updated tool validation prose
- New Tier 2.5 description in Section 15.2 (Highlight Restoration)
- Updated error-handling table (Section 16)

All additions are accurate and consistent with the implementation. The spec correctly notes that `replacedText` is "ignored on element annotations" for PATCH, and that the MCP tool returns an error for element annotations — this distinction matches the code.

🟢 **Observation — Pre-existing spec typo (not introduced by this PR)**: The CLAUDE.md REST API table at line 78 shows `| DELETE | /annotations:id |` — missing the `/` before `:id`. This pre-dates this PR (the git diff for the CLAUDE.md only adds/modifies the `replacedText` and `update_annotation_target` rows). This is a cosmetic documentation issue in CLAUDE.md, not introduced here.

---

### 12. `CLAUDE.md` — Documentation updates

Four changes:

- `replacedText` field added to the JSON schema example
- `type: "text"` description updated to mention the optional `replacedText` field
- PATCH route description updated from "Update note only" to "Update note and/or replacedText"
- `update_annotation_target` added to the MCP tool table

All changes are accurate and consistent with the implementation and the spec.

**Findings**: None.

---

### 13. `docs/engineering-plans/2026-02-23-replaced-text-tracking.md` — Engineering plan

The plan is comprehensive and accurately describes what was implemented. The architecture diagram, edge cases section, and commit strategy are all consistent with the actual implementation.

One note: the plan mentions "Selection tests (`tests/client/selection.test.ts`): `findRangeByContext` with replacement text that exists on page (using existing function — just validates the Tier 2.5 concept)" — these tests were not added in this implementation. Looking at the existing `tests/client/selection.test.ts`, `findRangeByContext` is already tested extensively. The annotator tests provide adequate coverage for Tier 2.5 via mocking. This is a sensible simplification — the session plan was advisory, not prescriptive.

**Findings**: None.

---

## Edge Case Coverage

| Edge Case | Covered? | Where |
|-----------|----------|-------|
| Empty `replacedText` (whitespace-only) | Yes | MCP tool test |
| Empty `replacedText` (empty string `""`) | Partial | MCP handler guards it; REST API does not; no test |
| Element annotation rejects `replacedText` (MCP) | Yes | MCP tool test |
| Element annotation silently ignores `replacedText` (REST) | Yes | Middleware test |
| All tiers fail including 2.5 | Yes | Annotator test |
| No `replacedText` set (backward compat) | Yes | Annotator test |
| Overwrite previous `replacedText` | Yes | MCP tool test |
| `replacedText` with empty string stored → Tier 2.5 skipped | Implicit | `annotation.replacedText` guard in annotator is falsy-safe |

---

## Backward Compatibility

The feature is fully backward-compatible:

- The `replacedText` field is optional and absent from all existing annotations
- The Tier 2.5 block only runs when `annotation.replacedText` is truthy
- The REST API PATCH handler only sets `replacedText` when it is present in the request body as a string
- The panel only renders the struck-through display when `annotation.replacedText` is set
- No store version bump required

---

## Security

No injection risks identified. `replacedText` is:

- Stored as a plain string in JSON
- Displayed via `textContent` (not `innerHTML`) in the panel
- Used as a text search needle in `findRangeByContext` — the function walks text nodes and does string comparison; no DOM injection is possible

The REST API inherits the existing CORS policy (Vite dev-mode permissive CORS), which is documented in the middleware comment. This is pre-existing and not a concern for this feature.

---

## Findings Summary

| ID | Severity | File | Description |
|----|----------|------|-------------|
| F1 | 🟡 Minor → ✅ Fixed | `src/server/middleware.ts` | No empty-string validation for `replacedText` on PATCH — **fixed**: added `ValidationError` check for empty/whitespace-only `replacedText` |
| F2 | 🟡 Minor → ✅ Fixed | `tests/server/middleware.test.ts` | No test for PATCH with `replacedText: ""` — **fixed**: added 'rejects empty replacedText with 400' test |
| F3 | 🟢 Observation | `src/mcp/tools/update-annotation-target.ts` | `replacedText` Zod schema uses `z.string()` rather than `z.string().min(1)` — inconsistent with `id` validation, consistent with `add_agent_reply` precedent |
| F4 | 🟢 Observation | `src/client/ui/panel.ts` | Strike-through uses inline styles rather than a CSS class; `aria-label` absent on the struck/replaced text container |
| F5 | 🟢 Observation | `CLAUDE.md` (pre-existing) | REST API table shows `DELETE /annotations:id` missing `/` — pre-dates this PR |

---

## Recommended Action for F1 + F2

Add validation in `src/server/middleware.ts` inside the PATCH handler, before or inside `storage.mutate`:

```typescript
// After reading body, before storage.mutate:
if (typeof body.replacedText === 'string' && !body.replacedText.trim()) {
  throw new ValidationError('"replacedText" must not be empty or whitespace-only');
}
```

And add a test in `tests/server/middleware.test.ts` inside the `PATCH /annotations/:id replacedText` describe block:

```typescript
it('rejects empty replacedText on text annotation with 400', async () => {
  const createReq = mockRequest('POST', '/__inline-review/api/annotations', {
    type: 'text',
    pageUrl: '/',
    selectedText: 'original',
    note: 'some note',
    range: { startXPath: '/p[1]', startOffset: 0, endXPath: '/p[1]', endOffset: 8, selectedText: 'original', contextBefore: '', contextAfter: '' },
  });
  const createRes = mockResponse();
  await middleware(createReq as any, createRes as any, () => {});
  const created = JSON.parse(createRes._body);

  const patchReq = mockRequest('PATCH', `/__inline-review/api/annotations/${created.id}`, {
    replacedText: '',
  });
  const patchRes = mockResponse();
  await middleware(patchReq as any, patchRes as any, () => {});

  expect(patchRes._status).toBe(400);
  expect(JSON.parse(patchRes._body).error).toContain('"replacedText"');
});
```

F3–F5 are observations only and do not require action before merge.
