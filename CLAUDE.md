# astro-inline-review

Dev-only Astro integration that provides a browser-based annotation overlay during `astro dev`. Reviewers annotate the site in-browser; annotations persist to a JSON file. Ships zero bytes in production.

## Architecture

- **Client**: Shadow DOM UI injected via `injectScript('page', ...)` — FAB, panel, popup, highlights
- **Server**: Vite dev middleware at `/__inline-review/api/*` — CRUD REST API
- **Storage**: Single JSON file (`inline-review.json`) in project root via `ReviewStorage` class
- **Types**: Canonical definitions in `src/shared/types.ts`, re-exported by `src/types.ts` and `src/client/types.ts`
- **Dismissal**: The panel includes per-annotation delete buttons (two-click confirmation: "Sure?" then delete) and orphan indicators for annotations whose target elements have changed (content modified or removed). The popup dismisses on scroll only after 50px threshold.

## Agent Integration — Reading Annotations

The annotation store is a single JSON file at the project root:

```
inline-review.json
```

This file is the source of truth. `ReviewStorage` reads from disk on every call (no in-memory cache), so external edits are picked up immediately.

### Schema

```json
{
  "version": 1,
  "annotations": [
    {
      "id": "string",
      "type": "text | element",
      "pageUrl": "/path",
      "pageTitle": "Page Title",
      "note": "reviewer's comment",
      "createdAt": "ISO 8601",
      "updatedAt": "ISO 8601",
      "resolvedAt": "ISO 8601 (optional)",
      "replies": [{ "message": "string", "createdAt": "ISO 8601" }],
      "selectedText": "quoted text (text annotations only)",
      "range": { "startXPath": "...", "startOffset": 0, "endXPath": "...", "endOffset": 0, "selectedText": "...", "contextBefore": "...", "contextAfter": "..." },
      "elementSelector": { "cssSelector": "...", "xpath": "...", "description": "...", "tagName": "...", "attributes": {}, "outerHtmlPreview": "..." }
    }
  ],
  "pageNotes": [
    {
      "id": "string",
      "pageUrl": "/path",
      "pageTitle": "Page Title",
      "note": "reviewer's comment",
      "createdAt": "ISO 8601",
      "updatedAt": "ISO 8601"
    }
  ]
}
```

### Reading annotations as an agent

To read review annotations, parse `inline-review.json` from the project root. Each annotation has:

- `pageUrl` — the route path (e.g., `/about`)
- `note` — the reviewer's comment describing what to change
- `type: "text"` — includes `selectedText` and `range` for locating the exact text
- `type: "element"` — includes `elementSelector` with `cssSelector`, `xpath`, and `outerHtmlPreview`
- `pageNotes` — general notes about a page, not tied to specific elements

### REST API (when dev server is running)

Base: `http://localhost:4321/__inline-review/api`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/annotations` | List all (optional `?page=/path` filter) |
| GET | `/annotations?page=/path` | Filter by page URL |
| POST | `/annotations` | Create annotation |
| PATCH | `/annotations/:id` | Update note only |
| DELETE | `/annotations/:id` | Delete annotation |
| GET | `/page-notes` | List all page notes |
| POST | `/page-notes` | Create page note |
| PATCH | `/page-notes/:id` | Update note only |
| DELETE | `/page-notes/:id` | Delete page note |
| GET | `/export` | Markdown export (text/markdown) |

## MCP Server — Structured Agent Access

The `.mcp.json` file at the project root enables auto-discovery for Claude Code and other MCP-compatible agents. The MCP server reads the same `inline-review.json` as the browser UI — no dev server required.

### Available Tools

| Tool | Description |
|------|-------------|
| `list_annotations` | List all annotations, optionally filtered by `pageUrl` |
| `list_page_notes` | List all page-level notes, optionally filtered by `pageUrl` |
| `get_annotation` | Get a single annotation by ID with full detail |
| `get_export` | Get a markdown export of all annotations and page notes |
| `resolve_annotation` | Mark an annotation as resolved (sets `resolvedAt` timestamp) |
| `add_agent_reply` | Add a reply to an annotation explaining what action was taken |

### Running manually

```sh
node ./dist/mcp/server.js --storage ./inline-review.json
```

The `--storage` flag is optional and defaults to `./inline-review.json` relative to the working directory.

## Development

- **Build**: `npm run build` (tsup — server ESM + client browser bundle)
- **Test**: `npm test` (vitest — client with happy-dom, server with node)
- **Watch**: `npm run dev` / `npm run test:watch`
- Runtime dependencies: `@modelcontextprotocol/sdk`, `zod` (for MCP server only); `astro ^5.0.0` peer dependency
- ESM-only package (`"type": "module"`)

## Key File Paths

- `src/shared/types.ts` — canonical type definitions
- `src/server/storage.ts` — `ReviewStorage` class (JSON file I/O)
- `src/server/middleware.ts` — REST API middleware + server-side export
- `src/client/export.ts` — client-side markdown export
- `src/index.ts` — Astro integration entry point
- `src/mcp/server.ts` — MCP server entry point (CLI argument parsing, tool registration)
- `src/mcp/types.ts` — shared MCP tool result types (ToolResult, ErrorResult)
- `src/mcp/tools/` — individual MCP tool handlers
- `.mcp.json` — MCP auto-discovery configuration
- `docs/spec/specification.md` — full component specification
