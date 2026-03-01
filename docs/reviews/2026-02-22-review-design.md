# UI/UX Design & Accessibility Review

**Date:** 2026-02-22
**Reviewer:** design-reviewer (automated)
**Scope:** Client-side UI — Shadow DOM overlay, FAB, panel, popup, toast, highlights, inspector, keyboard shortcuts

---

## Summary

The review-loop client UI is well-structured, using Shadow DOM for style isolation and a clean component architecture. The annotation workflow (text selection and Alt+click) is functional and the panel/popup model is intuitive. However, there are significant accessibility gaps — particularly around ARIA semantics, focus management, colour contrast, and motion preferences — that should be addressed to meet WCAG 2.1 AA compliance.

**Severity counts:** Critical: 2 | High: 7 | Medium: 8 | Low: 6 | Info: 4

---

## 1. Accessibility

### 1.1 ARIA Roles and Semantics

| Severity | Finding |
|----------|---------|
| **Critical** | **Panel lacks landmark role.** The slide-in panel (`div.air-panel`) has no `role="dialog"` or `role="complementary"` and no `aria-label`. Screen readers cannot identify it as a distinct region. |
| **High** | **Tabs lack ARIA tab pattern.** The "This Page" / "All Pages" buttons use `button` elements but do not implement the [WAI-ARIA Tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/). Missing: `role="tablist"` on container, `role="tab"` on buttons, `role="tabpanel"` on content, `aria-selected`, `aria-controls`/`aria-labelledby` linkage. |
| **High** | **Popup lacks dialog semantics.** `div.air-popup` has no `role="dialog"`, `aria-modal`, or `aria-label`. Screen readers will not announce it when it appears. |
| **Medium** | **Badge count not announced.** The FAB badge (`span.air-fab__badge`) updates its count dynamically but has no `aria-live` region. Screen readers won't announce count changes. Consider `aria-live="polite"` or updating the FAB's `aria-label` to include the count (e.g., "Toggle inline review panel (3 annotations)"). |
| **Medium** | **Toast not accessible.** The toast element has no `role="status"` or `aria-live="polite"`. Toast messages are invisible to screen readers. |
| **Medium** | **Annotation items lack interactive semantics.** Annotation items in the panel are `div` elements with `click` handlers but no `role="button"`, `tabindex="0"`, or keyboard event handlers. They are unreachable via keyboard navigation. |
| **Low** | **Tooltip lacks `role="tooltip"`.** The first-use tooltip should have `role="tooltip"` and be linked to the FAB via `aria-describedby`. |

**Files affected:** `src/client/ui/panel.ts`, `src/client/ui/popup.ts`, `src/client/ui/fab.ts`, `src/client/ui/toast.ts`, `src/client/index.ts`

### 1.2 Focus Management

| Severity | Finding |
|----------|---------|
| **Critical** | **No focus trap in popup.** When the popup appears, focus moves to the textarea, but there is no focus trap. Users can Tab out of the popup into the underlying page. For a modal-like popup with Save/Cancel, focus should be constrained. When dismissed, focus should return to the triggering element. |
| **High** | **Panel has no focus management.** Opening the panel does not move focus into it. Closing the panel does not return focus to the FAB. Keyboard-only users have no clear navigation path. |
| **High** | **Annotation items not keyboard-navigable.** Panel annotation items are `div` elements with only `click` listeners. They need `tabindex="0"` and `keydown` handlers for Enter/Space activation. Same applies to Edit/Delete buttons within items — these are `<button>` elements so they're natively focusable, which is good. |
| **Medium** | **Inspector mode (Alt+hover) is mouse-only.** There is no keyboard equivalent for element annotation. Alt+click requires a pointing device. Consider documenting this limitation or providing a keyboard-driven element picker. |

**Files affected:** `src/client/ui/popup.ts:54-83`, `src/client/ui/panel.ts:153-160`, `src/client/annotator.ts:248-286`

### 1.3 Screen Reader Support

| Severity | Finding |
|----------|---------|
| **Medium** | **Dynamic content updates not announced.** When the panel content refreshes (via `content.innerHTML = ''` and re-rendering), there is no `aria-live` region to announce the change. Resolved badges, orphan indicators, and agent replies would benefit from being within a live region or accompanied by announcements. |
| **Low** | **Orphan indicator text is clear.** The text "Could not locate on page" is descriptive, which is good. However, the red colour alone is insufficient for colourblind users — the text content addresses this well. |
| **Low** | **Resolved badge uses checkmark character.** `\u2714 Resolved` is acceptable, but `aria-label="Resolved"` would be cleaner for screen readers that may read "check mark Resolved". |

---

## 2. Colour Contrast

### 2.1 WCAG AA Analysis (4.5:1 for normal text, 3:1 for large text)

