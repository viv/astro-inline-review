---
generated_by: Claude Opus 4.6
generation_date: 2026-02-22
model_version: claude-opus-4-6
purpose: autonomous_agent_loop_plan
status: superseded
human_reviewer: matthewvivian
implementation_tracking: not_started
superseded_by: docs/engineering-plans/2026-02-22-mcp-server.md
superseded_reason: Restructured as human-driven session plan instead of autonomous agent loop
tags: [mcp, agent-integration, json, real-time, developer-experience, architecture, autonomous-loop]
related_plans:
  - docs/engineering-plans/2026-02-22-agent-bridge.md
  - docs/engineering-plans/2026-02-22-agent-prompt-export.md
---

# MCP Server Implementation — Autonomous Agent Loop Plan

## Overview

This plan implements **Approach B** from the [Agent Bridge engineering plan](../engineering-plans/2026-02-22-agent-bridge.md): an MCP (Model Context Protocol) server that exposes `astro-inline-review` annotations as structured tools for coding agents like Claude Code.

This document is designed to be executed in a **single Claude Code session** using autonomous iteration (the "Ralph Wiggum" loop). The agent should work through each phase sequentially, committing after each phase, and self-verifying via tests, type-checks, and build before moving on.

## Constraints and Conventions

- **Commits**: Use conventional commit format (`feat:`, `fix:`, `test:`, `docs:`, `refactor:`). Focus on **why** not **what** in commit messages. Do NOT include `Co-Authored-By` or `Generated with Claude Code` lines.
- **Shell**: All commands MUST use `fish -c "command"` wrapper.
- **Tests first**: Write tests before implementation where practical.
- **Small increments**: Each phase produces a working, committable state.
- **Vertical slices**: Implement each tool end-to-end before moving to the next.
- **Documentation**: Keep all specs, plans, and review documents up to date as implementation progresses.
- **UK English**: Use UK English in all documentation and comments (e.g., "organisation" not "organization").

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

The MCP server is a **separate Node.js process** launched via stdio transport. It shares access to `inline-review.json` through its own `ReviewStorage` instance (which always reads from disk, so both browser and agent see the same data with no sync issues).

### Key Design Decisions

1. **Transport: stdio** — Simplest for local dev. Agent spawns the MCP server as a subprocess. No HTTP ports, no CORS, no lifecycle management beyond process start/stop.
2. **Separate process** — The MCP server runs independently of the Vite dev server. It reads the same `inline-review.json` file. This avoids coupling to Astro's lifecycle and makes the MCP server usable even without the dev server running (e.g., for reading annotations after a review session).
3. **v1.x SDK** — Uses `@modelcontextprotocol/sdk` v1.x (the stable, production-recommended version). The v2 SDK is pre-alpha and not ready.
4. **`ReviewStorage` reuse** — The MCP server imports and uses the same `ReviewStorage` class from the main package, ensuring identical file I/O behaviour, migration logic, and write queuing.

## MCP Tool Specification

### Read-Only Tools (Phase 1)

#### `list_annotations`

List all annotations, optionally filtered by page URL.

| Field | Value |
|-------|-------|
| **Name** | `list_annotations` |
| **Description** | List all review annotations. Optionally filter by page URL. Returns text and element annotations with their notes, selectors, and metadata. |
| **Parameters** | `pageUrl` (string, optional) — Filter to annotations on this page URL (e.g., `/about`) |
| **Returns** | JSON array of annotation objects |

#### `list_page_notes`

List all page-level notes, optionally filtered by page URL.

| Field | Value |
|-------|-------|
| **Name** | `list_page_notes` |
| **Description** | List all page-level review notes. Optionally filter by page URL. Page notes are general comments about a page, not tied to specific elements. |
| **Parameters** | `pageUrl` (string, optional) — Filter to notes on this page URL |
| **Returns** | JSON array of page note objects |

#### `get_annotation`

