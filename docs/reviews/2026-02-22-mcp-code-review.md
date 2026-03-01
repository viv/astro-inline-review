---
generated_by: Claude Opus 4.6
generation_date: 2026-02-22
model_version: claude-opus-4-6
purpose: code_review
status: resolved
scope: [review-loop, mcp-server]
tags: [code-review, mcp, agent-integration, quality]
---

# Code Review: MCP Server

## Executive Summary

The MCP server implementation spans 8 source files (~280 lines) in `src/mcp/` with 45 tests across 8 test files. The code is clean, consistent, and well-structured. Each tool follows an identical pattern (handler function + register function), making the codebase easy to navigate and extend. Test coverage for MCP files is effectively 100% on all runtime code. No Critical or High findings.

## Findings Table

| # | Severity | Category | Description | Recommendation |
|---|----------|----------|-------------|----------------|
| 1 | Low | Dead Code | `src/mcp/index.ts` barrel re-export is unused | Remove or document its purpose |
| 2 | Low | Exports | Handler functions exported but only used in tests | Acceptable — intentional for testability |
| 3 | Low | Consistency | `add_agent_reply` has application-level empty check beyond Zod | Acceptable — stricter than schema validation |
| 4 | Informational | Performance | Each tool call reads from disk; no caching | Correct design — matches ReviewStorage contract |
| 5 | Informational | Concurrency | Single-agent assumption not documented in code | Add brief comment to write tools |

## Detailed Findings

### 1. Code Style Consistency

The MCP code follows the same patterns as the rest of the codebase:

- **Import ordering:** Node builtins, third-party, local — consistent across all files
- **Naming:** snake_case for MCP tool names (MCP convention), camelCase for TypeScript functions (TS convention)
- **Formatting:** Consistent indentation, trailing commas, semicolons — matches existing code
- **File organisation:** One concern per file. Each tool file has a handler function and a register function. Types are in `types.ts`. Server setup is in `server.ts`.
- **ESM imports:** All use `.js` extensions in import paths, consistent with the rest of the codebase

No style inconsistencies found.

### 2. Error Handling Quality

Error handling is consistent and well-structured:

- **Not-found errors:** All three ID-based tools (`get_annotation`, `resolve_annotation`, `add_agent_reply`) return `{ isError: true, content: [{ type: 'text', text: '...' }] }` with a message that includes the searched ID
- **Validation errors:** `add_agent_reply` checks for empty/whitespace messages before hitting storage
- **Zod validation:** The MCP SDK validates parameters against Zod schemas before the handler runs. Invalid types are rejected at the protocol level.
- **Storage errors:** `ReviewStorage.read()` gracefully returns an empty store on file-not-found or parse errors. This means a missing or corrupt `inline-review.json` produces empty results rather than crashes.

One consideration: the handlers do not catch exceptions from `storage.write()`. If the file system write fails (e.g., permission denied, disk full), the exception will propagate to the MCP SDK, which will return an error response to the agent. This is appropriate — the SDK handles uncaught exceptions in tool handlers.

### 3. Type Safety

- **No `any` types** in MCP code
- **No unsafe casts** — the handlers use TypeScript interfaces correctly
- **`ToolResult` and `ErrorResult`** are properly typed with index signatures for the MCP SDK's expected shape
- **Handler return types** are explicit: `Promise<ToolResult>` for read-only tools, `Promise<ToolResult | ErrorResult>` for tools that can fail

The `[key: string]: unknown` index signature on `ToolResult` is necessary because the MCP SDK expects tool results to be plain objects with optional extra fields (like `isError`). This is the correct way to type it.

One note: the handler parameter types (e.g., `params: { id: string }`) are defined inline rather than imported from Zod's inferred types. This creates a minor duplication between the Zod schema and the TypeScript type, but for simple schemas with 1-2 string fields, this is clearer than `z.infer<typeof schema>`.

### 4. Test Coverage

Coverage report for MCP files:

| File | Statements | Branch | Functions | Lines |
|------|-----------|--------|-----------|-------|
| `src/mcp/server.ts` | 100% | 100% | 100% | 100% |
| `src/mcp/tools/add-agent-reply.ts` | 100% | 100% | 100% | 100% |
| `src/mcp/tools/get-annotation.ts` | 100% | 100% | 100% | 100% |
| `src/mcp/tools/get-export.ts` | 100% | 100% | 100% | 100% |
| `src/mcp/tools/list-annotations.ts` | 100% | 100% | 100% | 100% |
| `src/mcp/tools/list-page-notes.ts` | 100% | 100% | 100% | 100% |
| `src/mcp/tools/resolve-annotation.ts` | 100% | 100% | 100% | 100% |
| `src/mcp/types.ts` | 0% | 0% | 0% | 0% |
| `src/mcp/index.ts` | 0% | 0% | 0% | 0% |

