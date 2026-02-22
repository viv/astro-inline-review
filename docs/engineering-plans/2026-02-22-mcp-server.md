---
generated_by: Claude Opus 4.6
generation_date: 2026-02-22
model_version: claude-opus-4-6
purpose: implementation_plan
status: implemented
human_reviewer: matthewvivian
implementation_tracking: completed
supersedes: docs/agent-loop-plans/2026-02-22-mcp-server-implementation.md
tags: [mcp, agent-integration, json, developer-experience, architecture]
---

# MCP Server for astro-inline-review

## Summary

Add an MCP (Model Context Protocol) server to `astro-inline-review` so that coding agents like Claude Code can read and respond to reviewer annotations via structured tools, without requiring manual copy-paste of markdown exports.

This plan implements **Approach B** from the [Agent Bridge plan](./2026-02-22-agent-bridge.md). Approach A (direct JSON file access via CLAUDE.md) is already implemented.

## Architecture

```
┌─────────────┐     HTTP API      ┌──────────────────┐
│   Browser    │ ←──────────────→ │   Vite/Astro      │
│  (reviewer)  │                  │   Dev Server      │
└─────────────┘                  │                    │
                                  │   ReviewStorage    │ ←→ inline-review.json
                                  │                    │
┌─────────────┐   MCP (stdio)    │   MCP Server       │
│ Coding Agent │ ←──────────────→ │   (subprocess)    │
│ (Claude Code)│                  └──────────────────┘
└─────────────┘
```

**Key decisions:**

1. **Transport: stdio** — Agent spawns the MCP server as a subprocess. No HTTP ports, no CORS, no lifecycle coupling.
2. **Separate process** — Runs independently of Vite. Reads the same `inline-review.json`. Works even without the dev server (e.g., reading annotations after a review session).
3. **SDK: v1.x** — `@modelcontextprotocol/sdk` v1.x is the stable, production-recommended version. The v2 SDK is pre-alpha.
4. **Shared `ReviewStorage`** — Reuses the same class as the REST API, ensuring identical file I/O behaviour, migration logic, and write queuing.

## MCP Tools

### Read-Only

| Tool | Description | Parameters |
|------|-------------|------------|
| `list_annotations` | List all annotations, optionally filtered by page URL | `pageUrl` (string, optional) |
| `list_page_notes` | List all page-level notes, optionally filtered by page URL | `pageUrl` (string, optional) |
| `get_annotation` | Get a single annotation by ID | `id` (string, required) |
| `get_export` | Get markdown export of all annotations and notes | None |

### Write (Bidirectional)

| Tool | Description | Parameters |
|------|-------------|------------|
| `resolve_annotation` | Mark an annotation as resolved (addressed) | `id` (string, required) |
| `add_agent_reply` | Add a reply from the agent to an annotation | `id` (string, required), `message` (string, required) |

## Data Model Changes

New optional fields on `BaseAnnotation`:

```typescript
resolvedAt?: string;       // ISO 8601 — when the annotation was marked as resolved
replies?: AgentReply[];    // Agent replies to this annotation

interface AgentReply {
  message: string;
  createdAt: string;       // ISO 8601
}
```

No migration needed — fields are optional and absence means "not resolved" / "no replies".

## New File Structure

```
src/mcp/
  server.ts                    — Entry point (McpServer + StdioServerTransport + CLI arg parsing)
  types.ts                     — Shared ToolResult and ErrorResult interfaces
  tools/
    list-annotations.ts        — list_annotations tool
    list-page-notes.ts         — list_page_notes tool
    get-annotation.ts          — get_annotation tool
    get-export.ts              — get_export tool
    resolve-annotation.ts      — resolve_annotation tool
    add-agent-reply.ts         — add_agent_reply tool
  index.ts                     — Re-exports
src/shared/
  export.ts                    — Extracted generateExport (shared by middleware + MCP + tests)
tests/mcp/
  server.test.ts               — MCP protocol integration tests
  tools/
    list-annotations.test.ts
    list-page-notes.test.ts
    get-annotation.test.ts
    get-export.test.ts
    resolve-annotation.test.ts
    add-agent-reply.test.ts
```

## Deferred Work

- MCP notifications/streaming (push-based annotation updates)
- Agent-created annotations ("I changed this, please review")
- SSE transport (alternative to stdio for remote dev)
- Separate npm package (`astro-inline-review-mcp`)

---

## Sessions

### Session 1: MCP Foundation

**Goal**: Install the MCP SDK, configure the build pipeline for a third entry point, and create a minimal MCP server that starts and connects to stdio.