| Element | Foreground | Background | Ratio | Verdict |
|---------|-----------|------------|-------|---------|
| Panel body text | `#e5e5e5` | `#1a1a1a` | ~14.8:1 | **Pass** |
| Panel title | `#f5f5f5` | `#1a1a1a` | ~17.4:1 | **Pass** |
| Inactive tab text | `#999` | `#1a1a1a` | ~5.4:1 | **Pass** |
| Empty state text | `#666` | `#1a1a1a` | ~3.4:1 | **Borderline** |
| Annotation note text | `#ccc` | `#242424` | ~9.2:1 | **Pass** |
| Annotation selected text | `#FCD34D` | `#242424` | ~10.0:1 | **Pass** |
| Orphan indicator | `#F87171` | `#242424` | ~4.9:1 | **Pass** |
| Resolved badge | `#22C55E` | `#242424` | ~5.5:1 | **Pass** |
| Resolved timestamp | `#888` | `#242424` | ~4.1:1 | **Borderline** |
| Reply text | `#ccc` | `#1a2a1a` | ~8.6:1 | **Pass** |
| Reply prefix | `#22C55E` | `#1a2a1a` | ~5.0:1 | **Pass** |
| Reply timestamp | `#888` | `#1a2a1a` | ~3.7:1 | **Borderline** |
| Export button | `#FCD34D` | `#2a2a2a` | ~9.3:1 | **Pass** |
| Danger button | `#fca5a5` | `#2a2a2a` (default) / `#7f1d1d` (delete bg) | ~7.5:1 / ~4.5:1 | **Pass** |
| Panel button text | `#e5e5e5` | `#2a2a2a` | ~10.7:1 | **Pass** |
| Popup textarea text | `#e5e5e5` | `#242424` | ~11.5:1 | **Pass** |
| Save button | white | `#D97706` | ~3.0:1 | **Fail (large text only)** |
| Cancel button | `#ccc` | `#333` | ~5.4:1 | **Pass** |
| Toast text | `#e5e5e5` | `#1a1a1a` | ~14.8:1 | **Pass** |

| Severity | Finding |
|----------|---------|
| **High** | **Save button contrast fails.** White (`#fff`) on `#D97706` amber gives approximately 3.0:1 contrast, which fails WCAG AA for normal-size text (12px). At 12px/regular weight this is well below the 4.5:1 requirement. Consider darkening the button background to `#92400E` or using dark text on the amber background. |
| **Medium** | **Empty state text is borderline.** `#666` on `#1a1a1a` (~3.4:1) is below the 4.5:1 minimum. Consider lightening to `#888` (4.1:1) or `#999` (5.4:1). |
| **Low** | **Timestamps are borderline.** `#888` on `#242424` and `#1a2a1a` sit around 3.7-4.1:1. These are small text (10-11px), where 4.5:1 is required. Consider `#999` or `#aaa`. |

**File affected:** `src/client/styles.ts`

### 2.2 Highlight Visibility

| Severity | Finding |
|----------|---------|
| **Low** | **Text highlight opacity is low.** `rgba(217,119,6,0.3)` is a subtle overlay. On dark backgrounds or coloured text, annotations may be hard to spot. The pulse animation (temporarily raising to `0.6`) helps discoverability. Acceptable but worth monitoring in user testing. |
| **Info** | **Element highlight outline is clearly visible.** `2px dashed rgba(217,119,6,0.8)` with `2px offset` provides good visual separation. Resolved state at `rgba(34,197,94,0.5)` is also visible. |

---

## 3. Responsive Design

| Severity | Finding |
|----------|---------|
| **High** | **Panel overlaps content on small viewports.** The panel is `380px` wide by default and goes full-width below `480px`. On viewports between 480-760px, the panel covers roughly half the screen with no way to resize or minimise. There is no breakpoint at tablet sizes. |
| **Medium** | **Popup may be clipped on mobile.** The popup is a fixed `300px` wide. On very small viewports (<320px), it leaves only 10-20px margins. The `positionPopup` function clamps `left` to `MARGIN (8px)`, which is adequate but tight. |
| **Info** | **FAB position is fixed.** `bottom: 24px; right: 24px` works across viewports. The 48px size is a good touch target (meets the 44px minimum recommendation). |
| **Info** | **Toast and tooltip position.** `bottom: 80px; right: 24px` correctly positions above the FAB. No responsive issues identified. |

**File affected:** `src/client/styles.ts:81-108`

---

## 4. Z-Index Management

| Element | Z-Index | Purpose |
|---------|---------|---------|
| Inspector overlay | 9999 | Below UI controls |
| FAB | 10000 | Primary entry point |
| Panel | 10000 | Slide-in sidebar |
| Popup | 10001 | Above panel |
| Toast | 10002 | Topmost notification |
| Tooltip | 10002 | Same as toast |

