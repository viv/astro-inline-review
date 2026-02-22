# MCP Setup Guide

Step-by-step guide to connecting a coding agent to your review annotations via the Model Context Protocol (MCP) server.

## Prerequisites

1. **Build the package** — the MCP server runs from the compiled output:

   ```bash
   npm run build
   ```

2. **Have annotations** — reviewers create annotations using the browser UI during `astro dev`. These are stored in `inline-review.json` at your project root.

The MCP server reads directly from this JSON file. The Astro dev server does **not** need to be running.

## Claude Code (automatic)

The `.mcp.json` file in the project root enables auto-discovery. When you open the project in Claude Code, it detects the MCP server configuration automatically:

```json
{
  "mcpServers": {
    "astro-inline-review": {
      "type": "stdio",
      "command": "node",
      "args": ["./dist/mcp/server.js", "--storage", "./inline-review.json"]
    }
  }
}
```

No manual configuration is needed — build the package and start Claude Code.

### What happens

1. Claude Code reads `.mcp.json` on startup
2. It spawns `node ./dist/mcp/server.js` as a child process using stdio transport
3. The MCP server reads `inline-review.json` from disk on every tool call
4. Claude Code gains access to six tools for listing, reading, resolving, and replying to annotations

## Other MCP clients (manual)

For agents that don't support `.mcp.json` auto-discovery, configure the stdio transport manually. The exact format varies by client, but the core configuration is:

- **Command**: `node`
- **Arguments**: `["./dist/mcp/server.js", "--storage", "./inline-review.json"]`
- **Transport**: stdio
- **Working directory**: your project root

Example configuration (JSON format used by many MCP clients):

```json
{
  "command": "node",
  "args": ["./dist/mcp/server.js", "--storage", "./inline-review.json"],
  "transport": "stdio"
}
```

The `--storage` flag is optional and defaults to `./inline-review.json` relative to the working directory.

### Custom storage path

If your annotations file is in a non-standard location:

```bash
node ./dist/mcp/server.js --storage ./reviews/sprint-42.json
```

Paths are resolved relative to the current working directory.

## Typical workflow

```
Reviewer (browser)          Coding agent (MCP)
────────────────────        ──────────────────
1. Browse site in astro dev
2. Select text, add notes
3. Export or hand off
                            4. list_annotations → see all feedback
                            5. Make code changes
                            6. resolve_annotation → mark done
                            7. add_agent_reply → explain what changed
8. See resolved status and
   agent replies in browser UI
```

1. **Reviewer annotates** — using the browser overlay during `astro dev`, the reviewer selects text and adds notes describing what needs to change.

2. **Agent reads annotations** — the coding agent calls `list_annotations` or `get_export` to see all review feedback with page URLs, selected text, and reviewer notes.

3. **Agent makes changes** — using the annotation context (page URL, selected text, reviewer note), the agent locates and modifies the relevant source files.

4. **Agent resolves and replies** — after making changes, the agent calls `resolve_annotation` to mark the item as done, and `add_agent_reply` to explain what was changed.

5. **Reviewer sees responses** — the browser UI shows resolved annotations with a checkmark and displays agent replies inline, so the reviewer can verify the changes.

## Troubleshooting

### "Server not found" or connection errors

- Ensure you've run `npm run build` — the server runs from `dist/mcp/server.js`
- Check that the path in `.mcp.json` is correct relative to the project root
- Verify Node.js is available in your PATH

### Empty results from list_annotations

- Check that `inline-review.json` exists and contains annotations
- If using a custom `--storage` path, verify it points to the correct file
- The MCP server reads from disk on every call — if the file was just created, it should be picked up immediately

### Storage path errors

- Paths in `--storage` are resolved relative to the current working directory, not the server script location
- Use an absolute path if relative resolution is causing issues

### Tools not appearing in the agent

- Some MCP clients cache tool lists — restart the agent or reconnect the MCP server
- Verify the server starts without errors: `node ./dist/mcp/server.js` should run silently (output goes to stderr only on errors)

See [MCP Tools Reference](./mcp-tools.md) for detailed documentation of each tool.