The `types.ts` file contains only TypeScript interfaces (no runtime code), so 0% coverage is expected — there is nothing to execute. The `index.ts` barrel file is a single re-export line.

**Effective runtime coverage: 100%** across all MCP code.

Test structure:
- **35 unit tests** (6 files, one per tool + `parseStoragePath`) — test handlers in isolation with real `ReviewStorage` instances and temp files
- **10 integration tests** (1 file) — spawn the MCP server as a child process and send real MCP protocol messages over stdio

The integration tests cover the full stack: process spawn → stdio transport → MCP SDK → tool handler → file I/O → response parsing. This gives high confidence in the transport wiring.

### 5. Dead Code and Unnecessary Exports

**`src/mcp/index.ts`** — This barrel file (`export * from './server.js'`) re-exports from `server.ts`. It is not imported anywhere in the source code. The MCP server entry point is `src/mcp/server.ts` (configured directly in `tsup.config.ts`). The barrel may have been created for future use (e.g., if consumers wanted to import `parseStoragePath` programmatically via `review-loop/mcp`).

**Handler function exports** — Each tool file exports both the handler function and the register function. The register functions are used by `server.ts`. The handler functions are used only by tests. Exporting handlers for testability is a common and acceptable pattern. The alternative (testing only through the MCP protocol) would be slower and less targeted.

**`parseStoragePath` export** — Exported from `server.ts` and imported by tests. Used in the `main()` function. Not dead code.

### 6. Tool Description Clarity for LLM Agents

Each tool has a clear, descriptive string that tells the agent:
- What the tool does
- When to use it
- What the return value contains (implied by the description)

| Tool | Description Quality |
|------|-------------------|
| `list_annotations` | Good — mentions "text and element annotations", "notes, selectors, and page context", optional filter |
| `list_page_notes` | Good — distinguishes from annotations ("not tied to specific text or elements") |
| `get_annotation` | Good — mentions "full annotation including type, page URL, note, and selector/range details" |
| `get_export` | Good — mentions "grouped by page URL" and "complete overview" |
| `resolve_annotation` | Good — explains what "resolved" means, notes re-call behaviour |
| `add_agent_reply` | Good — explains the purpose ("so reviewers can see agent responses") |

Parameter descriptions use `.describe()` with concrete examples (e.g., `"/about"` for page URL). The descriptions are concise and actionable. No improvements needed.

### 7. Performance

**File reads per tool call:** Each tool call triggers a `storage.read()` which reads from disk. This is by design — `ReviewStorage` has no in-memory cache so that external edits (from the browser UI or manual editing) are picked up immediately. For a tool that is called infrequently (agent interactions, not hot-path code), disk reads are not a concern.

**`JSON.stringify(result, null, 2)`:** Results are pretty-printed for agent readability. The overhead is negligible for the data sizes involved (tens to hundreds of annotations).

**`generateExport()`:** The export tool builds a full markdown string in memory. This is bounded by the annotation count, which is bounded by human reviewer activity. No performance concern.

**No unnecessary writes:** Read-only tools (`list_annotations`, `list_page_notes`, `get_annotation`, `get_export`) never call `storage.write()`. Only the two write tools write to disk, and only after successful mutation.

## Additional Observations

### Shared Code Reuse

The MCP server effectively reuses existing infrastructure:
- `ReviewStorage` — same class as the REST API
- `generateExport()` — shared between REST API middleware and MCP `get_export` tool
- `src/shared/types.ts` — canonical type definitions shared across all components

This prevents behaviour drift between the REST API and MCP interfaces.

### Pattern Consistency

All 6 tool files follow an identical structure:

```
1. Imports (zod, McpServer, ReviewStorage, types)
2. Handler function (async, takes storage + params)
3. Register function (calls server.tool with name, description, schema, handler)
```

This makes it trivial to add new tools — copy any existing tool file and modify.

### Process Lifecycle

The `main()` function in `server.ts` is clean: parse args → create storage → create server → register tools → connect transport. No cleanup logic is needed because the process is spawned and terminated by the parent (the coding agent). The MCP SDK handles graceful shutdown on stdin close.

## Recommendations

### No Critical or High Findings

No code changes required.

### Nice to Have

1. **Consider removing `src/mcp/index.ts`** if it serves no purpose. The MCP server entry point is `src/mcp/server.ts`, configured directly in `tsup.config.ts` and `package.json`. The barrel file is unused. (Finding #1)

2. **Add a brief comment to write tools** noting the single-agent assumption:
   ```typescript
   // Note: read-modify-write is not atomic across processes.
   // This is safe for single-agent use (MCP stdio is single-connection).
   ```
   (Finding #5)

## Conclusion

The MCP implementation is clean, consistent, and well-tested. It follows the same patterns as the rest of the codebase and reuses shared infrastructure effectively. 100% runtime coverage on all MCP code. The tool descriptions are clear for LLM agents. No Critical or High findings.