**Entry state**: Clean main branch, all tests passing. CLAUDE.md exists with Approach A documentation.

**Exit state**: `@modelcontextprotocol/sdk` and `zod` installed. Build produces three entry points (main, client, mcp). Minimal MCP server starts and connects to stdio. All existing tests still pass. Committed.

**Prompt**:

```
Read docs/engineering-plans/2026-02-22-mcp-server.md for full context on what we're building. This is Session 1: MCP Foundation.

Goal: Install the MCP SDK, configure the build for a third entry point, and create a minimal MCP server skeleton.

Steps:

1. Install `@modelcontextprotocol/sdk` and `zod` as dependencies (not devDependencies — they're needed at runtime by the MCP server process).

2. Read `tsup.config.ts` to understand the current build setup, then add a third entry point for `src/mcp/server.ts`:
   - Output to `dist/mcp/`
   - ESM format
   - Add a shebang (`#!/usr/bin/env node`) so it can be run directly
   - Externalise `@modelcontextprotocol/sdk` and `zod` (runtime deps, not bundled)
   - Do NOT generate .d.ts for this entry (it's a CLI, not a library)

3. Update `package.json`:
   - Add export `"./mcp"` pointing to the new entry
   - Add `"bin": { "astro-inline-review-mcp": "./dist/mcp/server.js" }`

4. Create `src/mcp/server.ts` — a minimal MCP server:
   - Import `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js`
   - Import `StdioServerTransport` from `@modelcontextprotocol/sdk/server/stdio.js`
   - Create a server with name `"astro-inline-review-mcp"` and version `"0.1.0"`
   - Connect to stdio transport
   - No tools registered yet — just the bare skeleton

5. Create `src/mcp/index.ts` that re-exports from `./server.js`.

6. Verify:
   - `fish -c "npm run build"` succeeds with three entry points
   - `fish -c "npm test"` — all 92 existing tests still pass
   - `fish -c "echo '{}' | node dist/mcp/server.js"` — server starts (it will hang waiting for MCP protocol messages; that's correct)

7. Commit using conventional commit format. Focus the message on WHY, not WHAT — the diff shows the what. No Co-Authored-By lines.
```

**Status**: `completed`

---

### Session 2: Read-Only MCP Tools

**Goal**: Implement the four read-only tools (`list_annotations`, `list_page_notes`, `get_annotation`, `get_export`) with full test coverage. Extract `generateExport` to a shared module first.

**Entry state**: Session 1 committed. MCP server skeleton exists and builds.

**Exit state**: Four read-only tools implemented, tested, and registered. `generateExport` extracted to `src/shared/export.ts`. All tests pass. Committed.

**Prompt**:

```
Read docs/engineering-plans/2026-02-22-mcp-server.md for full context. This is Session 2: Read-Only MCP Tools.

Goal: Implement list_annotations, list_page_notes, get_annotation, and get_export MCP tools with tests. First, extract the shared export function.

Important: Write tests FIRST for each tool, then implement. Each tool is a vertical slice.

Step 1 — Extract generateExport to shared module:

The `generateExport` function in `src/server/middleware.ts` (line ~229) is duplicated in `src/client/export.ts`. Extract the server version to `src/shared/export.ts` and import it from `middleware.ts`. Do NOT touch the client version — it runs in the browser with different import paths. Update any affected middleware tests. Run tests to verify no regressions. Commit this refactor separately.

Step 2 — Implement each tool (repeat for all four):

For each tool (list_annotations, list_page_notes, get_annotation, get_export):

a) Create test file at `tests/mcp/tools/<tool-name>.test.ts`:
   - Create a temporary directory with `inline-review.json` using `ReviewStorage`
   - Import the tool's handler directly (don't go through MCP protocol)
   - Test happy path
   - Test empty store
   - Test filtering by pageUrl (where applicable)
   - Test error cases (e.g., get_annotation with non-existent ID)

b) Create implementation at `src/mcp/tools/<tool-name>.ts`:
   - Export a `register(server: McpServer, storage: ReviewStorage)` function
   - Call `server.tool()` with name, description, zod schema, and handler
   - Return `{ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] }` for JSON
   - get_export returns `{ content: [{ type: "text", text: markdownString }] }` using the shared generateExport

c) Register in `src/mcp/server.ts`

d) Run tests after each tool

The tool descriptions should be clear enough for an LLM agent to understand without additional context. See the "MCP Tools" table in the engineering plan for the exact names and parameters.

Step 3 — Verify everything:
- `fish -c "npm run build"` succeeds
- `fish -c "npm test"` — all tests pass
- Type-check passes