| Severity | Finding |
|----------|---------|
| **Medium** | **FAB and panel share z-index 10000.** When the panel is open, the FAB could be occluded on narrow viewports where the panel goes full-width. The FAB should ideally be above the panel (e.g., 10001) or the panel should leave room for the FAB. |
| **Low** | **Toast and tooltip share z-index 10002.** These should never appear simultaneously in practice, but could theoretically overlap. Low risk. |
| **Info** | **No z-index constants file.** Z-indexes are scattered across `styles.ts` and inline styles in `annotator.ts`. A centralised z-index scale would improve maintainability. |

---

## 5. Animation & Motion

| Severity | Finding |
|----------|---------|
| **High** | **No `prefers-reduced-motion` support.** The codebase uses multiple transitions and animations: panel slide (0.3s cubic-bezier), FAB scale (0.2s ease), toast fade (0.2s), tooltip fade (0.3s), empty-state nudge animation (1.5s infinite), highlight pulse (0.3s + timeouts). None of these respect `prefers-reduced-motion: reduce`. Users who experience motion sickness or vestibular disorders cannot disable animations. |

**Recommendation:** Add a media query to `styles.ts`:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```
And in JavaScript (highlights.ts pulse functions), check `window.matchMedia('(prefers-reduced-motion: reduce)').matches` before applying timed colour transitions.

**Files affected:** `src/client/styles.ts`, `src/client/highlights.ts:83-98, 132-145`

---

## 6. Shadow DOM Boundary

| Severity | Finding |
|----------|---------|
| **Info** | **Style scoping is clean.** All UI styles are injected into the shadow root via `getAllStyles()`. The `:host { all: initial }` reset prevents style inheritance from the host page. Box-sizing is applied to all children. No style leaks identified. |
| **Medium** | **Light DOM modifications for highlights.** Text highlights inject `<mark>` elements with inline styles directly into the host page's light DOM. Element highlights modify `style.outline` on host page elements. These are necessary for the overlay to work but could conflict with host page styles that target `mark` elements or elements with outline styles. CSS `!important` declarations on the host page could override highlight styles. |
| **Low** | **Inspector overlay is in light DOM.** The inspector overlay (`data-air-el="inspector-overlay"`) is appended to `document.body`, not the shadow root. This is intentional (it needs to overlay host page elements) but means its inline styles could be affected by host page CSS. |

---

## 7. UX Patterns

### 7.1 Annotation Workflow

| Severity | Finding |
|----------|---------|
| **High** | **Text selection popup dismisses on scroll.** The `onScroll` handler in `annotator.ts:129-135` hides the popup and clears the current range/element target. If a user scrolls even slightly while typing a note, their work is lost. This is aggressive — consider only dismissing if the scroll distance exceeds a threshold, or making the popup position fixed relative to viewport rather than absolute. |
| **Medium** | **No unsaved changes warning.** If the user has typed a note in the popup textarea and clicks Cancel or presses Escape, the content is immediately discarded. No confirmation prompt is shown. For quick annotations this may be fine, but for longer notes it could be frustrating. |

### 7.2 Discoverability

| Severity | Finding |
|----------|---------|
| **Low** | **First-use tooltip is well-implemented.** The tooltip persists via `localStorage`, appears for 8 seconds, dismisses on click, and fades out. The text "Select text to annotate it, or Alt+click any element" clearly communicates both annotation methods. |
| **Low** | **Keyboard shortcuts are not discoverable in the UI.** The shortcuts (Cmd/Ctrl+Shift+., Escape, Cmd/Ctrl+Shift+E, Cmd/Ctrl+Shift+N) are not shown anywhere in the UI — no help dialog, no tooltip on buttons, no panel footer. Users must discover them through documentation only. |

---

## 8. Error States

| Severity | Finding |
|----------|---------|
| **Medium** | **API errors are console-only.** All API failures (`catch` blocks in `annotator.ts`, `panel.ts`) log to `console.error` but show no user-visible feedback. The user may save an annotation that silently fails, or delete one that doesn't actually delete. Consider using the existing toast system to show error messages (e.g., "Failed to save annotation. Please try again."). |
| **Medium** | **Panel shows generic "Failed to load annotations" on API failure.** This message (`panel.ts:201`) is static and gives no guidance on resolution (e.g., "Is the dev server running?"). |
| **Low** | **No offline detection.** The tool is dev-only (localhost), so offline is unlikely. However, if the dev server restarts or crashes, API calls will fail silently. No reconnection logic or visual indicator exists. Acceptable for a dev tool. |

---

## 9. Keyboard Shortcuts

| Severity | Finding |
|----------|---------|
| **Medium** | **Potential conflicts with host applications.** `Cmd+Shift+.` may conflict with VS Code's "Show Terminal" shortcut or other IDE shortcuts when the dev preview is embedded in an IDE's browser panel. `Cmd+Shift+E` conflicts with VS Code's "Show Explorer" and Firefox's "Toggle Storage" in Developer Tools. |
| **Low** | **Escape handling is greedy for panel close.** The Escape handler fires in capture phase and does not call `e.stopPropagation()` or `e.preventDefault()`, which means the Escape event will continue propagating to the host page. This is actually correct behaviour — but the panel/popup close response (`closeActive` in `index.ts:143-151`) provides no feedback to the user about what was dismissed. |

**Recommendation:** Consider `stopPropagation()` and `preventDefault()` when actually handling Escape (when popup or panel is closed), and letting it through when neither is open. Currently the handler always calls `handlers.closeActive()` even when nothing is open.

**File affected:** `src/client/shortcuts.ts:35-37`

---

## 10. Toast Notifications

| Severity | Finding |
|----------|---------|
| **Low** | **Toast auto-dismiss timing is reasonable.** 2500ms is standard for brief success messages. No manual dismiss option exists, but `pointer-events: none` means the toast doesn't interfere with interaction. |
| **Medium** | **Toast is not accessible.** No `role="status"` or `aria-live`. See Section 1.1. |

---

## 11. Inspector Overlay (Element Annotations)

| Severity | Finding |
|----------|---------|
| **Low** | **Inspector visual feedback is clear.** The blue highlight (`rgba(66,133,244,0.15)` background, `rgba(66,133,244,0.6)` border) is distinct from the amber annotation highlights. The monospace label showing the element selector is informative. |
| **Medium** | **Inspector label can overflow.** The label (`inspectorLabel`) uses `white-space: nowrap` and has no `max-width` or `overflow: hidden`. Long class names or selectors could extend off-screen. |

**File affected:** `src/client/annotator.ts:198-212`

---

## 12. Orphan Indicator

| Severity | Finding |
|----------|---------|
| **Low** | **Orphan styling is clear.** The combination of `opacity: 0.7`, `border-left: 3px solid #F87171` (red), and text "Could not locate on page" effectively communicates that the annotation's target has changed. Uses both colour and text — good for colourblind users. |

