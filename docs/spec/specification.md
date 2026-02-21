---
generated_by: Claude Opus 4.6
generation_date: 2026-02-20
model_version: claude-opus-4-6
purpose: component_specification
status: reviewed
human_reviewer: matthewvivian
tags: [astro, integration, annotation, dev-tools, specification]
---

# astro-inline-review: Component Specification

## 1. Overview

**astro-inline-review** is a dev-only text annotation overlay for Astro projects. It enables users to select text on any rendered page, attach notes, and export structured Markdown for editorial review or AI-assisted copy editing.

The integration ships **zero bytes** in production builds. All UI, storage, and API infrastructure exists only during `astro dev`.

### 1.1 Design Principles

1. **Dev-only**: No traces in production builds (no scripts, no host elements, no API references)
2. **Zero-config**: Works with a single line in `astro.config.mjs`
3. **Non-invasive**: Shadow DOM isolates all UI from site styles; highlights use inline styles
4. **Persistent**: Annotations survive page reloads, navigation, and dev server restarts
5. **Multi-page**: Annotations are scoped by URL but viewable across all pages
6. **Exportable**: One-click Markdown export for actionable editorial feedback


## 2. Integration Lifecycle

### 2.1 Installation

The integration is added as a dev dependency and configured in `astro.config.mjs`:

```javascript
import inlineReview from 'astro-inline-review';

export default defineConfig({
  integrations: [inlineReview()],
});
```

### 2.2 Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `storagePath` | `string` | `'inline-review.json'` in project root | Path to the JSON storage file |

### 2.3 Design Boundary

Additional configuration options (theme, position, keybindings, storage backend) are intentionally omitted to maintain zero-config simplicity. The integration is designed for dev-only use where customisation is low priority. Any future options should be justified against the zero-config principle.

### 2.4 Activation Rules

- The integration **only activates** when `command === 'dev'` (i.e. during `astro dev`)
- When `command === 'build'` or `command === 'preview'`, the hook returns immediately
- No scripts are injected, no middleware is registered, no host element exists in production

### 2.5 What Happens on Activation

During `astro dev`, the integration:

1. Resolves the storage file path relative to the project root
2. Creates a `ReviewStorage` instance for JSON file I/O
3. Registers a Vite dev server middleware plugin that serves the REST API
4. Injects the client script on every page via `injectScript('page', ...)`


## 3. Data Model

### 3.1 ReviewStore

The root data structure persisted in `inline-review.json`:

```typescript
interface ReviewStore {
  version: 1;
  annotations: Annotation[];
  pageNotes: PageNote[];
}
```

- `version` must be exactly `1`. Any other value causes the store to be treated as invalid.
- `annotations` and `pageNotes` must both be arrays. Non-array values cause the store to be treated as invalid.

### 3.2 Annotation

```typescript
interface Annotation {
  id: string;           // Server-generated unique ID
  pageUrl: string;      // window.location.pathname at creation time
  pageTitle: string;    // document.title at creation time
  selectedText: string; // The verbatim text the user selected
  note: string;         // User's annotation note (may be empty)
  range: SerializedRange;
  createdAt: string;    // ISO 8601 timestamp, server-generated
  updatedAt: string;    // ISO 8601 timestamp, updated on each edit
}
```

### 3.3 PageNote

```typescript
interface PageNote {
  id: string;
  pageUrl: string;
  pageTitle: string;
  note: string;         // Must be non-empty (empty notes are not saved)
  createdAt: string;
  updatedAt: string;
}
```

### 3.4 SerializedRange

Captures enough information for three-tier highlight restoration:

```typescript
interface SerializedRange {
  startXPath: string;      // XPath to the start text node
  startOffset: number;     // Character offset within start node
  endXPath: string;        // XPath to the end text node
  endOffset: number;       // Character offset within end node
  selectedText: string;    // Verbatim selected text (for XPath validation — see note below)
  contextBefore: string;   // Exactly 30 characters before selection (or fewer if insufficient text exists)
  contextAfter: string;    // Exactly 30 characters after selection (or fewer if insufficient text exists)
}
```

**selectedText duplication**: The `selectedText` in `SerializedRange` duplicates `Annotation.selectedText`. The range's copy exists for independent validation during Tier 1 highlight restoration — the deserialised range's `.toString()` is compared against `SerializedRange.selectedText` to verify the XPath still points to the correct text. The annotation-level copy is used for UI display (panel, popup preview, export).

### 3.5 ID Generation

IDs are generated server-side using: `Date.now().toString(36) + Math.random().toString(36).slice(2, 8)`

**Collision resistance**: The combination of millisecond timestamp (base-36) and 6 random characters (base-36, ~2.18 billion combinations) makes collisions negligible for single-user use. No server-side deduplication guard is implemented. If two annotations are created in the same millisecond, the random suffix provides sufficient differentiation.


## 4. Server Architecture

### 4.1 JSON File Storage

**Source of truth**: `inline-review.json` in the project root (configurable via `storagePath`).

**Behaviour**:
- **Reads** always come from disk (no in-memory cache). This means external edits to the JSON file are picked up immediately.
- **Writes** are queued via a promise chain to prevent concurrent file corruption. Each write serialises the entire store as pretty-printed JSON.
- **Missing file**: Returns an empty store (`{ version: 1, annotations: [], pageNotes: [] }`)
- **Corrupted JSON**: Returns an empty store (silent recovery)
- **Invalid schema** (wrong version, non-array fields): Returns an empty store (silent recovery)

### 4.2 REST API

All routes are served via Vite dev server middleware at the prefix `/__inline-review/api`.

#### 4.2.1 Annotation Endpoints

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| `GET` | `/annotations` | List all annotations | 200 |
| `GET` | `/annotations?page=/path` | List annotations filtered by page URL | 200 |
| `POST` | `/annotations` | Create a new annotation | 201 |
| `PATCH` | `/annotations/:id` | Update an annotation (note field) | 200 |
| `DELETE` | `/annotations/:id` | Delete an annotation | 200 |

**GET /annotations** response shape:
```json
{
  "version": 1,
  "annotations": [...],
  "pageNotes": [...]
}
```

Note: The GET response returns the full store shape (including `pageNotes`), with annotations optionally filtered by `?page=`. This allows the client to cache the full store from a single request.

