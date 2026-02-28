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
- `status` — lifecycle state: `"open"`, `"in_progress"`, or `"addressed"`
- `createdAt`, `updatedAt` — ISO 8601 timestamps
- `addressedAt` — ISO 8601 timestamp if addressed, absent otherwise
- `inProgressAt` — ISO 8601 timestamp if in progress, absent otherwise
- `replies` — array of `{ message, createdAt, role }` objects if any replies exist
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

**Returns:** A Markdown-formatted string containing all annotations and page notes, grouped by page. Addressed annotations are marked with `🔧 [Addressed]`. In-progress annotations are marked with `⏳ [In Progress]`. Agent replies are included inline.

This produces the same format as the browser's clipboard export. Useful for getting a complete overview of all review feedback in a human-readable format, or for sharing feedback with agents that don't support MCP.

**Example:**

```
get_export({})
```

---

### address_annotation

Mark an annotation as addressed by the agent. Sets the annotation's status to `"addressed"` (agent has acted on it, awaiting human review). The reviewer can then Accept (delete) or Reopen (back to open with follow-up note) via the browser UI.

Optionally provide `replacedText` to record the new text that replaced the original — this enables the browser UI to re-locate the annotation after the text has changed.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | `string` | Yes | The annotation ID to mark as addressed |
| `replacedText` | `string` | No | The new text that replaced the original annotated text (text annotations only) |

**Returns:** The updated annotation object with `addressedAt` set.

**Errors:**

- `Annotation with ID "..." not found` — the ID doesn't match any annotation.
- `replacedText must not be empty` — provided but empty or whitespace-only.
- `not a text annotation` — `replacedText` used on an element annotation.

**Status lifecycle:**

```
open → in_progress → addressed → (Accept = delete | Reopen = back to open)
```

**Example — mark as addressed:**

```
address_annotation({ id: "abc123" })
```

**Example — mark as addressed with replacement text:**

```
address_annotation({ id: "abc123", replacedText: "corrected text here" })
```

---

### set_in_progress

Signal that the agent is about to start working on an annotation. Sets status to `"in_progress"` so the browser UI shows a working indicator instead of an orphan warning during code edits and hot-reloads. Call this before editing source code, then call `address_annotation` when done.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | `string` | Yes | The annotation ID to mark as in-progress |

**Returns:** The updated annotation object with `inProgressAt` set.

**Errors:**

- `Annotation with ID "..." not found` — the ID doesn't match any annotation.

**Example:**

```
set_in_progress({ id: "abc123" })
```

---

### add_agent_reply

Add a reply to an annotation explaining what action was taken. Appends to the annotation's `replies` array so reviewers can see agent responses alongside their original notes. The reply is added with `role: "agent"`.

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
| Annotation not found | ID doesn't exist in the store | `get_annotation`, `address_annotation`, `add_agent_reply`, `update_annotation_target`, `set_in_progress` |
| Empty message | Reply message is blank | `add_agent_reply` |
| Storage file missing | `inline-review.json` doesn't exist yet | All tools (returns empty arrays) |

## Workflow examples

### Address all annotations

A typical agent workflow for processing all review feedback:

```
1. list_annotations({})                              → get all annotations
2. For each annotation:
   a. set_in_progress({ id })                         → signal work starting
   b. Read the note and selectedText
   c. Make the code change
   d. update_annotation_target({ id, replacedText })  → record replacement text
   e. address_annotation({ id })                      → mark as addressed
   f. add_agent_reply({ id, message })                → explain what changed
```

### Process a single page

Focus on annotations for one page:

```
1. list_page_notes({ pageUrl: "/about" })  → check page-level feedback
2. list_annotations({ pageUrl: "/about" }) → get text/element annotations
3. Process each annotation and mark addressed
```

### Get a quick overview

Before diving into individual annotations, get the full picture:

```
1. get_export({})                          → Markdown overview of everything
2. Identify priority items
3. get_annotation({ id })                  → full detail on specific items
```
