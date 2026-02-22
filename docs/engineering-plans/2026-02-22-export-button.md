---
generated_by: Claude Opus 4.6
generation_date: 2026-02-22
model_version: claude-opus-4-6
purpose: implementation_plan
status: implemented
human_reviewer: matthewvivian
implementation_tracking: completed
tags: [export, clipboard, ui, button, panel]
---

# Export Button — Engineering Plan

## Problem

Export to clipboard is currently keyboard-shortcut-only (`Cmd/Ctrl+Shift+E`).
This isn't discoverable and doesn't work for users who don't know or use the shortcut.
A visible button is needed.

## Decision: Where to Put the Button

**Chosen approach: Single "Copy All" button in the panel header, alongside "+ Note" and "Clear All".**

Rationale:

- **One button, not per-tab.** The existing keyboard shortcut already exports _all_ pages (not just the active tab). A single button keeps parity with that behaviour and avoids confusion about scope. The spec (§9.3) says the export "fetches the full (unfiltered) store from the server" — i.e. everything.
- **Panel header placement.** The header already has an actions row with "+ Note" and "Clear All". Adding "Copy All" here is consistent, discoverable, and doesn't need new layout.
- **Not on the FAB.** The FAB toggles the panel. Overloading it with export would be confusing.
- **Not per-tab.** Adding separate export buttons per tab adds complexity without clear value — the "All Pages" tab already shows everything, and exporting only "This Page" would be a different feature.

## Implementation

### Session 1: Add the export button + update tests + update spec

**Files to modify:**

1. **`src/client/ui/panel.ts`** — Add a "Copy All" button to the header actions row
2. **`src/client/ui/panel.ts`** — Wire button click to export logic via a new callback
3. **`src/client/index.ts`** — Provide the export callback to the panel
4. **`src/client/styles.ts`** — Add export button style (subtle accent to distinguish from "+ Note")
5. **`tests/client/ui/panel.test.ts`** — New test file for the export button in the panel
6. **`tests/client/shortcuts.test.ts`** — No changes needed (keyboard export is unchanged)
7. **`tests/client/export.test.ts`** — No changes needed (export logic is unchanged)
8. **`docs/spec/specification.md`** — Update §6.2 (panel), §9.3 (clipboard export), §14 (data attributes), and action-response table

### Detailed Changes

#### 1. Panel: Add export button (`src/client/ui/panel.ts`)

Add a new callback to `PanelCallbacks`:

```typescript
export interface PanelCallbacks {
  onAnnotationClick: (annotationId: string) => void;
  onRefreshBadge: () => Promise<void>;
  onExport: () => Promise<void>;  // NEW
}
```

In `createPanel()`, after the "+ Note" button and before "Clear All", add:

```typescript
const exportBtn = document.createElement('button');
exportBtn.className = 'air-panel__btn air-panel__btn--export';
exportBtn.setAttribute('data-air-el', 'export');
exportBtn.textContent = 'Copy All';
exportBtn.title = 'Copy all annotations to clipboard as Markdown';
exportBtn.addEventListener('click', () => callbacks.onExport());
actions.appendChild(exportBtn);
```

Button ordering in the header will be: `+ Note` | `Copy All` | `Clear All`

This places the constructive actions together (add note, copy) and the destructive action (clear) at the end.

#### 2. Client bootstrap: Provide export callback (`src/client/index.ts`)

Pass the existing export logic to the panel callbacks:

```typescript
const panel = createPanel(shadowRoot, {
  onAnnotationClick: (id) => { /* existing */ },
  onRefreshBadge: refreshBadge,
  onExport: async () => {
    const store = await api.getStore();
    const success = await exportToClipboard(store);
    showToast(shadowRoot, success ? 'Copied to clipboard!' : 'Export failed — try again');
  },
}, mediator);
```

This is identical to the keyboard shortcut's export handler — same fetch, same export function, same toast.

#### 3. Styles: Export button accent (`src/client/styles.ts`)

Add a subtle accent variant to distinguish "Copy All" from the neutral "+ Note":

```css
.air-panel__btn--export {
  border-color: #D97706;
  color: #FCD34D;
}

.air-panel__btn--export:hover {
  background: #78350F;
}
```

This uses the existing orange accent colour, consistent with the FAB and active tab.

#### 4. Tests: Panel export button (`tests/client/ui/panel.test.ts`)

New test file covering:

- Export button is rendered in the panel header with correct `data-air-el="export"`
- Clicking the export button calls `onExport` callback
- Export button has the correct title attribute (for tooltip)
- Export button has the accent class `air-panel__btn--export`

#### 5. Spec updates (`docs/spec/specification.md`)

**§6.2 (Panel)**: Add "Copy All" to the header description:
> Header: Title "Inline Review" + action buttons ("+ Note", "Copy All", "Clear All")

**§9.3 (Clipboard Export)**: Add that export can now be triggered via button:
> Export can be triggered by either:
> - The "Copy All" button in the panel header
> - The keyboard shortcut `Cmd/Ctrl + Shift + E`

**§14 (Automation Contract)**: Add the new data attribute:
> `data-air-el="export"` on the Copy All button

**Appendix A**: Add new row:
> Click "Copy All" button | Export all annotations to clipboard, show toast | 9.3

### What Stays the Same

- **Export logic** (`src/client/export.ts`): Unchanged. Both button and shortcut use the same `exportToClipboard()` function.
- **Keyboard shortcut** (`Cmd/Ctrl+Shift+E`): Still works. The button is an additional trigger, not a replacement.
- **Export scope**: Always all pages. No per-page export.
- **Toast feedback**: Same messages for both button and shortcut.
- **Server export endpoint** (`GET /export`): Unchanged.

### Test Plan

- [ ] Unit test: Export button renders in panel
- [ ] Unit test: Button click calls onExport callback
- [ ] Unit test: Button has correct data-air-el attribute
- [ ] Unit test: Button has accent styling class
- [ ] Manual: Open panel, click "Copy All", verify toast and clipboard content
- [ ] Manual: Verify keyboard shortcut still works
- [ ] Build passes (`pnpm build`)
- [ ] All unit tests pass (`pnpm test`)
- [ ] Acceptance tests in separate repo still pass (no breaking changes expected — new button is additive)