**Filter behaviour**: The `?page=` query parameter only filters the `annotations` array. The `pageNotes` array is **always returned unfiltered**, regardless of the `?page=` parameter. This is intentional — the client uses a single `GET /annotations` request to populate its cache with all page notes, then applies local filtering in the panel's "This Page" tab (filtering by `window.location.pathname`).

**Response with `?page=` filter**:
```json
{
  "version": 1,
  "annotations": [ /* only annotations matching the page filter */ ],
  "pageNotes": [ /* ALL page notes, unfiltered */ ]
}
```

**POST /annotations** request body:
```json
{
  "pageUrl": "/",
  "pageTitle": "Home",
  "selectedText": "example text",
  "note": "my note",
  "range": { ... }
}
```

The server generates `id`, `createdAt`, and `updatedAt` fields. Missing fields default to empty strings/objects.

**PATCH /annotations/:id** request body: Any subset of annotation fields.

**Field mutability on PATCH**:

| Field | Mutable? | Notes |
|-------|----------|-------|
| `id` | No | Server-enforced, always preserved |
| `pageUrl` | Yes | Allows moving annotation to different page |
| `pageTitle` | Yes | |
| `selectedText` | Yes | Not typically changed by the client |
| `note` | Yes | Primary use case for PATCH |
| `range` | Yes | Not typically changed by the client |
| `createdAt` | Yes* | *Not protected — considered a minor issue |
| `updatedAt` | No | Server-generated on every PATCH |

**Minimum validation**: `POST /annotations` does not enforce required fields. An empty body creates an annotation with all empty-string fields. The client always provides `pageUrl`, `selectedText`, `note`, and `range`. Server-side validation is not enforced — the server trusts the client as this is a dev-only tool.

**DELETE /annotations/:id**: Returns `{ "ok": true }` on success. Returns 404 if the ID does not exist.

#### 4.2.2 Page Note Endpoints

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| `GET` | `/page-notes` | List all page notes | 200 |
| `GET` | `/page-notes?page=/path` | List page notes filtered by page URL | 200 |
| `POST` | `/page-notes` | Create a new page note | 201 |
| `PATCH` | `/page-notes/:id` | Update a page note | 200 |
| `DELETE` | `/page-notes/:id` | Delete a page note | 200 |

Same CRUD semantics as annotation endpoints (POST creates with server-generated ID/timestamps, PATCH updates by ID, DELETE removes by ID).

