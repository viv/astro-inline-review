---
generated_by: Claude Opus 4.6
generation_date: 2026-02-22
model_version: claude-opus-4-6
purpose: implementation_plan
status: implemented
human_reviewer: matthewvivian
implementation_tracking: completed
tags: [context-scoring, text-highlight, annotation-location, findRangeByContext]
---

# Context Scoring Improvements — Engineering Plan

GitHub Issue: #13 — "Context scoring for annotation location is brittle and lacks confidence threshold"

## Context

The `findRangeByContext()` function in `src/client/selection.ts` is the Tier 2 fallback for restoring text annotation highlights when XPath resolution fails (e.g. after DOM changes). It searches for the annotation's `selectedText` in the page, then uses stored `contextBefore` and `contextAfter` strings to disambiguate when the same text appears multiple times.

The current scoring has three weaknesses:

1. **Cliff-edge scoring**: Binary check — full 30-char context match scores `contextBefore.length`, a 10-char `includes()` match scores 5, anything else scores 0. A 28/30 character match scores the same as 0/30.
2. **No confidence threshold**: A single occurrence with score 0 is always returned, risking false positives.
3. **Imprecise partial matching**: `includes()` matches the substring anywhere in the nearby text, not at the boundary where context should be.

## Design Decisions

### Graduated scoring via longest boundary match

Replace the binary full/partial checks with two helper functions:

- `longestMatchingSuffix(text, suffix)` — finds the longest tail of `suffix` that matches the end of `text`
- `longestMatchingPrefix(text, prefix)` — finds the longest head of `prefix` that matches the start of `text`

The scoring becomes:
```typescript
score += longestMatchingSuffix(before, contextBefore);
score += longestMatchingPrefix(after, contextAfter);
```

This gives a smooth gradient from 0 to `contextBefore.length + contextAfter.length` (typically 0–60), where each matching character contributes 1 point. Performance is negligible — worst case is 30 iterations per side per candidate.

### Minimum confidence threshold

After scoring all candidates, require a minimum proportion of context to match:

```typescript
const maxPossibleScore = contextBefore.length + contextAfter.length;
const MIN_CONFIDENCE_RATIO = 0.3;

if (bestScore < maxPossibleScore * MIN_CONFIDENCE_RATIO) {
  return null; // No confident match — treat as orphaned
}
```

The 0.3 threshold means at least ~18 of 60 possible context characters must match at the boundaries. This prevents false positives where text appears on the page but in a completely different location.

**Edge case**: When both context strings are empty (`maxPossibleScore === 0`), any match is accepted (score 0 >= 0 * 0.3 = 0). This preserves backward compatibility for annotations captured at text node boundaries where no context was available.

### Removal of includes() partial matching

The `includes()` check becomes unnecessary — a 10-character boundary match naturally scores 10 points with graduated scoring. Removing it eliminates false-positive risk from coincidental substring matches.

## Files Changed

| File | Change |
|------|--------|
| `src/client/selection.ts` | Add helper functions, replace scoring logic, add threshold |
| `tests/client/selection.test.ts` | Add tests for helpers and new scoring behaviour |
| `docs/spec/specification.md` | Update sections 8.4 and 15.3 |

## Implementation Steps

### Step 1: Implement helper functions

Add `longestMatchingSuffix` and `longestMatchingPrefix` as exported functions in `src/client/selection.ts`. These are pure functions with no side effects.

```typescript
export function longestMatchingSuffix(text: string, suffix: string): number {
  const maxLen = Math.min(text.length, suffix.length);
  for (let len = maxLen; len > 0; len--) {
    if (text.endsWith(suffix.slice(suffix.length - len))) {
      return len;
    }
  }
  return 0;
}

export function longestMatchingPrefix(text: string, prefix: string): number {
  const maxLen = Math.min(text.length, prefix.length);
  for (let len = maxLen; len > 0; len--) {
    if (text.startsWith(prefix.slice(0, len))) {
      return len;
    }
  }
  return 0;
}
```

### Step 2: Replace scoring in findRangeByContext

Replace lines 158–177 of `src/client/selection.ts`:

**Before:**
```typescript
let bestMatch = matches[0];
let bestScore = -1;

for (const matchIdx of matches) {
  let score = 0;
  const before = fullText.slice(Math.max(0, matchIdx - contextBefore.length), matchIdx);
  const after = fullText.slice(matchIdx + selectedText.length, matchIdx + selectedText.length + contextAfter.length);

  if (before.endsWith(contextBefore)) score += contextBefore.length;
  else if (before.includes(contextBefore.slice(-10))) score += 5;

  if (after.startsWith(contextAfter)) score += contextAfter.length;
  else if (after.includes(contextAfter.slice(0, 10))) score += 5;

  if (score > bestScore) {
    bestScore = score;
    bestMatch = matchIdx;
  }
}
```

**After:**
```typescript
const MIN_CONFIDENCE_RATIO = 0.3;

let bestMatch = matches[0];
let bestScore = -1;

for (const matchIdx of matches) {
  const before = fullText.slice(Math.max(0, matchIdx - contextBefore.length), matchIdx);
  const after = fullText.slice(matchIdx + selectedText.length, matchIdx + selectedText.length + contextAfter.length);

  const score = longestMatchingSuffix(before, contextBefore)
    + longestMatchingPrefix(after, contextAfter);

  if (score > bestScore) {
    bestScore = score;
    bestMatch = matchIdx;
  }
}

// Require minimum confidence to avoid false positives
const maxPossibleScore = contextBefore.length + contextAfter.length;
if (maxPossibleScore > 0 && bestScore < maxPossibleScore * MIN_CONFIDENCE_RATIO) {
  return null;
}
```

### Step 3: Write tests

Tests for helper functions:
- Full suffix/prefix match returns full length
- Partial match returns correct length (e.g. 28 of 30)
- No match returns 0
- Empty input returns 0
- Very short strings work correctly

Tests for findRangeByContext graduated scoring:
- Full context match still works
- Partial context match (28/30 chars) still finds the right match
- Below threshold returns null (not a false positive)
- Single occurrence with zero context confidence returns null
- Empty context strings accept any match (backward compatibility)
- Multiple equally-scored matches: first occurrence wins

### Step 4: Update specification

Update `docs/spec/specification.md`:
- Section 15.3: Replace the scoring algorithm description with graduated scoring
- Section 15.3: Add confidence threshold documentation
- Section 8.4: Note that Tier 2 may return null if below confidence threshold, falling through to Tier 3

## Testing Strategy

All tests run in vitest with happy-dom environment. The `findRangeByContext` function operates on `document.body`, so tests set `document.body.innerHTML` to controlled HTML content.

The existing test "falls back to first match when context does not disambiguate" will need updating — the current behaviour returns the first match with score 0, but the new behaviour returns null when context doesn't match and maxPossibleScore > 0.

## Risk Assessment

**Low risk**: This is a focused change to one function with clear test coverage. The main risk is the confidence threshold being too aggressive, but 0.3 is conservative (only 18/60 chars needed) and the empty-context edge case preserves backward compatibility.
