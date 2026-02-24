# MCP Tools Reference

Detailed reference for all tools provided by the astro-inline-review MCP server. These tools are the primary way coding agents interact with review annotations.

## Tools

### list_annotations

List all review annotations, optionally filtered by page URL.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `pageUrl` | `string` | No | Filter by page URL path (e.g. `"/about"`) |

**Returns:** JSON array of annotation objects. Each annotation includes:

- `id` — unique identifier
- `type` — `"text"` or `"element"`
- `pageUrl` — the route path (e.g. `"/"`, `"/about"`)
- `pageTitle` — the page's `<title>`
- `note` — the reviewer's comment
- `status` — lifecycle state: `"open"`, `"addressed"`, or `"resolved"`
- `createdAt`, `updatedAt` — ISO 8601 timestamps
- `addressedAt` — ISO 8601 timestamp if addressed, absent otherwise
- `resolvedAt` — ISO 8601 timestamp if resolved, absent otherwise
- `replies` — array of `{ message, createdAt }` objects if any agent replies exist
- `selectedText` and `range` — (text annotations only) the highlighted text and its DOM location
- `replacedText` — (text annotations only) what text replaced the original, if the agent updated it
- `elementSelector` — (element annotations only) CSS selector, XPath, tag name, and HTML preview

**Example — list all:**

```
list_annotations({})
```

**Example — filter by page:**

```
list_annotations({ pageUrl: "/about" })
```

---

### list_page_notes

List all page-level notes. Page notes are general comments about a page, not tied to specific text or elements.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `pageUrl` | `string` | No | Filter by page URL path (e.g. `"/about"`) |

**Returns:** JSON array of page note objects, each with `id`, `pageUrl`, `pageTitle`, `note`, `createdAt`, and `updatedAt`.

**Example:**

```
list_page_notes({ pageUrl: "/" })
```

---

### get_annotation

Get a single annotation by ID with full detail.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | `string` | Yes | The annotation ID to retrieve |

**Returns:** A single annotation object with all fields.

**Errors:**

- `Annotation with ID "..." not found` — the ID doesn't match any annotation in the store.

**Example:**

```
get_annotation({ id: "abc123" })
```

---

### get_export

Get a Markdown export of all annotations and page notes, grouped by page URL.

**Parameters:** None.

**Returns:** A Markdown-formatted string containing all annotations and page notes, grouped by page. Addressed and resolved annotations are marked accordingly. Agent replies are included inline.

This produces the same format as the browser's clipboard export. Useful for getting a complete overview of all review feedback in a human-readable format, or for sharing feedback with agents that don't support MCP.

**Example:**

```
get_export({})
```

---

### resolve_annotation

Mark an annotation as addressed or resolved.

By default, this sets the annotation's status to `"addressed"` (agent has acted on it). The reviewer can later confirm the change and move it to `"resolved"` via the browser UI.

Pass `autoResolve: true` to skip the human review step and mark the annotation directly as `"resolved"`.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | `string` | Yes | The annotation ID to mark |
| `autoResolve` | `boolean` | No | If `true`, mark directly as resolved (skip human review). Default: `false` |

**Returns:** The updated annotation object with `addressedAt` (and `resolvedAt` if `autoResolve`) set.

**Errors:**

- `Annotation with ID "..." not found` — the ID doesn't match any annotation.

**Status lifecycle:**

```
open → addressed (agent acted) → resolved (reviewer confirmed)
```

- Default behaviour (`autoResolve: false`): sets status to `"addressed"` with an `addressedAt` timestamp
- With `autoResolve: true`: sets status to `"resolved"` with both `addressedAt` and `resolvedAt` timestamps

**Example — mark as addressed (default):**

```
resolve_annotation({ id: "abc123" })
```

**Example — mark as resolved (skip human review):**

```
resolve_annotation({ id: "abc123", autoResolve: true })
```

---

### add_agent_reply

Add a reply to an annotation explaining what action was taken. Appends to the annotation's `replies` array so reviewers can see agent responses alongside their original notes.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | `string` | Yes | The annotation ID to reply to |
| `message` | `string` | Yes | The reply message explaining what was done |

**Returns:** The updated annotation object with the new reply appended.

**Errors:**

- `Annotation with ID "..." not found` — the ID doesn't match any annotation.
- `Reply message must not be empty` — the message was empty or whitespace-only.

**Example:**

```
add_agent_reply({ id: "abc123", message: "Fixed the typo — changed 'Loren' to 'Lorem'" })
```

---

### update_annotation_target

Update what text replaced the original annotated text. Call this after making changes so the annotation can be re-located on the page. Only applicable to text annotations.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | `string` | Yes | The annotation ID to update |
| `replacedText` | `string` | Yes | The new text that replaced the original selected text |

**Returns:** The updated annotation object with `replacedText` set.

**Errors:**

- `Annotation with ID "..." not found` — the ID doesn't match any annotation.

**Example:**

```
update_annotation_target({ id: "abc123", replacedText: "Lorem ipsum dolor" })
```

This enables the browser UI to re-anchor highlights to the new text after the agent has made changes.

## Error handling

All tools return errors in the standard MCP error format:

```json
{
  "isError": true,
  "content": [{ "type": "text", "text": "Error description" }]
}
```

Common error scenarios:

| Error | Cause | Tools affected |
|-------|-------|----------------|
| Annotation not found | ID doesn't exist in the store | `get_annotation`, `resolve_annotation`, `add_agent_reply`, `update_annotation_target` |
| Empty message | Reply message is blank | `add_agent_reply` |
| Storage file missing | `inline-review.json` doesn't exist yet | All tools (returns empty arrays) |

## Workflow examples

### Review and resolve all annotations

A typical agent workflow for processing all review feedback:

```
1. list_annotations({})                              → get all annotations
2. For each annotation:
   a. Read the note and selectedText
   b. Make the code change
   c. update_annotation_target({ id, replacedText })  → record replacement text
   d. resolve_annotation({ id })                      → mark as addressed
   e. add_agent_reply({ id, message })                → explain what changed
```

### Process a single page

Focus on annotations for one page:

```
1. list_page_notes({ pageUrl: "/about" })  → check page-level feedback
2. list_annotations({ pageUrl: "/about" }) → get text/element annotations
3. Process each annotation and resolve
```

### Get a quick overview

Before diving into individual annotations, get the full picture:

```
1. get_export({})                          → Markdown overview of everything
2. Identify priority items
3. get_annotation({ id })                  → full detail on specific items
```
