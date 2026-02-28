---
generated_by: Claude Opus 4.6
generation_date: 2026-02-28
model_version: claude-opus-4-6
purpose: implementation_plan
status: draft
human_reviewer: matthewvivian
tags: [popup, state-persistence, vite-hmr, ux]
---

# Preserve annotation popup across page reloads

## Context

When a user is typing an annotation note and an agent (e.g. Claude Code) simultaneously edits source files to address a different annotation, Vite/Astro dev mode detects the file change and triggers a full page reload. This destroys the Shadow DOM host, the popup, and the user's unsaved work — both the typed note and the text selection.

The user then has to re-select the same text and retype their note from scratch.

There are two disruption scenarios:
1. **Vite full page reload** (agent edits source files) — everything destroyed. This is the primary problem.
2. **Store poller update** (agent updates annotations via MCP only) — popup survives in Shadow DOM, but `restoreHighlights()` strips/re-applies marks, invalidating the stored `Range` object via `normalize()`.

## Approach

### Part 1: Persist popup state across full page reloads (primary fix)

Save popup state to `sessionStorage` on `beforeunload` so it survives Vite HMR reloads.

**Files:** `src/client/annotator.ts`, `src/client/index.ts`

#### State schema (sessionStorage key: `air-pending-popup`)

```typescript
interface PendingPopupState {
  type: 'text' | 'element';
  note: string;                        // textarea content
  selectedText?: string;               // display text for popup preview
  serializedRange?: SerializedRange;   // from serializeRange() — text annotations
  elementSelector?: ElementSelector;   // from buildElementSelector() — element annotations
}
```

All types are already JSON-serializable (primitives + plain objects).

#### Save flow

1. Add `beforeunload` listener in `index.ts`
2. On fire: check `isPopupVisible(annotator.popup)`
3. If visible: call `annotator.getPendingState()` → returns `PendingPopupState | null`
4. Save to `sessionStorage`

`getPendingState()` — new method on `AnnotatorInstance`:
- Returns `null` if no popup active
- For text: serialises `currentRange` via existing `serializeRange()`, captures `popup.textarea.value`
- For element: serialises `currentElementTarget` via existing `buildElementSelector()`, captures `popup.textarea.value`

#### Restore flow

After `restoreHighlights()` completes in init (existing `.then()` callback):
1. Read `sessionStorage.getItem('air-pending-popup')`
2. If found: call `annotator.restorePendingState(parsed)` → returns boolean
3. Remove the sessionStorage key regardless of success

`restorePendingState()` — new method on `AnnotatorInstance`:
- For text: use existing `deserializeRange()` / `findRangeByContext()` to relocate the range. Set `currentRange`, call `showPopup()`, then set `popup.textarea.value = state.note` immediately after (before rAF fires, since showPopup clears the textarea)
- For element: use existing `resolveElement()` to find the element. Set `currentElementTarget`, call `showElementPopup()`, then set textarea value
- If range/element can't be located: show toast with the saved note text so the user can copy it and retry
- Returns `true` on success, `false` on failure

### Part 2: Defer store poller updates when popup is active (secondary guard)

**Files:** `src/client/index.ts`

Prevents `restoreHighlights()` from invalidating `currentRange` while the user is composing.

1. Add `pendingStoreUpdate` flag
2. In `onStoreChanged`: if `isPopupVisible(annotator.popup)`, set flag and return early
3. Add `MutationObserver` on `annotator.popup.container`, watching `data-air-state` attribute
4. When state changes to `'hidden'` and flag is set: run the deferred `restoreHighlights()` + panel refresh

## Key utilities to reuse

| Utility | Location | Purpose |
|---------|----------|---------|
| `serializeRange()` | `src/client/selection.ts` | Serialise Range → JSON-safe object |
| `deserializeRange()` | `src/client/selection.ts` | Restore Range from XPath+offsets (Tier 1) |
| `findRangeByContext()` | `src/client/selection.ts` | Restore Range from context matching (Tier 2) |
| `buildElementSelector()` | `src/client/element-selector.ts` | Serialise Element → JSON-safe selector |
| `resolveElement()` | `src/client/element-selector.ts` | Restore Element from CSS/XPath |
| `showPopup()` / `showElementPopup()` | `src/client/ui/popup.ts` | Show popup (clears textarea — set value after) |
| `isPopupVisible()` / `hidePopup()` | `src/client/ui/popup.ts` | Popup visibility check/dismiss |
| `showToast()` | `src/client/ui/toast.ts` | User feedback on restore failure |

## Testing

- Unit tests in `tests/client/annotator.test.ts`:
  - `getPendingState()` returns null when no popup active
  - `getPendingState()` returns correct state for text annotation popup
  - `getPendingState()` returns correct state for element annotation popup
  - `restorePendingState()` restores text popup with saved note
  - `restorePendingState()` restores element popup with saved note
  - `restorePendingState()` returns false and shows toast when range unresolvable
- Existing scroll dismissal and orphan tests must still pass

## Verification

1. `npm test` — all tests pass
2. `npm run build && npm run lint` — clean
3. Manual: select text, type note, trigger source file edit (touch an .astro file) → popup should restore with saved note after reload
4. Manual: select text, type note, use MCP `address_annotation` on a different annotation → popup should remain undisrupted