Commit using conventional commit format. Focus the message on WHY, not WHAT — the diff shows the what. No Co-Authored-By lines.
```

**Status**: `completed`

---

### Session 3: Data Model & Write Tools

**Goal**: Add `resolvedAt` and `replies` fields to the data model. Implement `resolve_annotation` and `add_agent_reply` tools with tests. Produce a design review of the implementation so far.

**Entry state**: Session 2 committed. Four read-only tools working.

**Exit state**: Data model updated. Two write tools implemented and tested. Design review document produced. Committed.

**Prompt**:

```
Read docs/engineering-plans/2026-02-22-mcp-server.md for full context. This is Session 3: Data Model & Write Tools.

Goal: Update the data model, implement the two write tools, and produce a design review.

Part A — Data model update:

1. Add to `BaseAnnotation` in `src/shared/types.ts`:
   - `resolvedAt?: string` (ISO 8601 timestamp)
   - `replies?: AgentReply[]`
2. Add new interface `AgentReply { message: string; createdAt: string }` and export it
3. Run build + tests to verify no regressions (fields are optional so nothing should break)
4. Commit the data model change separately

Part B — Write tools (tests first for each):

resolve_annotation:
- Tests at `tests/mcp/tools/resolve-annotation.test.ts`:
  - Resolving sets `resolvedAt` to valid ISO 8601 timestamp
  - Resolving already-resolved annotation updates `resolvedAt`
  - Non-existent ID returns error
  - Change persists to JSON file (read back and verify)
- Implementation at `src/mcp/tools/resolve-annotation.ts`:
  - Read store, find annotation, set `resolvedAt` + `updatedAt`, write back
  - Return updated annotation
- Register in server.ts

add_agent_reply:
- Tests at `tests/mcp/tools/add-agent-reply.test.ts`:
  - Adding reply to annotation with no replies creates the array
  - Adding reply appends to existing replies
  - Non-existent ID returns error
  - `createdAt` is valid ISO 8601
  - Reply persists to JSON file
  - Empty message is rejected
- Implementation at `src/mcp/tools/add-agent-reply.ts`:
  - Read store, find annotation, append to `replies` (create if needed), set `updatedAt`, write back
  - Return updated annotation
- Register in server.ts

Run full test suite + build + type-check. Commit.

Part C — Design review:

Produce `docs/reviews/2026-02-22-mcp-design-review.md` reviewing the MCP implementation so far. Cover:
1. Architecture assessment (stdio transport, Vite separation)
2. Tool interface quality (clear for LLM agents?)
3. Data model (resolvedAt/replies approach, backwards compat)
4. Code organisation and test quality
5. Findings table (severity, category, description, recommendation)

Use the same frontmatter format as `docs/reviews/2026-02-21-security-review.md`. Address any Critical/High findings. Commit.

Use conventional commit format for each commit. Focus messages on WHY, not WHAT — the diff shows the what. No Co-Authored-By lines.
```

**Status**: `completed`

---

### Session 4: Browser UI for Resolved State & Agent Replies

**Goal**: Update the browser panel UI to display resolved annotations and agent replies. Update highlight styling and markdown export.

**Entry state**: Session 3 committed. Write tools and data model working.

**Exit state**: Panel shows resolved status and agent replies. Highlights distinguish resolved annotations. Export includes resolved/replies. Tests updated. Committed.

**Prompt**:

```
Read docs/engineering-plans/2026-02-22-mcp-server.md for full context. This is Session 4: Browser UI for Resolved State & Agent Replies.

Goal: Update the browser UI so reviewers can see what the coding agent has done — resolved annotations and agent replies.

First, read these files to understand the current rendering:
- src/client/ui/panel.ts
- src/client/styles.ts
- src/client/highlights.ts
- src/client/annotator.ts

Then implement:

1. Panel rendering updates (src/client/ui/panel.ts + src/client/styles.ts):
   - Show a visual "[Resolved]" badge next to resolved annotations (green checkmark or text)
   - Dim or strikethrough resolved annotation text to visually distinguish
   - Show resolvedAt timestamp in human-readable format
   - Display agent replies beneath annotations:
     - Each reply shows message text and timestamp
     - Styled differently from reviewer's note (indented, different background, "Agent:" prefix)
     - Multiple replies in chronological order

2. Highlight styling (src/client/highlights.ts + src/client/styles.ts):
   - Resolved annotations get a distinct highlight style (e.g., green instead of yellow, or reduced opacity)
   - Still visible but clearly "done"