---

## 13. Panel Usability

| Severity | Finding |
|----------|---------|
| **High** | **Delete buttons have no confirmation.** Annotation delete buttons in the panel (`data-air-el="annotation-delete"`) immediately call `callbacks.onAnnotationDelete(annotation.id)` with no confirmation step. This is inconsistent with "Clear All" which has a two-click confirmation. A single accidental click permanently deletes an annotation. |
| **Medium** | **Panel scrolling works correctly.** `overflow-y: auto` on `.air-panel__content` with `flex: 1` provides proper scrolling. No issues identified. |
| **Low** | **Page grouping in "All Pages" tab is clear.** The `air-page-group__title` styling with bottom border provides good visual separation between pages. |

---

## 14. Popup Design

| Severity | Finding |
|----------|---------|
| **Medium** | **Popup positioning can be obscured by panel.** Both the panel (z-index 10000) and popup (z-index 10001) are positioned `fixed`. If the user opens the panel and then tries to annotate text that happens to be behind the panel, the popup appears above the panel but the text selection underneath is hidden. |
| **Low** | **Popup footer button ordering is logical.** Delete (left, danger colour) | Cancel (centre) | Save (right, primary colour). The `margin-right: auto` on delete pushes it left, creating visual separation from the safe actions. Good pattern. |

---

## Recommendations Summary (prioritised)

### Must Fix (Critical + High)
1. Add `role="dialog"` and `aria-label` to popup and panel
2. Implement focus trap in popup; return focus on dismiss
3. Implement WAI-ARIA tabs pattern for panel tabs
4. Add `prefers-reduced-motion` media query and JS checks
5. Move panel focus on open, return to FAB on close
6. Make annotation items keyboard-navigable (`tabindex="0"`, `keydown`)
7. Fix Save button contrast (`#fff` on `#D97706` fails WCAG AA)
8. Add confirmation step for individual annotation deletion
9. Address scroll-dismisses-popup UX issue (threshold or debounce)

### Should Fix (Medium)
10. Add `aria-live="polite"` to badge, toast, and panel content
11. Add `role="status"` to toast element
12. Surface API errors via toast rather than console-only
13. Add `max-width` to inspector label
14. Fix FAB/panel z-index overlap at full-width breakpoint
15. Improve empty-state and timestamp text contrast
16. Add keyboard shortcut hints to UI (e.g., button tooltips)
17. Clamp inspector label overflow

### Nice to Have (Low + Info)
18. Add `role="tooltip"` and `aria-describedby` to first-use tooltip
19. Centralise z-index values into constants
20. Consider documenting mouse-only limitation of element annotation
21. Monitor highlight opacity visibility in user testing