**GET /page-notes** response shape: Returns filtered page notes but **unfiltered** annotations (the mirror of the annotation endpoint's asymmetry):
```json
{
  "version": 1,
  "annotations": [ /* ALL annotations, unfiltered */ ],
  "pageNotes": [ /* only page notes matching the page filter */ ]
}
```

**Client usage**: The client exclusively uses `GET /annotations` as its store-fetch endpoint. The response from `GET /annotations` includes both the `annotations` and `pageNotes` arrays, making `GET /page-notes` redundant for normal client operation. The `GET /page-notes` endpoint exists for API completeness and potential external tool use (e.g. curl-based debugging).

#### 4.2.3 Export Endpoint

| Method | Path | Description | Content-Type |
|--------|------|-------------|--------------|
| `GET` | `/export` | Generate Markdown export | `text/markdown; charset=utf-8` |

Returns raw Markdown text (not JSON). See [Section 9: Markdown Export](#9-markdown-export) for format details.

#### 4.2.4 Error Handling

- **404**: Returned for unknown API routes or when an annotation/note ID is not found
- **500**: Returned for internal errors (e.g. JSON parse failure on request body)
- Error response shape: `{ "error": "message" }`
- Non-API requests (URLs not starting with `/__inline-review/api`) are passed through to the next middleware via `next()`


## 5. Client Architecture

### 5.1 Bootstrap Sequence

The client entry point runs on every page during dev. The bootstrap sequence is:

1. **Idempotency check**: If `window.__astro_inline_review_init` is truthy, exit immediately
2. Set `window.__astro_inline_review_init = true`
3. **Create Shadow DOM host**: `createHost()` returns the shadow root
4. **Create panel**: `createPanel(shadowRoot, callbacks)` — the slide-in sidebar
5. **Create FAB**: `createFab(shadowRoot, onToggle)` — the floating action button
6. **Create annotator**: `createAnnotator({ shadowRoot, badge })` — selection detection, popup, highlights
7. **Register shortcuts**: `registerShortcuts(handlers)` — keyboard shortcuts
8. **Restore highlights**: `annotator.restoreHighlights()` — restore persisted highlights for the current page
9. **Listen for page transitions**: `document.addEventListener('astro:page-load', ...)` — re-restore highlights on SPA navigation

The bootstrap runs when `DOMContentLoaded` fires, or immediately if the document is already loaded.

**Notes**:
- `restoreHighlights()` is async but called without `await` (fire-and-forget). The `init()` function is synchronous; highlights appear asynchronously after the API response arrives.
- The annotator also exposes a `destroy()` method that removes event listeners (`mouseup`, `scroll`). This is not called during normal operation — the annotator lives for the entire page lifecycle. The method exists for potential future use (e.g. hot-module replacement cleanup).

**Ordering dependency**: The panel MUST be created before the FAB because the `refreshBadge` closure (defined before both) references `fab.badge`. This works because the closure captures the variable by reference, not by value, and `refreshBadge` is never invoked during construction — it only executes when the user opens the panel, by which time the FAB exists.

### 5.2 Idempotency

The integration guards against creating duplicate hosts:

- The `window.__astro_inline_review_init` flag prevents the entire bootstrap from running twice
- `createHost()` checks for an existing `#astro-inline-review-host` element and returns its shadow root if found
- The `astro:page-load` event handler calls `restoreHighlights()` (which clears and re-applies highlights) rather than re-running the full bootstrap

### 5.3 Shadow DOM Host

- **Element**: `<div id="astro-inline-review-host">`
- **Shadow root**: Open mode (inspectable in DevTools)
- **Style isolation**: `:host { all: initial; }` resets all inherited styles
- **Appended to**: `document.body`
- All UI components (FAB, panel, popup, toast) live inside the shadow root
- Highlights (`<mark>` elements) live in the **light DOM** because they must wrap existing text nodes

### 5.4 Client-Side Caching

**localStorage key**: `astro-inline-review`

**Purpose**:
- Fast reads when the API is available (avoids network round-trip for cached data)
- Fallback when the API is unreachable (shouldn't happen in normal dev, but provides resilience)

**Behaviour**:
- The cache is written after every successful API response
- `readCache()` returns the full `ReviewStore` or `null` if missing/corrupt
- `writeCache()` silently ignores errors (e.g. quota exceeded)
- The cache is **not** the source of truth — the JSON file on disk is

**Cache contents**: When the client fetches with a page filter (e.g. `GET /annotations?page=/`), the cached store contains page-filtered annotations but **unfiltered** page notes. The panel's "This Page" tab applies an additional client-side filter on `pageNotes` by `window.location.pathname`.

### 5.5 API Client

The client communicates with the server via fetch requests to `/__inline-review/api/*`. All requests except `GET /export` set `Content-Type: application/json` via a shared `request()` helper. The `GET /export` call uses a direct `fetch()` since the response is `text/markdown`, not JSON. Error responses throw exceptions with the error message from the server.

**Endpoints used by the client**:
- `GET /annotations` (with optional `?page=` filter) — primary store fetch
- `POST /annotations` — create annotation
- `PATCH /annotations/:id` — update annotation
- `DELETE /annotations/:id` — delete annotation
- `POST /page-notes` — create page note
- `PATCH /page-notes/:id` — update page note
- `DELETE /page-notes/:id` — delete page note
- `GET /export` — Markdown export

**Endpoints NOT used by the client**: `GET /page-notes` (page notes are included in the `GET /annotations` response).


### 5.6 Inter-Component Communication

The panel, annotator, FAB, and shortcuts modules are separate concerns that communicate via callbacks and shared references on the shadow root.

#### 5.6.1 Callback Injection

Components accept callback interfaces during construction:

| Component | Callback | Provider | Purpose |
|-----------|----------|----------|---------|
| Panel | `onAnnotationClick(id)` | Client bootstrap | Scroll to highlight and pulse |
| Panel | `onRefreshBadge()` | Client bootstrap | Update FAB badge count |
| FAB | `onToggle()` | Client bootstrap | Toggle panel open/closed |
| Shortcuts | `togglePanel()` | Client bootstrap | Toggle panel |
| Shortcuts | `closeActive()` | Client bootstrap | Dismiss popup or close panel |
| Shortcuts | `exportToClipboard()` | Client bootstrap | Export and show toast |
| Shortcuts | `addPageNote()` | Client bootstrap | Open panel and show add-note form |

#### 5.6.2 Shadow Root Bridge

Two functions are stashed as untyped properties on the `ShadowRoot` object to enable cross-module communication without circular imports:

| Property | Set by | Used by | Purpose |
|----------|--------|---------|---------|
| `__refreshPanel()` | Panel (`createPanel`) | Panel note CRUD, Clear All | Re-render panel content and update tab counts |
| `__scrollToAnnotation(id)` | Annotator (`createAnnotator`) | Panel annotation click | Scroll to highlight and pulse |

These are cast via `(shadowRoot as any)` — there is no TypeScript interface for them. This is a known architectural shortcut. A future improvement could introduce a typed event bus or mediator pattern.

#### 5.6.3 Dependency Graph

```
Client Bootstrap (index.ts)
  ├── creates ShadowRoot
  ├── creates Panel (receives onAnnotationClick, onRefreshBadge)
  ├── creates FAB (receives onToggle → togglePanel)
  ├── creates Annotator (receives shadowRoot, badge)
  └── registers Shortcuts (receives togglePanel, closeActive, export, addPageNote)

Panel operations → call onRefreshBadge → update FAB badge
Panel annotation click → call onAnnotationClick → scrollToAnnotation (via shadowRoot bridge)
Panel note CRUD → call __refreshPanel (via shadowRoot bridge)
Annotator save/delete → call refreshCacheAndBadge → update FAB badge
Shortcuts → call togglePanel/closeActive/export/addPageNote → affect Panel/Popup
```


## 6. UI Components

### 6.1 Floating Action Button (FAB)

**Position**: Fixed, bottom-right corner (24px from each edge)

**Appearance**:
- 48px circle
- Background: `#D97706` (amber/orange), hover: `#B45309`
- Icon: Pencil SVG (closed state) / Plus SVG rotated 45deg (open state, looks like X)
- Box shadow for elevation
- `z-index: 10000`

**Badge**:
- Red circle (`#EF4444`) positioned top-right of the FAB
- Shows the count of **text annotations only** (not page notes) for the **current page only**
- Hidden when count is 0 (via `display: none`)
- Font: 11px bold white

**Behaviour**:
- Click toggles the review panel open/closed
- Icon swaps between pencil and close (X) based on panel state
- The `data-air-el="fab"` attribute is the stable automation contract
- The `data-air-state` attribute reflects `"open"` or `"closed"`

**State Synchronisation**:

The FAB maintains its own `isOpen` boolean independently from the panel's CSS class state (`air-panel--open`). When the panel is closed by means other than a FAB click (e.g. Escape key, keyboard shortcut), the FAB's internal state, icon, and `data-air-state` attribute are NOT updated. This causes the FAB to show the X icon (open) when the panel is actually closed.

**Impact**: Clicking the FAB after an Escape-close will toggle the FAB to "closed" state but actually re-open the panel — a one-step desync that self-corrects after one extra click.

**Recommended fix**: The FAB should observe the panel state, or the `closePanel()` / `closeActive()` function should update the FAB. Alternatively, refactor the FAB to derive its state from the panel's `data-air-state` attribute rather than maintaining its own boolean.

**Accessibility**:
- `aria-label="Toggle inline review panel"`
- `title="Inline Review"`

### 6.2 Review Panel

**Position**: Fixed, right side, full viewport height

**Dimensions**:
- Width: 380px on desktop
- Width: 100% on viewports below 480px (responsive breakpoint)
- Height: 100vh

**Animation**:
- Slides in from the right via `transform: translateX(100%)` to `translateX(0)`
- Transition: `0.3s cubic-bezier(0.4, 0, 0.2, 1)`
- Uses `visibility: hidden` / `visibility: visible` alongside transform to prevent interaction with hidden panel

**Theme**: Dark neutral
- Background: `#1a1a1a`
- Text: `#e5e5e5`
- Borders: `#333`
- Accent: `#D97706` (orange)
- `z-index: 10000`

**Structure**:
- **Header**: Title "Inline Review" + action buttons ("+ Note", "Clear All")
- **Tabs**: "This Page" / "All Pages" with active indicator
- **Content**: Scrollable area showing annotations and page notes

**Data attributes**:
- `data-air-el="panel"` on the container
- `data-air-state="open"` or `"closed"`
- `data-air-el="tab-this-page"` and `data-air-el="tab-all-pages"` on tab buttons
- `data-air-el="page-note-add"` on the add note button
- `data-air-el="clear-all"` on the clear all button
- `data-air-el="annotation-item"` on each annotation list item
- `data-air-el="page-note-item"` on each page note list item

#### 6.2.1 This Page Tab

Shows annotations and page notes for the **current page only** (`window.location.pathname`).

**Layout order**:
1. Page notes section (if any exist) with "Page Notes" header
2. Annotations section (if any exist) with "Annotations" header
3. Empty state message if neither exists

**Empty state**: "No annotations on this page yet. Select text to get started."

**Tab label**: Includes count in parentheses, e.g. "This Page (3)". The count includes both text annotations AND page notes for the current page. This differs from the FAB badge, which counts only text annotations.

#### 6.2.2 All Pages Tab

Shows all annotations and page notes **across all pages**, grouped by page URL.

**Grouping**: Each page URL gets a section header formatted as `URL — Page Title`.

**Layout order per group**:
1. Page notes for that URL
2. Annotations for that URL

**Empty state**: "No annotations across any pages."

**Tab label**: Includes total count, e.g. "All Pages (7)".

#### 6.2.3 Annotation Items

Each annotation item in the panel shows:
- **Selected text** in italic yellow (`#FCD34D`), truncated to 80 characters with ellipsis
- **Note** (if non-empty) in light grey
- Wrapped in quotes: `"selected text..."`

**Click behaviour**: Scrolls the page to the corresponding highlight and triggers a pulse animation. Uses `scrollIntoView({ behavior: 'smooth', block: 'center' })`.

#### 6.2.4 Page Note Items

Each page note item shows:
- Note text
- **Edit** button (inline)
- **Delete** button (inline, immediate — no confirmation)

Edit mode replaces the item content with a textarea form.

#### 6.2.5 Clear All

**Two-click confirmation flow**:
1. First click: Button text changes from "Clear All" to "Confirm Delete", `data-air-state` set to `"confirming"`
2. If no second click within 3 seconds: Auto-resets to "Clear All"
3. Second click within 3 seconds: Deletes **all** annotations and page notes (across all pages), refreshes panel and badge

**Implementation**: Clear All deletes each annotation and page note individually via separate `DELETE` requests. There is no bulk delete endpoint. For a store with N annotations and M page notes, this sends N+M sequential HTTP requests, each performing a full file read-modify-write cycle. After all deletions complete, the cache is cleared to an empty store and the badge is refreshed.

**Highlight cleanup**: Light DOM `<mark>` elements are not removed during the Clear All operation itself. They are removed on the next call to `restoreHighlights()` (which clears all existing marks before re-applying from the now-empty store). In practice, opening the panel triggers a badge refresh which calls `restoreHighlights()`, so marks are cleaned up shortly after Clear All completes.

### 6.3 Selection Popup

**Trigger**: Appears when the user selects text on the page (detected via `mouseup` event)

**Positioning algorithm**:
1. Calculate horizontal centre: `left = selection.left + (selection.width / 2) - (POPUP_WIDTH / 2)` where `POPUP_WIDTH = 300px`
2. Clamp horizontally: `left = max(8, min(left, viewportWidth - 300 - 8))`
3. Try above: `top = selection.top - 8`
4. If `top < 208` (not enough room above): switch to below: `top = selection.bottom + 8`
5. If placed above: apply `transform: translateY(-100%)` so the popup's bottom edge aligns with the selection's top edge
6. If placed below: no transform (popup's top edge aligns with the selection's bottom edge)

The 208px threshold is `8px margin + 200px` (approximate popup height including textarea and buttons).

- Width: 300px
- `z-index: 10001` (above panel)

**Create mode** (new annotation):
- Shows selected text preview (truncated to 100 characters with ellipsis, wrapped in quotes)
- Empty textarea with placeholder "Add a note (optional)..."
- Save and Cancel buttons
- Textarea auto-focused after render

**Edit mode** (clicking existing highlight):
- Shows selected text preview
- Textarea pre-filled with existing note
- Save, Cancel, and **Delete** buttons
- Delete button positioned left (separate from save/cancel via `margin-right: auto`)

**Dismissal**:
- Cancel button
- Page scroll (scroll event handler hides the popup)
- Escape key (when popup is visible)

**Data attributes**:
- `data-air-el="popup"` on container
- `data-air-state="visible"` or `"hidden"`
- `data-air-el="popup-textarea"` on the textarea
- `data-air-el="popup-save"`, `"popup-cancel"`, `"popup-delete"` on buttons

**Empty note handling**: Saving with an empty note is allowed — the annotation is created with an empty `note` field. This is distinct from page notes, where empty notes are discarded.

### 6.4 Toast Notifications

**Position**: Fixed, bottom-right, above the FAB (80px from bottom, 24px from right)

**Appearance**: Dark background, light text, 13px font, rounded corners, subtle shadow

**Behaviour**:
- Fades in with opacity + translateY transition
- Auto-dismisses after 2.5 seconds (default)
- Multiple calls reuse the same element and restart the timer
- `z-index: 10002` (above everything)
- `pointer-events: none` (non-interactive)

**Data attributes**: `data-air-el="toast"`


## 7. Annotation Workflow

### 7.1 Creating an Annotation

1. User selects text on the page
2. `mouseup` event fires on `document`
3. Annotator checks: is the selection non-empty, non-whitespace, and outside the Shadow DOM host?
4. If valid: clones the selection range, shows the popup near the selection
5. User optionally types a note, clicks Save
6. Client serialises the range (XPath + offsets + context)
7. `POST /annotations` sends the data to the server
8. Server generates ID and timestamps, persists to JSON file
9. Client applies highlight to the selected text
10. Client updates localStorage cache and badge count
11. Selection is cleared

### 7.2 Editing an Annotation

1. User clicks an existing `<mark>` highlight (the click detection checks only the direct `mouseup` target — if a child element like `<em>` inside a `<mark>` is clicked, the edit path is not triggered)
2. Annotator reads the `data-air-id` attribute to find the annotation
3. Fetches annotation data from cache (or API)
4. Shows edit popup with pre-filled note and Delete button
5. Save: `PATCH /annotations/:id` with new note text
6. Delete: `DELETE /annotations/:id`, removes highlight marks from DOM
7. Cache and badge updated

### 7.3 Selection Filtering

Selections are ignored (no popup shown) if ANY of:

1. The `mouseup` event target is a descendant of the host element (or the host itself)
2. The selection is collapsed (cursor click without drag)
3. The selected text, after trimming, is empty (whitespace-only)
4. The range's `commonAncestorContainer` is a descendant of the host element OR a descendant of the shadow root

Note: `Element.contains()` does not pierce shadow boundaries, so both checks are needed. The shadow root check handles the edge case where `commonAncestorContainer` is inside the shadow DOM (e.g. via programmatic selection).

### 7.4 Scroll Dismissal

When the page scrolls while the popup is visible, the popup is hidden and the current range is discarded. This prevents the popup from floating away from its associated text.


## 8. Highlight System

### 8.1 Highlight Elements

Highlights are `<mark>` elements injected into the **light DOM** (the page's own DOM, not the shadow DOM). This is necessary because they must wrap existing text nodes.

**Attributes**:
- `data-air-id="<annotation-id>"` — links the mark to its annotation
- `style="background-color: rgba(217,119,6,0.3); border-radius: 2px; cursor: pointer;"`

**Single-node selections**: Use `Range.surroundContents()` for simplicity.

**Cross-element selections**: The selection is split into multiple `<mark>` elements, one per text node segment. All marks share the same `data-air-id`. Text nodes are split at the selection boundaries to isolate the highlighted portion.

### 8.2 Highlight Removal

When an annotation is deleted:

1. All `<mark>` elements with the matching `data-air-id` are found
2. Each mark's children are moved out of the mark (re-parented to the mark's parent)
3. The mark element is removed
4. `parent.normalize()` merges adjacent text nodes to restore the original DOM structure

### 8.3 Highlight Pulse Animation

When scrolling to an annotation from the panel, the highlight "pulses":

1. Set `data-air-pulse` attribute on the mark(s) (test hook — see Section 14.3)
2. Set `transition: background-color 0.3s ease` on the mark(s)
3. Change background to `rgba(217,119,6,0.6)` (brighter)
4. After 600ms: revert to `rgba(217,119,6,0.3)` (normal)
5. After 900ms: remove the transition property and `data-air-pulse` attribute

**Testability**: The `data-air-pulse` attribute provides a stable, timing-independent test hook. Tests should check for the presence of this attribute rather than inspecting inline style values, which are transient.

### 8.4 Three-Tier Highlight Restoration

When the page loads (or on SPA navigation), highlights are restored from persisted annotations:

**Tier 1 — XPath + Offset** (primary):
- Resolve the start and end XPaths to DOM nodes
- Create a Range with the stored offsets
- Verify the range's text content matches `selectedText`
- If all checks pass: apply highlight

**Tier 2 — Context Matching** (fallback):
- Walk all text nodes in `document.body` to build a full-text index
- Find all occurrences of `selectedText` in the concatenated text
- Score each match by how well `contextBefore` and `contextAfter` align (see Section 15.3 for the full scoring algorithm)
- Use the best-scoring match to create a Range
- Apply highlight

**Tier 3 — Orphaned** (last resort):
- The annotation exists in the store but cannot be located in the DOM
- It is **visible in the review panel** (listed as an annotation item)
- No highlight is applied on the page
- The panel should indicate orphaned status (style exists: `.air-annotation-item__orphan` class in red)

### 8.5 Layout Preservation

Highlights must not break the page layout:
- No extra whitespace introduced
- No block-level changes
- `<mark>` is an inline element
- Cross-element marks properly split text nodes without altering structure

### 8.6 Restoration on Navigation

- On initial page load: `restoreHighlights()` is called during bootstrap
- On `astro:page-load` event (Astro SPA/view transitions): `restoreHighlights()` is called again
- Before restoring, all existing marks with `data-air-id` are removed to prevent duplicates


## 9. Markdown Export

### 9.1 Export Format

Both the server (`GET /export`) and client generate identical Markdown:

```markdown
# Inline Review — Copy Annotations
Exported: YYYY-MM-DD HH:MM

---

## /page-url — Page Title

### Page Notes
- First page note
- Second page note

### Text Annotations
1. **"selected text here"**
   > User's note about this text

2. **"another selection"**
   > Another note

---

## /other-page — Other Title

### Text Annotations
1. **"text on other page"**
```

### 9.2 Format Rules

- **Heading**: Always `# Inline Review — Copy Annotations`
- **Export date**: ISO-like format `YYYY-MM-DD HH:MM` (no seconds, UTC timezone — no timezone suffix displayed). Both the server and client export use `new Date().toISOString()` which always produces UTC.
- **Page groups**: Separated by `---` horizontal rules
- **Page heading**: `## /url — Title` (title omitted if empty)
- **Page notes**: Bullet list under `### Page Notes`
- **Annotations**: Numbered list under `### Text Annotations`
- **Selected text**: Bold with quotes: `**"text"**`
- **Notes**: Blockquote: `   > note text` (indented 3 spaces)
- **Empty notes**: No blockquote line rendered
- **Empty store**: Shows "No annotations or notes yet." instead of page groups
- All pages are included in the export, not just the current page

### 9.3 Clipboard Export

The client-side export:

1. Fetches the full (unfiltered) store from the server via `GET /annotations` (no `?page=` filter). The client-side cache is not used for export because it only contains the current page's annotations.
2. Attempts `navigator.clipboard.writeText()` (modern Clipboard API)
3. Falls back to `textarea.select()` + `document.execCommand('copy')` for older browsers
4. Shows a toast notification: "Copied to clipboard!" on success, "Export failed — try again" on failure


## 10. Keyboard Shortcuts

### 10.1 Shortcut Map

| Shortcut | Action | Notes |
|----------|--------|-------|
| `Cmd/Ctrl + Shift + .` | Toggle panel open/closed | Also handles `>` (Shift+. on some layouts) |
| `Escape` | Close active UI | Popup takes precedence over panel |
| `Cmd/Ctrl + Shift + E` | Export to clipboard | |
| `Cmd/Ctrl + Shift + N` | Add page note | Opens panel if closed, displays add-note form |

### 10.2 Event Handling

- All shortcuts are registered via a single `keydown` event listener on `document`
- **Escape** uses the **capture phase** (`addEventListener(..., true)`) so it fires before the site's own handlers
- All other shortcuts use the capture phase as well (single listener)
- `e.preventDefault()` is called for modifier shortcuts to prevent browser defaults

### 10.3 Input Suppression

- When focus is in an `<input>`, `<textarea>`, or `contentEditable` element, **all shortcuts except Escape are suppressed**
- Escape always fires regardless of focus state (for dismissing popups/panels)
- This applies to both the site's own inputs and the integration's own textareas (e.g. popup textarea, page note textarea)

### 10.4 Escape Precedence

When Escape is pressed, `closeActive()` is called. The handler checks state in priority order:

1. If the popup is visible: dismiss the popup. The event SHOULD be stopped from propagating to site handlers.
2. If the panel is open (and popup is not visible): close the panel. The event SHOULD be stopped from propagating.
3. If neither is open: the event MUST propagate normally to site handlers.

**Known Technical Debt**: The current implementation achieves correct user-visible behaviour for case 3 (Escape propagates when nothing is handled) by never calling `stopPropagation()` at all. This means the event also propagates to site handlers in cases 1 and 2, which is technically incorrect but has no user-visible impact since the popup/panel dismissal happens first. A future improvement would be to return a boolean from `closeActive()` indicating whether it consumed the event, and call `e.stopPropagation()` only when true.


## 11. Page Notes

### 11.1 Overview

Page notes are free-text notes associated with a page URL (not with a specific text selection). They appear in the review panel's "This Page" tab above annotations.

### 11.2 CRUD Operations

- **Create**: Click "+ Note" button in panel header, or use `Cmd/Ctrl+Shift+N` shortcut. Opens a textarea form at the top of the content area. Save sends `POST /page-notes`. The "+ Note" button acts as a toggle: if the add-note form is already visible, clicking "+ Note" again dismisses it without creating a note.
- **Edit**: Click "Edit" button on a page note item. Replaces the item with an inline textarea form. Save sends `PATCH /page-notes/:id`.
- **Delete**: Click "Delete" button on a page note item. Immediately sends `DELETE /page-notes/:id` (no confirmation required, unlike Clear All).
- **Empty notes**: If the user tries to save an empty/whitespace-only note, the form is dismissed without creating a note.

### 11.3 Scoping

Page notes are scoped by `pageUrl`:
- The "This Page" tab only shows notes for the current `window.location.pathname`
- The "All Pages" tab shows notes grouped by page URL
- Notes created on page A do not appear when viewing page B's "This Page" tab

### 11.4 Persistence

Page notes are persisted to the same `inline-review.json` file as annotations, in the `pageNotes` array. They survive page reloads and dev server restarts.


## 12. Multi-Page Behaviour

### 12.1 URL Scoping

Annotations and page notes are associated with `window.location.pathname` at creation time:
- Highlights are only applied for annotations matching the current page URL
- The FAB badge shows the count for the **current page only**
- The "This Page" panel tab filters by current URL

### 12.2 Navigation

When navigating between pages:
- The badge count updates to reflect the new page's annotation count
- Highlights for the previous page are removed (either by page navigation or explicit cleanup)
- Highlights for the new page are restored via `restoreHighlights()`
- The panel's "This Page" tab re-renders with the new page's data

### 12.3 Astro View Transitions

The integration supports Astro's view transitions (SPA-style navigation):
- Listens for `astro:page-load` events to re-restore highlights after soft navigation
- The Shadow DOM host persists across transitions (idempotency guard)
- Annotations created before a view transition survive the navigation

### 12.4 All Pages View

The "All Pages" tab and the export endpoint both aggregate data across all pages, grouped by URL. This provides a complete overview of all annotations regardless of which page the user is currently viewing.


## 13. Production Safety

### 13.1 Requirements

When the site is built with `astro build`:

1. **No scripts**: The integration's client script must not appear in any HTML file
2. **No host element**: No `<div id="astro-inline-review-host">` in the rendered HTML
3. **No API references**: No references to `__inline-review` in any JavaScript bundle
4. **No JSON file references**: No references to `inline-review.json` in built output

### 13.2 Implementation

This is achieved by the integration hook returning immediately when `command !== 'dev'`. Since `injectScript` and `updateConfig` are never called during build, no traces of the integration exist in the production output.


## 14. Automation Contract (data-air-* Attributes)

The integration exposes stable `data-air-el` and `data-air-state` attributes for automated testing. These attributes form a **stable contract** that tests can rely on, decoupled from CSS class names which may change. Internal CSS class names referenced elsewhere in this spec (e.g. `air-panel--open`, `air-popup--visible`, `air-fab--open`) are **not** part of the automation contract and are documented for implementer context only.

### 14.1 Element Identification (data-air-el)

| Value | Element | Location | Lifecycle |
|-------|---------|----------|-----------|
| `fab` | FAB button | Shadow DOM | Always present after bootstrap |
| `badge` | FAB badge | Shadow DOM | Always present (child of FAB) |
| `panel` | Review panel container | Shadow DOM | Always present (may be hidden) |
| `popup` | Annotation popup | Shadow DOM | Always present (starts hidden, `display: none`) |
| `popup-textarea` | Popup note textarea | Shadow DOM | Always present (child of popup) |
| `popup-save` | Popup save button | Shadow DOM | Rebuilt each time popup is shown |
| `popup-cancel` | Popup cancel button | Shadow DOM | Rebuilt each time popup is shown |
| `popup-delete` | Popup delete button (edit mode only) | Shadow DOM | Only present in edit mode |
| `tab-this-page` | "This Page" tab | Shadow DOM | Always present (child of panel) |
| `tab-all-pages` | "All Pages" tab | Shadow DOM | Always present (child of panel) |
| `annotation-item` | Annotation list item in panel | Shadow DOM | Present when panel is open and annotations exist |
| `page-note-item` | Page note list item in panel | Shadow DOM | Present when panel is open and page notes exist |
| `page-note-add` | "Add Note" button in panel header | Shadow DOM | Always present (child of panel header) |
| `page-note-textarea` | Page note textarea (add/edit form) | Shadow DOM | Present when add/edit note form is open |
| `page-note-edit` | Page note edit button | Shadow DOM | Present on each page note item when panel shows notes |
| `page-note-delete` | Page note delete button | Shadow DOM | Present on each page note item when panel shows notes |
| `page-note-cancel` | Page note form cancel button | Shadow DOM | Present when add/edit note form is open |
| `page-note-save` | Page note form save button | Shadow DOM | Present when add/edit note form is open |
| `clear-all` | "Clear All" button | Shadow DOM | Always present (child of panel header) |
| `toast` | Toast notification | Shadow DOM | Created on first toast, then reused |

### 14.2 State Tracking (data-air-state)

| Element | Possible Values | Meaning |
|---------|----------------|---------|
| FAB | `open`, `closed` | Panel is open or closed |
| Panel | `open`, `closed` | Panel visibility state |
| Popup | `visible`, `hidden` | Popup visibility state |
| Clear All button | `confirming` (or absent) | Waiting for second click |

### 14.3 Light DOM Attributes

| Attribute | Element | Location | Notes |
|-----------|---------|----------|-------|
| `data-air-id` | `<mark>` highlight elements | Light DOM | Links mark to annotation ID |
| `data-air-pulse` | `<mark>` highlight elements | Light DOM | Present during pulse animation (transient, ~900ms). Provides a stable, timing-independent test hook for verifying pulse behaviour. |


## 15. XPath Serialisation

### 15.1 Format

- **Elements**: `/html[1]/body[1]/div[1]/p[2]` — tag names in lowercase, 1-indexed among same-tag siblings
- **Text nodes**: `/html[1]/body[1]/p[1]/text()[1]` — `text()` pseudo-selector, 1-indexed among sibling text nodes
- Positions count only siblings of the same type (same tag for elements, text nodes for text nodes)

### 15.2 Resolution

XPaths are resolved using `document.evaluate()` with `FIRST_ORDERED_NODE_TYPE`. Returns `null` on any error (malformed XPath, missing node).

### 15.3 Context Matching

The context matching algorithm:
1. Walks all text nodes in `document.body` using `TreeWalker`
2. Concatenates all text content into a single string with node boundary tracking
3. Finds all occurrences of `selectedText` in the concatenated text
4. Scores each match candidate by context similarity:
   - If the text immediately preceding the match **ends with** the full `contextBefore` string: +`contextBefore.length` points
   - Else if the text preceding the match **contains** the last 10 characters of `contextBefore` **anywhere**: +5 points
   - If the text immediately following the match **starts with** the full `contextAfter` string: +`contextAfter.length` points
   - Else if the text following the match **contains** the first 10 characters of `contextAfter` **anywhere**: +5 points
5. The candidate with the highest score is selected. On tie, the first occurrence wins.
6. Returns the best-scoring match as a Range

**Context length**: Exactly 30 characters are stored (or fewer if insufficient text exists before/after the selection boundary). The `CONTEXT_LENGTH` constant is defined as `30`.

**Context extraction limitation**: `contextBefore` is extracted solely from the text node containing the start of the selection (`range.startContainer`). It does not walk backwards across preceding DOM nodes. Similarly, `contextAfter` is extracted solely from the text node containing the end of the selection. This means if the selection starts at offset 0 in a text node, `contextBefore` will be an empty string even if preceding elements contain text. When both context strings are empty, all candidates score 0 and the first occurrence is selected.


## 16. Error Handling

### 16.1 Strategy

| Scenario | Behaviour |
|----------|-----------|
| API unreachable | Console error, fall back to localStorage cache |
| JSON file missing | Return empty store |
| JSON file corrupted | Return empty store (silent recovery) |
| JSON schema invalid | Return empty store (silent recovery) |
| XPath resolution fails | Return null, try context matching |
| Context matching fails | Annotation becomes orphaned |
| localStorage full | Silently ignore write error |
| Concurrent file writes | Queued via promise chain |
| Highlight application fails | Console error logged, continue with other annotations |
| Clipboard API unavailable | Fall back to execCommand, return false on total failure |

### 16.2 Console Logging

Errors are logged with the prefix `[astro-inline-review]` for easy filtering. No errors should appear during normal operation — the integration should not pollute the console.


## 17. Style Reference

### 17.1 Colour Palette

| Token | Value | Usage |
|-------|-------|-------|
| FAB background | `#D97706` | FAB button, active tab, accent colour |
| FAB hover | `#B45309` | FAB hover state |
| Badge background | `#EF4444` | Badge red circle |
| Panel background | `#1a1a1a` | Panel, popup, toast backgrounds |
| Panel text | `#e5e5e5` | Primary text colour |
| Panel border | `#333` | Borders and separators |
| Button background | `#2a2a2a` | Panel action buttons |
| Selected text | `#FCD34D` | Annotation text preview in panel/popup |
| Highlight background | `rgba(217,119,6,0.3)` | Mark background (30% opacity) |
| Highlight pulse | `rgba(217,119,6,0.6)` | Mark pulse animation (60% opacity) |
| Danger text | `#fca5a5` | Delete buttons, danger actions |
| Danger background | `#7f1d1d` | Delete button background |
| Orphan warning | `#F87171` | Orphaned annotation indicator |

### 17.2 Z-Index Stack

| Layer | Z-Index | Element |
|-------|---------|---------|
| FAB | 10000 | `.air-fab` |
| Panel | 10000 | `.air-panel` |
| Popup | 10001 | `.air-popup` |
| Toast | 10002 | `.air-toast` |

The integration uses `z-index: 10000+` to position above typical site z-indexes (which conventionally stay below 9999).

### 17.3 Typography

- Font family: System stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`)
- Base size: 14px
- Line height: 1.5


## 18. Accessibility

The integration provides minimal accessibility support appropriate for a dev-only tool:

- **FAB**: `aria-label="Toggle inline review panel"` and `title="Inline Review"`
- **Popup textarea**: Auto-focused on open via `requestAnimationFrame(() => textarea.focus())`
- **Page note textarea**: Auto-focused when add/edit form opens

The following accessibility features are explicitly **out of scope** for this dev tool:
- ARIA roles on the panel (e.g. `role="complementary"`)
- Focus trapping within the panel or popup
- Keyboard navigation between annotation items in the panel
- Screen reader announcements for state changes
- High contrast mode support

These may be added in future if the tool gains broader adoption.


---


## Appendix A: Acceptance Test Coverage Gaps (for test authors, not implementers)

The following areas are specified above but have **incomplete or missing coverage** in the acceptance test suite (110 scenarios across 12 spec files):

### A.1 Gaps in Existing Tests

1. **Orphaned annotations in panel** (Tier 3 restoration):
   No test verifies that when a highlight cannot be restored (DOM changed since annotation was created), the annotation still appears in the panel with an orphaned warning. The `.air-annotation-item__orphan` CSS class exists but is untested.

2. **Context matching fallback** (Tier 2 restoration):
   No acceptance test verifies that when XPath restoration fails but context matching succeeds, the highlight is still restored. All persistence tests rely on the DOM being unchanged between save and reload.

3. **Page note edit flow**:
   The acceptance test `07-page-notes.spec.ts` tests the edit happy path (click Edit, modify text, click Save, verify updated text persists). It does not test cancelling an edit or editing to empty text.

4. **Toast notification content**:
   The export test (`09-export.spec.ts`) checks that a toast is visible after export, but doesn't verify the exact toast message ("Copied to clipboard!" vs "Export failed"). The `expectToastVisible` helper accepts optional text but most tests don't use it.

5. **Panel tab counts**:
   The test for "annotation count appears in tab label" (`06-panel.spec.ts`) only checks that the tab contains "2". It doesn't verify the count includes page notes (the implementation counts both annotations and page notes). There is no test for the All Pages tab count.

6. **Clear All confirmation auto-reset**:
   The Clear All test verifies the confirmation step appears, but doesn't test that the confirmation auto-resets after 3 seconds if the user doesn't click again.

7. **Popup positioning**:
   The selection test checks that the popup is "positioned near the selection" but uses a broad check (popup y-coordinate within 200px of selection). There's no test for the specific above/below fallback logic or horizontal clamping to viewport edges.

8. **Highlight removal normalises text nodes**:
   The highlight test `04-highlights.spec.ts` tests deletion but doesn't explicitly verify that `parent.normalize()` was called and adjacent text nodes were merged. This is important for subsequent selections to work correctly.

### A.2 Missing Test Scenarios

1. **Clipboard API fallback**: No test for the `execCommand('copy')` fallback path when `navigator.clipboard` is unavailable.

2. **Concurrent API requests**: No acceptance test for rapid concurrent operations (e.g. creating and deleting simultaneously). The edge case test covers rapid creation but not mixed operations.

3. **External JSON file editing**: No test verifies that externally editing `inline-review.json` (e.g. in a text editor) and reloading the page picks up the changes. This is guaranteed by the storage design (always reads from disk) but untested.

4. **Storage file permissions**: No test for when the JSON file exists but is not writable (permission error).

5. **API error responses**: No acceptance test verifies client behaviour when the API returns 500 or other error status codes.

6. **Multiple browser tabs**: No test for the scenario where the same dev site is open in multiple tabs and annotations are created in both. The JSON file serialisation queue prevents corruption on the server side, but the client-side caches may become stale.

7. **Annotation on text within inline elements**: No explicit test for selecting text that spans across `<strong>`, `<em>`, `<a>`, or other inline elements within the same paragraph (distinct from the cross-element test which spans block elements).

8. **Very large store performance**: No test for performance with hundreds of annotations. The storage design reads/writes the entire file on each operation.

9. **Page note form cancel**: No test verifies that cancelling the add-note or edit-note form discards changes and doesn't create/update a note.

10. **Panel scroll position**: No test verifies that the panel's scroll position is preserved when switching between tabs, or that long lists of annotations are scrollable.

11. **Dev Toolbar companion**: The plan includes an Astro Dev Toolbar companion app (Session A5), but no tests exist for this yet as it hasn't been implemented.


## Appendix B: Action-Response Quick Reference

| User Action | System Response | Key Sections |
|-------------|----------------|--------------|
| Select text on page | Popup appears near selection | 7.1, 6.3 |
| Click Save in popup | Annotation created, highlight applied, badge updated | 7.1, 8.1, 6.1 |
| Click Cancel in popup | Popup dismissed, selection cleared | 6.3 |
| Click existing highlight | Edit popup appears with pre-filled note | 7.2, 6.3 |
| Click Delete in edit popup | Annotation deleted, highlight removed | 7.2, 8.2 |
| Click FAB | Panel toggles open/closed | 6.1, 6.2 |
| Click annotation in panel | Page scrolls to highlight, highlight pulses | 6.2.3, 8.3 |
| Click "+ Note" in panel | Add-note form appears/toggles | 11.2 |
| Click "Clear All" in panel | Confirmation step, then deletes all | 6.2.5 |
| Press Escape | Dismiss popup (priority) or close panel | 10.4 |
| Press Cmd/Ctrl+Shift+. | Toggle panel | 10.1 |
| Press Cmd/Ctrl+Shift+E | Export to clipboard, show toast | 10.1, 9.3 |
| Press Cmd/Ctrl+Shift+N | Open panel and add-note form | 10.1, 11.2 |
| Page reload | Highlights restored from server | 8.4, 8.6 |
| Navigate to different page | Badge updates, highlights re-applied | 12.2 |
| `astro build` | Zero traces in output | 13 |
