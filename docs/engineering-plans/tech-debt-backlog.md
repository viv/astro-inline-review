---
generated_by: Claude Opus 4.6
generation_date: 2026-02-22
model_version: claude-opus-4-6
purpose: tech_debt_tracking
status: active
human_reviewer: matthewvivian
tags: [tech-debt, backlog, review-findings]
---

# Tech Debt Backlog

Outstanding items identified during reviews but intentionally deferred. Each item includes the source review, severity, and a suggested approach for when the work is prioritised.

---

## Items

### 1. N+1 Delete in Clear All

**Source:** IMPL-M5 / REM-06
**Severity:** Medium
**Description:** Clear All sends N sequential DELETE API calls — one per annotation. There is no bulk delete endpoint, so deleting a large store produces N round-trips and N individual file writes.
**Suggested approach:** Add a `DELETE /annotations` bulk endpoint to the server middleware that accepts an array of IDs (or deletes all). Update the panel's Clear All handler to call the bulk endpoint instead of looping. This also simplifies the acceptance test, which currently waits for individual DELETE responses.

---

### 2. Inspector Overlay in Light DOM

**Source:** IMPL-M6 / REM-10
**Severity:** Medium
**Description:** The inspector overlay (Alt+hover highlight box) is injected into the light DOM rather than the shadow DOM. This is inconsistent with the rest of the UI, which uses shadow DOM for style isolation. The overlay's inline styles could theoretically be affected by host page CSS.
**Suggested approach:** Move the inspector overlay creation into the shadow root, alongside the other UI elements. This requires passing the shadow root reference into the inspector logic and updating the overlay's positioning calculations to account for shadow DOM containment.

---

### 3. localStorage Cache Has No Invalidation

**Source:** ARCH-M2 / REM-12
**Severity:** Medium
**Description:** The client caches annotation data in localStorage but has no invalidation mechanism. If the JSON file is modified externally (by the MCP server, by hand, or by another browser tab), the cache becomes stale until a full page reload or explicit refresh.
**Suggested approach:** Add a version counter or last-modified timestamp to the JSON file. On each client API call, compare the stored version with the server response. If they differ, invalidate the cache and refetch. Alternatively, use `BroadcastChannel` for cross-tab invalidation and rely on the API response for external changes.

---

### 4. MCP Tool Input Size Limits

**Source:** IMPL-H5 / REM-04
**Severity:** High
**Description:** The MCP tool string inputs (particularly `message` in `add_agent_reply`) have no maximum length validation. A malicious or buggy agent could send an arbitrarily large string, bloating the JSON storage file.
**Suggested approach:** Add `.max()` constraints to the Zod schemas for string parameters — e.g., `z.string().min(1).max(10000)` for the `message` parameter. Choose limits that are generous for legitimate use but prevent abuse. Document the limits in the tool descriptions.

---

### 5. Panel Overlaps Content on Small Viewports

**Source:** UX / REM-53
**Severity:** High
**Description:** The panel is 380px wide at full width and has no responsive breakpoint below 480px. On narrow viewports (mobile or small browser windows), the panel covers the entire page content with no way to see the site underneath.
**Suggested approach:** Add a CSS media query breakpoint at ~480px that either: (a) makes the panel full-width with a close button prominently visible, or (b) switches to a bottom-sheet layout. Consider reducing the panel width proportionally on tablet-sized viewports (768–1024px).

---

### 6. FAB/Panel Z-Index Overlap

**Source:** UX / REM-58
**Severity:** Medium
**Description:** The FAB and panel both use z-index 10000. When the panel is open at full width on narrow viewports, the FAB is occluded behind the panel. The user cannot click the FAB to close the panel.
**Suggested approach:** Give the FAB a higher z-index than the panel (e.g., FAB: 10000, panel: 9999) so the FAB always remains clickable. This is partially addressed by centralising z-index values (REM-65 in Session 9).

---

### 7. Keyboard Shortcut Conflicts with Host Apps

**Source:** UX / REM-59
**Severity:** Medium
**Description:** The keyboard shortcuts (Cmd+Shift+E for export, Cmd+Shift+. for panel) may conflict with host application shortcuts. For example, Cmd+Shift+E opens the Explorer sidebar in VS Code's built-in browser, and some apps use Cmd+Shift+. for other purposes.
**Suggested approach:** Make keyboard shortcuts configurable via the integration options. Accept an optional `shortcuts` object in the Astro config that maps actions to key combinations. Provide sensible defaults but let consumers override them to avoid conflicts with their specific environment.

---

### 8. Extract Inspector from annotator.ts

**Source:** SYS-8 (System Review, 2026-02-21)
**Severity:** Low (code organisation)
**Description:** The inspector overlay logic (keydown/keyup/mousemove handlers, overlay creation/destruction) in `annotator.ts` is self-contained and accounts for a significant portion of the file. Extracting it would improve readability and make the annotator module easier to maintain.
**Suggested approach:** Create `src/client/inspector.ts` containing the overlay creation, positioning, and event handler logic. Export `createInspector(shadowRoot, onElementSelected)` and `destroyInspector()` functions. Update `annotator.ts` to import and delegate to the new module. The inspector's state (`inspectorActive`, overlay element reference) would be encapsulated within the new module.