Get a single annotation by ID.

| Field | Value |
|-------|-------|
| **Name** | `get_annotation` |
| **Description** | Get a single annotation by its ID. Returns the full annotation object including type, note, page URL, and selector/range details. |
| **Parameters** | `id` (string, required) — The annotation ID |
| **Returns** | Single annotation object, or error if not found |

#### `get_export`

Get the full markdown export of all annotations and notes.

| Field | Value |
|-------|-------|
| **Name** | `get_export` |
| **Description** | Get a markdown export of all annotations and page notes, grouped by page URL. This is the same format as the browser's "Copy All" export. |
| **Parameters** | None |
| **Returns** | Markdown text |

### Write Tools (Phase 2)

#### `resolve_annotation`

Mark an annotation as resolved (addressed by the agent).

| Field | Value |
|-------|-------|
| **Name** | `resolve_annotation` |
| **Description** | Mark an annotation as resolved. This records that the annotation has been addressed. The annotation is preserved (not deleted) for history. |
| **Parameters** | `id` (string, required) — The annotation ID to resolve |
| **Returns** | Updated annotation object with `resolvedAt` timestamp |

#### `add_agent_reply`

Add a reply from the agent to an annotation.

| Field | Value |
|-------|-------|
| **Name** | `add_agent_reply` |
| **Description** | Add a reply to an annotation. Use this to communicate back to the reviewer what was done, what questions remain, or why something was not changed. |
| **Parameters** | `id` (string, required) — The annotation ID to reply to; `message` (string, required) — The reply message |
| **Returns** | Updated annotation object with the new reply appended |

## Data Model Changes

### New Fields on `BaseAnnotation`

```typescript
interface BaseAnnotation {
  // ... existing fields ...
  resolvedAt?: string;       // ISO 8601 timestamp, set when resolved
  replies?: AgentReply[];    // Agent replies to this annotation
}

interface AgentReply {
  message: string;
  createdAt: string;         // ISO 8601 timestamp
}
```

### Migration

- Existing annotations without `resolvedAt` or `replies` are valid — these fields are optional.
- No data migration needed; absence of the field means "not resolved" / "no replies".

## File Structure

New files to create:

```
src/
  mcp/
    server.ts          — MCP server entry point (McpServer + StdioServerTransport)
    tools/
      list-annotations.ts    — list_annotations tool
      list-page-notes.ts     — list_page_notes tool
      get-annotation.ts      — get_annotation tool
      get-export.ts          — get_export tool
      resolve-annotation.ts  — resolve_annotation tool (Phase 2)
      add-agent-reply.ts     — add_agent_reply tool (Phase 2)
    index.ts           — re-export for convenience
tests/
  mcp/
    server.test.ts     — integration tests for MCP server
    tools/
      list-annotations.test.ts
      list-page-notes.test.ts
      get-annotation.test.ts
      get-export.test.ts
      resolve-annotation.test.ts
      add-agent-reply.test.ts
docs/
  agent-loop-plans/
    2026-02-22-mcp-server-implementation.md  — this plan
  reviews/
    2026-02-22-mcp-design-review.md          — design review (Phase 1)
    2026-02-22-mcp-security-review.md        — security review (Phase 5)
    2026-02-22-mcp-code-review.md            — code review (Phase 5)
```

## Implementation Phases

---

### Phase 0: Setup and Dependencies

**Goal**: Install MCP SDK, configure build, verify everything still compiles and tests pass.

**Prompt for agent**:

