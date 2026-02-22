---
generated_by: Claude Opus 4.6
generation_date: 2026-02-22
model_version: claude-opus-4-6
purpose: implementation_plan
status: deferred
human_reviewer: matthewvivian
implementation_tracking: not_started
superseded_by: docs/engineering-plans/2026-02-22-mcp-server.md
tags: [export, agent-integration, markdown, prompt-engineering, developer-experience]
---

# Agent-Prompt Export Format

> **Note:** This plan has been deferred. The MCP server implementation (`docs/engineering-plans/2026-02-22-mcp-server.md`) provides a more powerful agent integration path — agents can query annotations directly via structured tools rather than relying on pasted markdown exports. If a prompt-style export is still desired in future, it can be revisited as a lightweight addition on top of the MCP foundation.

## Problem

The current markdown export is human-readable but not optimised for pasting into a coding agent. A reviewer annotates a site, copies the export, and pastes it into Claude Code (or similar) — but the agent has no framing for what it's looking at or what it should do with the annotations. The reviewer has to manually write a preamble every time.

## Goal

Add a prompt-style preamble to the top of the exported markdown so it can be pasted directly into a coding agent session and be immediately actionable.

## Design

### Preamble section

The export should open with a short, direct prompt block that tells the agent what the document is and how to use it. Something like:

```markdown
# Review Annotations

You are receiving a set of review annotations from a human reviewer who has been
inspecting a running Astro site. Each annotation is attached to either a text
selection or a DOM element on a specific page.

Your task: address each annotation below. For text annotations, the reviewer has
highlighted specific text and left a note. For element annotations, the reviewer
has selected a specific DOM element (identified by CSS selector and XPath) and
left a note.

Work through the annotations in order. For each one, find the relevant source
code, understand the reviewer's feedback, and make the requested change.

---
```

### Key decisions

1. **Prompt goes first, metadata second** — The preamble is the very first thing in the file so a coding agent sees it immediately. Export timestamp and other metadata follow after the separator.

2. **Configurable prompt text** — The default prompt text should work well out of the box, but users should be able to customise it. Options:
   - A `promptPreamble` option on the integration config (string or function returning string)
   - A textarea in the panel UI where the reviewer can write/edit the prompt before exporting
   - Both: config provides a default, UI allows per-export override

3. **Include source file hints where possible** — If the Astro project structure is known, the export could include hints about which source files likely correspond to each page URL (e.g., `/about` → `src/pages/about.astro`). This significantly reduces the agent's search space.

4. **Structured output for agents** — Consider offering a second export format that's more structured (e.g., YAML front matter + markdown body, or a JSON export) for agents that can parse structured input better than free-form markdown.

## Implementation sessions

### Session 1: Default preamble in both export paths

- Add a default preamble string constant
- Prepend it to the server-side `generateExport()` in `middleware.ts`
- Prepend it to the client-side `generateExportMarkdown()` in `export.ts`
- Update export tests to verify preamble presence
- Keep existing export content unchanged (preamble is additive)

### Session 2: Configurable preamble via integration options

- Add `promptPreamble?: string` to the integration options type in `src/index.ts`
- Thread the option through to both server middleware and client injection
- Default to the built-in preamble when not provided
- Test with custom preamble text

### Session 3: UI-editable prompt (optional, may defer)

- Add a collapsible "Agent prompt" textarea to the panel UI
- Pre-populate with the configured default
- Use the edited text for the current export only
- Consider persisting custom prompts in the store

### Session 4: Source file path hints (optional, may defer)

- Map page URLs to likely source file paths using Astro route conventions
- Include file path hints in the export alongside page URLs
- This is best-effort — file paths are suggestions, not guarantees

## Open questions

- Should the preamble be included when copying individual annotations, or only on full export?
- Should there be a toggle in the UI to include/exclude the preamble (for when the reviewer just wants plain notes)?
- What's the right level of instruction in the default prompt — prescriptive ("fix each issue") vs descriptive ("here are the reviewer's observations")?
