# MCP Tools Reference

Detailed reference for all tools provided by the astro-inline-review MCP server.

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
- `createdAt`, `updatedAt` — ISO 8601 timestamps
- `resolvedAt` — ISO 8601 timestamp if resolved, absent otherwise
- `replies` — array of `{ message, createdAt }` objects if any agent replies exist
- `selectedText` and `range` — (text annotations only) the highlighted text and its DOM location
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

Get a markdown export of all annotations and page notes, grouped by page URL.

**Parameters:** None.

**Returns:** A markdown-formatted string containing all annotations and page notes, grouped by page. Resolved annotations are marked with a checkmark. Agent replies are included inline.

This is the same format as the browser's clipboard export, making it useful for getting a complete overview of all review feedback in a human-readable format.

**Example:**

```
get_export({})
```

---

### resolve_annotation

Mark an annotation as resolved by setting a `resolvedAt` timestamp.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | `string` | Yes | The annotation ID to mark as resolved |

**Returns:** The updated annotation object with `resolvedAt` set.

**Errors:**

- `Annotation with ID "..." not found` — the ID doesn't match any annotation.

Calling this on an already-resolved annotation updates the `resolvedAt` timestamp.

**Example:**

```
resolve_annotation({ id: "abc123" })
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
| Annotation not found | ID doesn't exist in the store | `get_annotation`, `resolve_annotation`, `add_agent_reply` |
| Empty message | Reply message is blank | `add_agent_reply` |
| Storage file missing | `inline-review.json` doesn't exist yet | All tools (returns empty arrays) |

## Workflow examples

### Review and resolve all annotations

A typical agent workflow for processing all review feedback:

```
1. list_annotations({})                    → get all annotations
2. For each annotation:
   a. Read the note and selectedText
   b. Make the code change
   c. resolve_annotation({ id })           → mark as done
   d. add_agent_reply({ id, message })     → explain what changed
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
1. get_export({})                          → markdown overview of everything
2. Identify priority items
3. get_annotation({ id })                  → full detail on specific items
```