3. Markdown export updates:
   - Update src/shared/export.ts to include "[Resolved]" indicator and agent replies
   - Show replies as nested blockquotes or sub-items under annotations
   - Update src/client/export.ts to match (this is the client-side copy)
   - Update export tests in tests/client/export.test.ts

4. Update panel tests in tests/client/ui/panel.test.ts

5. Run full test suite + build. Commit using conventional commit format. Focus the message on WHY, not WHAT — the diff shows the what. No Co-Authored-By lines.
```

**Status**: `completed`

---

### Session 5: Auto-Discovery, CLI & Integration Tests

**Goal**: Add `--storage` CLI argument parsing to the MCP server, create `.mcp.json` for auto-discovery, write MCP protocol integration tests, and update CLAUDE.md.

**Entry state**: Session 4 committed. Full feature implemented end-to-end.

**Exit state**: MCP server accepts `--storage` arg. `.mcp.json` enables auto-discovery. Integration tests verify the full MCP protocol path. CLAUDE.md updated with MCP documentation. Committed.

**Prompt**:

```
Read docs/engineering-plans/2026-02-22-mcp-server.md for full context. This is Session 5: Auto-Discovery, CLI & Integration Tests.

Goal: Make the MCP server easy to set up and verify the full protocol path works.

Part A — CLI argument parsing:

Update `src/mcp/server.ts` to:
1. Parse `--storage <path>` from `process.argv`
2. Default to `./inline-review.json` if not provided
3. Resolve path relative to `process.cwd()`
4. Pass resolved path to `ReviewStorage`

Write tests for the argument parsing logic (default path, relative paths, absolute paths). This logic should be extracted to a testable function.

Part B — .mcp.json auto-discovery:

Create `.mcp.json` at the project root:
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

Verify the `"files"` field in package.json excludes it from npm publish (it should — "files" is an allowlist of "dist" only).

Part C — MCP protocol integration tests:

Create `tests/mcp/server.test.ts`:
1. Spawn the built MCP server as a subprocess (need to run build first)
2. Send JSON-RPC messages via stdin following the MCP protocol
3. Read responses from stdout
4. Test: list_annotations returns data, get_annotation with valid/invalid ID, resolve_annotation persists, get_export returns markdown
5. Test error handling (missing required params)
6. Clean up subprocess after tests

Also write an end-to-end workflow test:
1. Create ReviewStorage with test data
2. list_annotations → resolve one → add_agent_reply to another → get_export
3. Verify export includes resolved status and replies
4. Verify JSON file matches expectations

Part D — Update CLAUDE.md:

Add an "MCP Server" section explaining:
- Available MCP tools and their purpose
- That .mcp.json enables auto-discovery for Claude Code
- That the MCP server reads the same inline-review.json as the browser

Run full test suite + build. Commit using conventional commit format. Focus the message on WHY, not WHAT — the diff shows the what. No Co-Authored-By lines.
```

**Status**: `completed` (85260ac)

---

### Session 6: Reviews & Final Documentation

**Goal**: Address Session 3 design review findings. Produce security and code review documents. Fix any findings. Update specification and all plan documents. Mark the implementation as complete.

**Entry state**: Session 5 committed. Everything working and tested.

**Exit state**: Design review findings addressed. Security review, code review documents produced. Specification updated. All plan documents updated. Implementation complete. Committed.

**Prompt**:

```
Read docs/engineering-plans/2026-02-22-mcp-server.md for full context. This is Session 6: Reviews & Final Documentation.

Goal: Produce review documents, address design review findings from Session 3, fix any Critical/High findings, and update all project documentation.

Part 0 — Address Session 3 design review findings:

Read `docs/reviews/2026-02-22-mcp-design-review.md` first. Address these findings before producing new reviews:

1. **Finding 1 & 4 (Medium/Low — shared types):** Extract `ToolResult` and `ErrorResult` to `src/mcp/types.ts`. Update all tool files to import from there. Remove the duplicated `ErrorResult` interfaces from get-annotation.ts, resolve-annotation.ts, and add-agent-reply.ts.
2. **Finding 3 (Low — ID validation):** Add `.min(1)` to Zod schemas for `id` parameters across all tools that accept an ID.

Finding 2 (concurrency) and Finding 5 (return shape consistency) are acceptable as-is — document the single-agent assumption in the code review. Finding 6 (integration test) is covered by Session 5 Part C.

Run tests + build after changes. Commit separately.

Part A — Security review:

Produce `docs/reviews/2026-02-22-mcp-security-review.md` covering:
1. Input validation (zod schemas, malicious input)
2. File system access (path traversal via --storage arg)
3. Data integrity (JSON corruption, write queuing)
4. Denial of service (excessive resource usage)
5. Information disclosure
6. Transport security (stdio properties)
7. Dependency audit (@modelcontextprotocol/sdk, zod)
8. Comparison with REST API security review findings

Use the format from docs/reviews/2026-02-21-security-review.md. Fix any Critical/High findings with code changes. Commit.

Part B — Code review:

Produce `docs/reviews/2026-02-22-mcp-code-review.md` covering:
1. Code style consistency with rest of codebase
2. Error handling quality
3. Type safety (any unsafe casts?)
4. Test coverage — run `fish -c "npm test -- --coverage"` and report on MCP files. Target 90%+.
5. Dead code, unnecessary exports
6. Tool description clarity for LLM agents
7. Performance (unnecessary file reads/writes?)

Fix any Critical/High findings. Commit.

Part C — Documentation updates:

1. Update `docs/spec/specification.md`:
   - New section on MCP server (purpose, architecture, tools)
   - Data model changes (resolvedAt, replies, AgentReply)
   - MCP tool interface (names, params, returns)
   - Configuration via .mcp.json and --storage

2. Update `docs/engineering-plans/2026-02-22-agent-bridge.md`:
   - Status → implemented
   - implementation_tracking → completed
   - Notes on what was implemented vs deferred

3. Update `docs/engineering-plans/2026-02-22-mcp-server.md` (this plan):
   - Status → implemented
   - implementation_tracking → completed
   - All sessions → completed

4. Ensure CLAUDE.md is accurate with final state

Commit using conventional commit format. Focus the message on WHY, not WHAT — the diff shows the what. No Co-Authored-By lines.
```

**Status**: `completed`

---

### Session 7: End-User MCP Documentation

**Goal**: Create comprehensive end-user documentation for the MCP feature so consumers of the package know how to set it up and use it with their coding agents.

**Entry state**: Session 6 committed. All engineering work complete, reviews done, internal docs updated.

**Exit state**: User-facing MCP documentation published. README updated. Committed.

**Prompt**:

```
Read docs/engineering-plans/2026-02-22-mcp-server.md for full context. This is Session 7: End-User MCP Documentation.

Goal: Create comprehensive end-user documentation for the MCP feature so package consumers know how to set it up and use it with coding agents.

Entry state: Session 6 committed. All engineering work and internal reviews complete.

Part A — README updates:

Update `README.md` to include an MCP section covering:
1. What the MCP server does and why it's useful (reviewer annotates in browser → agent reads and responds via MCP tools)
2. Quick setup: how `.mcp.json` auto-discovery works with Claude Code (just build and it works)
3. Manual setup: how to configure other MCP-compatible agents using the stdio transport
4. Available tools with descriptions and example usage patterns
5. The `--storage` flag for custom storage paths
6. Relationship between browser UI, REST API, and MCP server (all read/write the same JSON file)

Part B — Usage guide:

Create `docs/guides/mcp-setup.md` as a step-by-step guide:
1. Prerequisites (build the package, have annotations in inline-review.json)
2. Claude Code setup (automatic via .mcp.json — explain what happens)
3. Other MCP clients (manual stdio configuration — show the JSON config)
4. Typical workflow: reviewer annotates → agent lists annotations → agent resolves/replies → reviewer sees responses in browser
5. Troubleshooting: common issues (server not found, empty results, storage path wrong)

Part C — Tool reference:

Create `docs/guides/mcp-tools.md` as a detailed tool reference:
1. Each tool: name, description, parameters (required/optional), return shape, example request/response
2. Error handling: what errors each tool can return and when
3. Workflow examples: common sequences of tool calls for typical tasks

Keep the tone practical and concise — these are docs for developers who want to get set up quickly.

Commit using conventional commit format. Focus the message on WHY, not WHAT — the diff shows the what. No Co-Authored-By lines.
```

**Status**: `completed`

---

## Success Criteria

1. All seven sessions completed and committed.
2. All tests pass with 90%+ coverage on new MCP code.
3. Build and type-check pass.
4. Security review: no unresolved Critical/High findings.
5. Code review: no unresolved Critical/High findings.
6. MCP server starts, connects via stdio, and all 6 tools work.
7. Browser UI shows resolved annotations and agent replies.
8. Markdown export includes resolved status and replies.
9. `.mcp.json` enables auto-discovery for Claude Code.
10. All documentation (CLAUDE.md, spec, plans, reviews) up to date.
11. End-user MCP documentation: README updated, setup guide, and tool reference published.