> Read `docs/agent-loop-plans/2026-02-22-mcp-server-implementation.md` for context. You are implementing Phase 0: Setup and Dependencies.
>
> 1. Install `@modelcontextprotocol/sdk` and `zod` as dependencies (not devDependencies — they're needed at runtime by the MCP server).
> 2. Update `tsup.config.ts` to add a third entry point for `src/mcp/server.ts` that builds as ESM with a shebang (`#!/usr/bin/env node`) so it can be run directly. This entry should be named `mcp` and output to `dist/mcp/`. It should externalise `@modelcontextprotocol/sdk` and `zod` (they're runtime deps, not bundled).
> 3. Update `package.json` exports to add `"./mcp"` pointing to the new entry.
> 4. Add a `"bin"` field in `package.json`: `{ "astro-inline-review-mcp": "./dist/mcp/server.js" }`.
> 5. Create a minimal `src/mcp/server.ts` that imports `McpServer` and `StdioServerTransport`, creates a server with name `"astro-inline-review-mcp"` and version from package.json, connects to stdio transport, and exits cleanly. No tools registered yet.
> 6. Create a minimal `src/mcp/index.ts` that re-exports from `server.ts`.
> 7. Run `npm run build` and verify it succeeds.
> 8. Run `npm test` and verify all existing tests still pass.
> 9. Run the MCP server manually to verify it starts: `echo '{}' | node dist/mcp/server.js` (it should start and wait for input).
>
> Commit with message explaining we're adding MCP infrastructure to support agent integration.
> Update Phase 0 status to `completed` in the plan document and Phase 1 to `in_progress`.

**Entry state**: Clean main branch, all tests passing.

**Exit state**: MCP SDK installed, build produces three entry points (main, client, mcp), minimal MCP server starts successfully. Committed.

**Status**: `not_started`

---

### Phase 1: Read-Only Tools — Tests First

**Goal**: Implement `list_annotations`, `list_page_notes`, `get_annotation`, and `get_export` tools with full test coverage.

**Prompt for agent**:

> Read `docs/agent-loop-plans/2026-02-22-mcp-server-implementation.md` for context. You are implementing Phase 1: Read-Only Tools.
>
> **Important**: Write tests FIRST, then implement. Each tool is a vertical slice (test + implementation).
>
> For each tool (`list_annotations`, `list_page_notes`, `get_annotation`, `get_export`):
>
> 1. Create the test file at `tests/mcp/tools/<tool-name>.test.ts`.
> 2. Tests should:
>    - Create a temporary `inline-review.json` with known test data using `ReviewStorage`.
>    - Import the tool's handler function directly (don't go through MCP protocol for unit tests).
>    - Test the happy path (returns expected data).
>    - Test with empty store (no annotations/notes).
>    - Test filtering by `pageUrl` where applicable.
>    - Test error cases (e.g., `get_annotation` with non-existent ID).
> 3. Implement the tool in `src/mcp/tools/<tool-name>.ts`.
>    - Each tool module should export a `register` function that takes the `McpServer` instance and `ReviewStorage` instance and calls `server.tool()`.
>    - Use zod schemas for parameter validation.
>    - Return `{ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] }` for JSON responses.
>    - The `get_export` tool should return `{ content: [{ type: "text", text: markdownString }] }`.
>    - For `get_export`, reuse the `generateExport` function from `src/server/middleware.ts`. This will require extracting it to a shared location first (e.g., `src/shared/export.ts`).
> 4. Register the tool in `src/mcp/server.ts`.
> 5. Run tests after each tool to verify they pass.
>
> After all four tools are implemented:
> - Run `npm run build` to verify the build succeeds.
> - Run `npm test` to verify all tests pass (both existing and new).
> - Run type checking to verify no TypeScript errors.
>
> **Refactoring note**: The `generateExport` function currently lives in `src/server/middleware.ts` and is duplicated in `src/client/export.ts`. Extract the server version to `src/shared/export.ts` and import it from both `middleware.ts` and the new `get_export` tool. Update the existing middleware tests if imports change. Do NOT modify the client version (it has different import paths and runs in the browser).
>
> Commit with a message explaining the read-only MCP tools enable agents to read review annotations without copy-paste.
> Update Phase 1 status to `completed` in the plan document and Phase 2 to `in_progress`.

**Entry state**: Phase 0 committed. MCP server skeleton exists.

**Exit state**: Four read-only tools implemented and tested. `generateExport` extracted to shared module. Committed.

**Status**: `not_started`

---

### Phase 2: Design Review

**Goal**: Pause implementation to review the design so far. Produce a design review document.

**Prompt for agent**:

> Read `docs/agent-loop-plans/2026-02-22-mcp-server-implementation.md` for context. You are performing Phase 2: Design Review.
>
> Review the MCP server implementation so far (Phase 0 + Phase 1) and produce a design review document at `docs/reviews/2026-02-22-mcp-design-review.md`.
>
> The review should cover:
>
> 1. **Architecture assessment**: Is the stdio transport the right choice? Is the separation from the Vite dev server appropriate? Are there any coupling concerns?
> 2. **Tool interface quality**: Are the tool names, descriptions, parameters, and return types clear and useful for an LLM agent? Would an agent understand how to use these tools from the descriptions alone?
> 3. **Data model review**: Are the proposed `resolvedAt` and `replies` fields the right approach for Phase 3? Are there backwards compatibility concerns?
> 4. **Code organisation**: Is the file structure clean? Is the shared `generateExport` extraction done well?
> 5. **Test quality**: Are the tests comprehensive? Are edge cases covered?
> 6. **API consistency**: Do the MCP tool responses match the REST API responses? Should they?
> 7. **Findings table**: List all findings with severity (Critical/High/Medium/Low/Informational), category, description, and recommendation.
>
> Use the same frontmatter format as existing reviews in `docs/reviews/`. Look at `docs/reviews/2026-02-21-security-review.md` for the format.
>
> After writing the review, address any Critical or High findings before proceeding. Medium findings should be noted for future work. Low and Informational findings are acceptable to defer.
>
> Commit the review document.
> Update Phase 2 status to `completed` in the plan document and Phase 3 to `in_progress`.

**Entry state**: Phase 1 committed. Read-only tools working.

**Exit state**: Design review document produced. Any critical findings addressed. Committed.

**Status**: `not_started`

---

### Phase 3: Write Tools — Data Model + Implementation

**Goal**: Add `resolvedAt` and `replies` fields to the data model, then implement `resolve_annotation` and `add_agent_reply` tools with tests.

**Prompt for agent**:

> Read `docs/agent-loop-plans/2026-02-22-mcp-server-implementation.md` for context. You are implementing Phase 3: Write Tools.
>
> **Step 1: Update the data model**
>
> 1. Add `resolvedAt?: string` and `replies?: AgentReply[]` to `BaseAnnotation` in `src/shared/types.ts`.
> 2. Add the `AgentReply` interface: `{ message: string; createdAt: string }`.
> 3. Export `AgentReply` from `src/shared/types.ts`.
> 4. Run `npm run build` and `npm test` to verify no regressions. The new fields are optional, so existing code should be unaffected.
> 5. Commit the data model change separately — it's a distinct logical change.
>
> **Step 2: Implement `resolve_annotation` tool**
>
> 1. Write tests first at `tests/mcp/tools/resolve-annotation.test.ts`:
>    - Resolving an existing annotation sets `resolvedAt` to a valid ISO 8601 timestamp.
>    - Resolving an already-resolved annotation updates the `resolvedAt` timestamp.
>    - Resolving a non-existent ID returns an error.
>    - The resolved annotation is persisted to the JSON file (read it back and verify).
> 2. Implement `src/mcp/tools/resolve-annotation.ts`.
>    - Read the store, find the annotation, set `resolvedAt` and `updatedAt`, write the store back.
>    - Return the updated annotation.
> 3. Register in `src/mcp/server.ts`.
> 4. Run tests.
>
> **Step 3: Implement `add_agent_reply` tool**
>
> 1. Write tests first at `tests/mcp/tools/add-agent-reply.test.ts`:
>    - Adding a reply to an annotation with no existing replies creates the array.
>    - Adding a reply to an annotation with existing replies appends to the array.
>    - Replying to a non-existent annotation ID returns an error.
>    - The reply's `createdAt` is a valid ISO 8601 timestamp.
>    - The reply is persisted to the JSON file.
>    - The `message` parameter is required and must be non-empty.
> 2. Implement `src/mcp/tools/add-agent-reply.ts`.
>    - Read the store, find the annotation, append to `replies` array (creating it if needed), set `updatedAt`, write back.
>    - Return the updated annotation.
> 3. Register in `src/mcp/server.ts`.
> 4. Run tests.
>
> After both tools:
> - Run full test suite.
> - Run type checking.
> - Run build.
>
> Commit with a message explaining the write tools enable bidirectional communication between agent and reviewer.
> Update Phase 3 status to `completed` and Phase 4 to `in_progress` in the plan document.

**Entry state**: Phase 2 committed. Design review complete.

**Exit state**: Two write tools implemented and tested. Data model updated with `resolvedAt` and `replies`. Committed.

**Status**: `not_started`

---

### Phase 4: Browser UI Updates for Resolved State and Agent Replies

**Goal**: Update the browser panel UI to display resolved annotations and agent replies.

**Prompt for agent**:

> Read `docs/agent-loop-plans/2026-02-22-mcp-server-implementation.md` for context. You are implementing Phase 4: Browser UI Updates.
>
> The MCP write tools (Phase 3) can now mark annotations as resolved and add agent replies. The browser UI needs to reflect these states so the reviewer can see what the agent has done.
>
> **Step 1: Understand the current UI**
>
> Read these files to understand the current panel rendering:
> - `src/client/ui/panel.ts` — the review panel (annotation list, page notes)
> - `src/client/styles.ts` — CSS styles
> - `src/client/annotator.ts` — annotation orchestrator
> - `src/client/highlights.ts` — highlight rendering
>
> **Step 2: Update panel rendering**
>
> 1. In the panel's annotation list, show a visual indicator for resolved annotations:
>    - Add a "Resolved" badge/label next to resolved annotations (subtle, e.g., a green checkmark or "[Resolved]" text).
>    - Optionally dim/strikethrough the annotation text to visually distinguish it.
>    - Show the `resolvedAt` timestamp in a human-readable format.
> 2. Display agent replies beneath annotations:
>    - Each reply should show the message text and timestamp.
>    - Style replies differently from the reviewer's note (e.g., indented, different background, prefixed with "Agent:").
>    - If there are multiple replies, show them in chronological order.
>
> **Step 3: Update highlight rendering**
>
> 1. Resolved annotations should have a visually distinct highlight style:
>    - Consider using a different colour (e.g., green instead of yellow) or reducing opacity.
>    - The highlight should still be visible but clearly "done".
>
> **Step 4: Update the markdown export**
>
> 1. Update `src/shared/export.ts` (the shared export function) to include resolved status and agent replies in the markdown output.
>    - Add "[Resolved]" indicator after the annotation.
>    - Show agent replies as nested blockquotes or sub-items under the annotation.
> 2. Update the client-side `src/client/export.ts` to match.
> 3. Update existing export tests to cover the new output format.
>
> **Step 5: Tests**
>
> 1. Update panel tests if they exist (`tests/client/ui/panel.test.ts`).
> 2. Update export tests (`tests/client/export.test.ts` and any server-side export tests).
> 3. Run full test suite.
>
> Commit with a message explaining the UI now shows resolved state and agent replies so reviewers can see what the coding agent has done.
> Update Phase 4 status to `completed` and Phase 5 to `in_progress` in the plan document.

**Entry state**: Phase 3 committed. Write tools working.

**Exit state**: Browser UI shows resolved status and agent replies. Export includes them. Committed.

**Status**: `not_started`

---

### Phase 5: MCP Auto-Discovery Configuration

**Goal**: Enable easy setup of the MCP server for Claude Code users by generating a `.mcp.json` configuration file and documenting setup.

**Prompt for agent**:

> Read `docs/agent-loop-plans/2026-02-22-mcp-server-implementation.md` for context. You are implementing Phase 5: MCP Auto-Discovery Configuration.
>
> **Step 1: Create `.mcp.json` for project-scoped MCP configuration**
>
> Create a `.mcp.json` file at the project root that configures the MCP server for Claude Code. The format is:
>
> ```json
> {
>   "mcpServers": {
>     "astro-inline-review": {
>       "type": "stdio",
>       "command": "node",
>       "args": ["./dist/mcp/server.js", "--storage", "./inline-review.json"]
>     }
>   }
> }
> ```
>
> The MCP server needs to accept a `--storage` CLI argument to know where the `inline-review.json` file is. Update `src/mcp/server.ts` to:
> 1. Parse `--storage <path>` from `process.argv`.
> 2. Default to `./inline-review.json` if not provided.
> 3. Resolve the path relative to `process.cwd()`.
> 4. Pass the resolved path to `ReviewStorage`.
>
> **Step 2: Update CLAUDE.md**
>
> Add an "MCP Server" section to the project `CLAUDE.md` explaining:
> - How to connect via MCP (the `.mcp.json` should auto-discover)
> - Available tools and their purpose
> - That the MCP server reads the same `inline-review.json` as the browser UI
>
> **Step 3: Add `.mcp.json` to `.npmignore` or exclude from package**
>
> The `.mcp.json` is project-specific and should NOT be published to npm. Verify the `"files"` field in `package.json` excludes it (it should, since `"files"` is an allowlist).
>
> **Step 4: Test the CLI argument parsing**
>
> 1. Write a test for the `--storage` argument parsing logic.
> 2. Test default path when no argument provided.
> 3. Test relative and absolute paths.
>
> Commit with a message explaining the MCP auto-discovery allows Claude Code to connect to the review server automatically.
> Update Phase 5 status to `completed` and Phase 6 to `in_progress` in the plan document.

**Entry state**: Phase 4 committed. UI updates complete.

**Exit state**: `.mcp.json` created, CLI args working, CLAUDE.md updated. Committed.

**Status**: `not_started`

---

### Phase 6: Security Review

**Goal**: Conduct a security review of the MCP server implementation.

**Prompt for agent**:

> Read `docs/agent-loop-plans/2026-02-22-mcp-server-implementation.md` for context. You are performing Phase 6: Security Review.
>
> Conduct a security review of the MCP server implementation and produce a review document at `docs/reviews/2026-02-22-mcp-security-review.md`.
>
> The review should cover:
>
> 1. **Input validation**: Are all MCP tool inputs properly validated via zod schemas? Can malicious input cause issues?
> 2. **File system access**: The MCP server reads/writes `inline-review.json`. Are there path traversal risks with the `--storage` argument? Can the server be tricked into reading/writing other files?
> 3. **Data integrity**: Can the MCP server corrupt the JSON file? Are writes properly queued?
> 4. **Denial of service**: Can an agent send inputs that cause excessive resource usage (memory, disk, CPU)?
> 5. **Information disclosure**: Does the MCP server expose any sensitive information? (It's dev-only, but still worth checking.)
> 6. **Transport security**: stdio is local-only, but document the security properties.
> 7. **Dependency audit**: Review the new dependencies (`@modelcontextprotocol/sdk`, `zod`) for known vulnerabilities.
> 8. **Comparison with REST API**: The REST API had a previous security review. Are the same mitigations applied to the MCP tools? (Body size limits, field allowlists, etc.)
>
> Use the same format as `docs/reviews/2026-02-21-security-review.md`. Include a findings table with severity ratings.
>
> Address any Critical or High findings immediately with code changes. Commit the fixes and the review document.
> Update Phase 6 status to `completed` and Phase 7 to `in_progress` in the plan document.

**Entry state**: Phase 5 committed. Full feature implemented.

**Exit state**: Security review document produced. Critical/High findings fixed. Committed.

**Status**: `not_started`

---

### Phase 7: Code Review

**Goal**: Conduct a code quality review of the entire MCP implementation.

**Prompt for agent**:

> Read `docs/agent-loop-plans/2026-02-22-mcp-server-implementation.md` for context. You are performing Phase 7: Code Review.
>
> Conduct a code quality review of the MCP server implementation and produce a review document at `docs/reviews/2026-02-22-mcp-code-review.md`.
>
> The review should cover:
>
> 1. **Code style consistency**: Does the MCP code follow the same patterns as the rest of the codebase?
> 2. **Error handling**: Are errors handled consistently? Do error messages help the agent understand what went wrong?
> 3. **Type safety**: Are TypeScript types used effectively? Any `any` types or unsafe casts?
> 4. **Test coverage**: Run `npm test -- --coverage` and report coverage for the new MCP files. Target 90%+ line coverage.
> 5. **Dead code**: Is there any unused code? Any unnecessary exports?
> 6. **Documentation**: Are the tool descriptions clear enough for an LLM agent to use without additional context?
> 7. **Performance**: Are there any unnecessary file reads or writes? Could anything be optimised?
> 8. **Findings table**: Same format as other reviews.
>
> Address any Critical or High findings. Commit fixes and the review document.
> Update Phase 7 status to `completed` and Phase 8 to `in_progress` in the plan document.

**Entry state**: Phase 6 committed. Security review done.

**Exit state**: Code review document produced. Quality issues fixed. Committed.

**Status**: `not_started`

---

### Phase 8: Integration Testing and End-to-End Verification

**Goal**: Verify the complete MCP workflow works end-to-end.

**Prompt for agent**:

> Read `docs/agent-loop-plans/2026-02-22-mcp-server-implementation.md` for context. You are implementing Phase 8: Integration Testing.
>
> **Step 1: MCP protocol integration test**
>
> Create `tests/mcp/server.test.ts` that tests the MCP server through the actual MCP protocol:
>
> 1. Spawn the MCP server as a subprocess.
> 2. Send MCP protocol messages (JSON-RPC) via stdin.
> 3. Read responses from stdout.
> 4. Verify each tool can be called and returns expected results.
> 5. Verify error handling (invalid tool names, missing required params).
> 6. Clean up the subprocess after tests.
>
> This is different from the unit tests in Phase 1/3 which test handlers directly. This tests the full protocol path.
>
> **Step 2: End-to-end workflow test**
>
> Write a test that simulates the full review workflow:
>
> 1. Create a `ReviewStorage` with some test annotations.
> 2. Use the MCP server to `list_annotations`.
> 3. Use `resolve_annotation` on one.
> 4. Use `add_agent_reply` on another.
> 5. Use `get_export` and verify the markdown includes resolved status and replies.
> 6. Read the JSON file directly and verify it matches expectations.
>
> **Step 3: Manual verification checklist**
>
> Document and verify these manually (output results as comments in the test file or in the commit message):
>
> 1. `npm run build` succeeds.
> 2. `npm test` — all tests pass.
> 3. Type-check passes.
> 4. The MCP server binary is executable: `node dist/mcp/server.js --help` (or similar).
> 5. `.mcp.json` is valid JSON and the paths resolve correctly.
>
> Commit with a message explaining the integration tests verify the full MCP protocol path.
> Update Phase 8 status to `completed` and Phase 9 to `in_progress` in the plan document.

**Entry state**: Phase 7 committed. All reviews done.

**Exit state**: Integration tests passing. Full workflow verified. Committed.

**Status**: `not_started`

---

### Phase 9: Documentation and Specification Updates

**Goal**: Update all project documentation to reflect the MCP server feature.

**Prompt for agent**:

> Read `docs/agent-loop-plans/2026-02-22-mcp-server-implementation.md` for context. You are implementing Phase 9: Documentation Updates.
>
> **Step 1: Update the specification**
>
> Update `docs/spec/specification.md` to include:
> 1. A new section on the MCP server (purpose, architecture, tools).
> 2. The data model changes (`resolvedAt`, `replies`, `AgentReply`).
> 3. The MCP tool interface (names, parameters, return types).
> 4. Configuration via `.mcp.json` and `--storage` CLI arg.
>
> **Step 2: Update the agent bridge engineering plan**
>
> Update `docs/engineering-plans/2026-02-22-agent-bridge.md`:
> 1. Change status from `draft` to `implemented` (for Approach A and Approach B core).
> 2. Update implementation_tracking to `completed`.
> 3. Add notes on what was implemented vs. what was deferred.
> 4. Update session descriptions to reflect actual implementation.
>
> **Step 3: Update this plan document**
>
> Update `docs/agent-loop-plans/2026-02-22-mcp-server-implementation.md`:
> 1. Change status from `draft` to `implemented`.
> 2. Change implementation_tracking to `completed`.
> 3. Mark all phases as `completed`.
>
> **Step 4: Final CLAUDE.md update**
>
> Ensure `CLAUDE.md` is complete and accurate with the final state of the MCP server.
>
> Commit with a message explaining documentation updated to reflect completed MCP server implementation.
> Update Phase 9 status to `completed` in the plan document.

**Entry state**: Phase 8 committed. Everything working.

**Exit state**: All documentation up to date. Plan marked as implemented. Committed.

**Status**: `not_started`

---

## Deferred Work

These items were identified but are explicitly out of scope for this plan:

1. **MCP notifications/streaming** — The MCP spec supports server-to-client notifications. This could enable push-based updates when new annotations appear. Deferred because it requires MCP client support for notifications, which is not universally available.
2. **Agent-created annotations** — Letting the agent create new annotations (e.g., "I changed this, please review"). This would make the flow truly bidirectional but adds complexity to the browser UI.
3. **Annotation categories/priorities** — Adding structured metadata beyond free-text notes. Not needed for the initial implementation.
4. **SSE transport** — An alternative to stdio that reuses the Vite dev server's HTTP port. More complex to set up but could be useful for remote dev environments. Deferred in favour of stdio simplicity.
5. **Separate npm package** — The MCP server could be published as `astro-inline-review-mcp` for independent versioning. Deferred until the API stabilises.

## Success Criteria

The implementation is complete when:

1. All nine phases are marked as `completed`.
2. All tests pass with 90%+ coverage on new MCP code.
3. Build succeeds without errors or warnings.
4. Type-check passes.
5. Security review has no unresolved Critical or High findings.
6. Code review has no unresolved Critical or High findings.
7. Design review has no unresolved Critical or High findings.
8. The MCP server can be started, connected to from Claude Code, and used to read and write annotations.
9. The browser UI correctly displays resolved annotations and agent replies.
10. All documentation (CLAUDE.md, specification, engineering plans, this plan) is up to date.

## Autonomous Loop Instructions

When executing this plan in an autonomous loop:

1. **Read this plan** at the start of each iteration to understand current state.
2. **Find the first phase with status `not_started` or `in_progress`** — that's your current task.
3. **Follow the prompt** for that phase exactly.
4. **Run tests, build, and type-check** after every code change.
5. **Commit** at the end of each phase with a conventional commit message (no Co-Authored-By).
6. **Update this plan** to mark the phase as completed and the next phase as in_progress.
7. **If stuck**, do not brute-force. Note the issue in the plan document and move on or ask for human input.
8. **Keep all review documents up to date** — if a code change invalidates a finding from a review, update the review.
