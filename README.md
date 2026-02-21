# astro-inline-review

A bridge between human reviewers and coding agents for [Astro](https://astro.build) sites.

Browse your rendered site, select text, attach notes, and export location-aware Markdown that a coding agent (Claude, Cursor, Copilot, etc.) can act on immediately — no hunting through source files to explain *where* the problem is.

<!-- TODO: Add screenshot/GIF here -->

## The Problem

Reviewing a live site and turning that into actionable code changes is tedious. You spot a typo, an awkward heading, a paragraph that needs rewriting — but translating "that bit on the homepage, third section down" into a precise instruction for a coding agent means switching context, finding the right file, identifying the right line, and describing what you saw.

## The Solution

**astro-inline-review** lets you stay in the browser. Select the text, write your note, move on. When you're done reviewing, export everything as structured Markdown. Each annotation carries the page URL and the exact selected text — giving your coding agent both the instruction and the location context it needs to make the change.

```markdown
## / — Home Page

### Text Annotations
1. **"We deliver enterprise-grade synergistic solutions"**
   > This is meaningless marketing speak. Rewrite to explain what we actually do.

2. **"Loren ipsum dolor"**
   > Typo — should be "Lorem"
```

Paste that into Claude, Cursor, or any agent and it knows exactly what to fix and where.

Ships **zero bytes** in production builds — all UI, storage, and API infrastructure exists only during `astro dev`.

## Features

- **Text annotations** — select any text on the page and attach a note
- **Page notes** — add free-text notes scoped to a page (not tied to a selection)
- **Location-aware export** — each annotation carries the page URL and selected text, so coding agents know exactly where to act
- **Persistent** — annotations survive page reloads, navigation, and dev server restarts
- **Multi-page** — annotations are scoped by URL but viewable across all pages
- **Shadow DOM isolation** — all UI is isolated from your site's styles
- **Keyboard shortcuts** — toggle panel, export, add notes without touching the mouse
- **Zero-config** — works with a single line in `astro.config.mjs`

## Install

```bash
npm install -D astro-inline-review
```

## Configuration

Add the integration to your Astro config:

```javascript
// astro.config.mjs
import { defineConfig } from 'astro/config';
import inlineReview from 'astro-inline-review';

export default defineConfig({
  integrations: [inlineReview()],
});
```

That's it. Run `astro dev` and you'll see an orange floating action button in the bottom-right corner.

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `storagePath` | `string` | `'inline-review.json'` in project root | Path to the JSON storage file |

## Workflow

1. Run `astro dev` and browse your site
2. **Select text** — a popup appears to add a note about what needs changing
3. **Add page notes** for broader feedback (via the panel or `Cmd/Ctrl+Shift+N`)
4. Review your annotations in the **slide-out panel** (click the FAB or `Cmd/Ctrl+Shift+.`)
5. **Export** all annotations as Markdown (`Cmd/Ctrl+Shift+E`)
6. **Paste the export** into your coding agent — it has everything it needs to act

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + Shift + .` | Toggle review panel |
| `Cmd/Ctrl + Shift + E` | Export to clipboard |
| `Cmd/Ctrl + Shift + N` | Add page note |
| `Escape` | Close active UI (popup or panel) |

Shortcuts are suppressed when focus is in an input, textarea, or contentEditable element (except Escape, which always fires).

## Export Format

The Markdown export groups annotations by page, giving coding agents the structure they need:

```markdown
# Inline Review — Copy Annotations
Exported: 2026-02-21 14:30

---

## / — Home Page

### Page Notes
- Consider restructuring the hero section — the CTA is below the fold

### Text Annotations
1. **"We've been building software since 2001"**
   > This is vague. Replace with specific achievements or a concrete claim.

2. **"Loren ipsum dolor"**
   > Placeholder text still in production copy — replace with real content

---

## /about — About

### Text Annotations
1. **"Our team of rockstar ninjas"**
   > Rewrite in a professional tone
```

## Storage

Annotations are persisted to `inline-review.json` in your project root (or the configured `storagePath`). This file is meant to be committed alongside your project for shared review, or added to `.gitignore` for personal use.

## How It Works

The integration registers a [Vite dev server middleware](https://vite.dev/guide/api-plugin.html#configureserver) that serves a REST API at `/__inline-review/api/*` and injects a client script on every page. The client uses Shadow DOM for UI isolation and stores annotations via the API to a local JSON file.

See [docs/spec/specification.md](docs/spec/specification.md) for the full component specification.

## Contributing

Contributions are welcome. Please open an issue first to discuss what you'd like to change.

The acceptance test suite lives in a separate repository: [astro-inline-review-tests](https://github.com/viv/astro-inline-review-tests).

## Alternatives

[astro-annotate](https://github.com/jan-nikolov/astro-annotate) is a similar Astro integration built independently around the same time. Both tools solve the same core problem — annotating a rendered Astro site and producing structured output for coding agents — but they take different approaches:

| | astro-inline-review | astro-annotate |
|---|---|---|
| **Selection model** | Text selection — highlight exact words or sentences | Element selection — annotate whole HTML elements |
| **Location tracking** | XPath ranges with surrounding context | CSS selectors (IDs, data-testid, tag+class) |
| **Export formats** | Markdown (clipboard) + JSON file | JSON file |
| **Status tracking** | No — annotations are transient review feedback | Yes — open/resolved status per annotation |
| **Device tagging** | No | Yes — desktop/mobile/tablet with viewport dimensions |
| **Deployment model** | Dev-only by design | Dev-only now, deployed mode planned (Cloudflare Pages) |

**Choose astro-inline-review** if you're doing copy review or content editing — you need to point at specific text ("this sentence is awkward") and the Markdown export is designed for pasting straight into a coding agent chat.

**Choose astro-annotate** if you're collecting UI/layout feedback from clients or stakeholders — element-level selection maps well to "make this section wider" or "change this button colour", and the status tracking helps manage a backlog of feedback.

## Licence

[MIT](LICENSE)
