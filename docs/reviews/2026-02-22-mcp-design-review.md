---
generated_by: Claude Opus 4.6
generation_date: 2026-02-22
model_version: claude-opus-4-6
purpose: design_review
status: resolved
scope: [astro-inline-review, mcp-server]
tags: [mcp, architecture, design-review, agent-integration]
---

# Design Review: MCP Server Implementation

## Executive Summary

The MCP server adds agent integration to astro-inline-review via 6 tools (4 read, 2 write) over stdio transport. The implementation is ~250 lines of source across 7 files, backed by 30 tests. It reuses the existing `ReviewStorage` class, ensuring file I/O behaviour is identical to the REST API.

Overall the implementation is clean, minimal, and well-suited to purpose. The architecture decision to use stdio transport and run independently of Vite is sound. The tool interfaces are clear for LLM agents. One medium finding around the duplicated `ErrorResult` interface and one around race conditions in write tools are worth addressing.

## 1. Architecture Assessment

### stdio Transport — Correct Choice

The MCP server runs as a standalone subprocess spawned by the coding agent. This avoids coupling to Vite's lifecycle, eliminates HTTP port conflicts, and works even when the dev server isn't running (e.g., reading annotations post-review).

### Vite Separation — Clean Boundary

The MCP server (`src/mcp/server.ts`) imports only `ReviewStorage` and shared types — no Vite dependencies. The shared `ReviewStorage` class provides identical read/write behaviour, including the write queue for atomic file operations.

### Shared `generateExport` — Good Extraction

The export logic was extracted to `src/shared/export.ts` (Session 2) so both the REST API middleware and the MCP `get_export` tool produce identical markdown output. This prevents drift between the two interfaces.

### Process Model

The server is a single-process, single-connection stdio server. This matches the MCP SDK's design for agent tool servers. No connection pooling, no concurrent client concerns.

## 2. Tool Interface Quality

### Clear for LLM Agents

Each tool has:
- A descriptive name using snake_case (matching MCP convention)
- A human-readable description explaining what it does and when to use it
- Zod schemas with `.describe()` on each parameter
- Consistent JSON output format (formatted with `null, 2` for readability)

### Error Handling

Error responses use `isError: true` with descriptive messages. Non-existent IDs produce clear "not found" messages including the ID searched for, which aids agent debugging.

### Tool Granularity

The 6 tools map well to agent workflows:
1. `list_annotations` / `list_page_notes` — discover what feedback exists
2. `get_annotation` — drill into a specific annotation for detail
3. `get_export` — get a complete overview for planning
4. `resolve_annotation` — mark work as done
5. `add_agent_reply` — explain what was done

This is the right level of granularity — not too many tools to confuse the agent, not too few to require complex parameters.

## 3. Data Model Assessment

### `resolvedAt` / `replies` Approach

Adding optional fields to `BaseAnnotation` is the right approach:
- **Backwards compatible** — existing annotations without these fields remain valid
- **No migration needed** — absence means "not resolved" / "no replies"
- **Timestamp-based** — `resolvedAt` is an ISO 8601 string, consistent with `createdAt`/`updatedAt`
- **Append-only replies** — `AgentReply[]` grows chronologically, no deletion needed

### Schema Evolution

The `ReviewStore.version` field is still `1`. Since the new fields are optional and backward-compatible, a version bump isn't required. If a future change requires migration (e.g., making `resolvedAt` non-optional), the version mechanism is in place.

## 4. Code Organisation & Test Quality

### Source Structure

```
src/mcp/
  server.ts          (30 lines) — entry point, registration, transport
  tools/
    6 tool files     (216 lines total) — one file per tool
src/shared/
  types.ts           (84 lines) — canonical types including AgentReply
  export.ts          (87 lines) — shared markdown export
```

Each tool file follows an identical pattern: exported handler function + `register` function. This makes it easy to add new tools and to test handlers in isolation.

### Test Coverage

30 tests across 6 test files covering:
- Happy paths (annotations found, filtered, exported)
- Error paths (missing IDs, empty stores, empty messages)
- Persistence verification (write then read-back from disk)
- Edge cases (multiple annotations, already-resolved, append to existing replies)

Tests use real `ReviewStorage` instances with temp files rather than mocks, which verifies the full read-write path. This is appropriate given the small codebase.

## 5. Findings

| # | Severity | Category | Description | Recommendation |
|---|----------|----------|-------------|----------------|
| 1 | Medium | Code Quality | `ErrorResult` interface is duplicated in 3 tool files (get-annotation, resolve-annotation, add-agent-reply) | Extract to a shared types file alongside `ToolResult` |
| 2 | Medium | Concurrency | Write tools do read-modify-write without locking — concurrent resolve + reply on the same annotation could lose one write | Acceptable for single-agent use but document the limitation; consider a read-then-write helper if multi-agent use is planned |
| 3 | Low | Validation | `add_agent_reply` validates empty messages but `resolve_annotation` doesn't validate that the ID parameter is non-empty | Add `.min(1)` to the Zod schema for ID parameters, or rely on the "not found" error for empty strings (current behaviour) |
| 4 | Low | Interface | `ToolResult` is defined in `list-annotations.ts` and imported by other tools — slightly surprising location | Move `ToolResult` and `ErrorResult` to a shared `src/mcp/types.ts` |
| 5 | Low | Consistency | `list_annotations` and `list_page_notes` return arrays directly; other tools return single objects — agents need to handle both | Acceptable as-is; the tool descriptions make the return shape clear |
| 6 | Informational | Testing | No integration test that spawns the MCP server process and sends protocol messages | Would add confidence in the stdio transport wiring but is low priority given the handler-level test coverage |

### Addressing Findings

**Finding 1 & 4 (Medium + Low — shared types):** These can be addressed together in a future session by extracting `ToolResult` and `ErrorResult` to `src/mcp/types.ts`. Low risk of leaving as-is — it's a three-file duplication, not a correctness issue.

**Finding 2 (Medium — concurrency):** The `ReviewStorage` write queue serialises writes, but the read-modify-write cycle in each handler is not atomic — a concurrent call could read stale data before the first write completes. In practice, a single agent processes annotations sequentially, so this is unlikely to manifest. If multi-agent support is added, the handlers should use a compare-and-swap or read-lock pattern. For now, documenting the single-agent assumption is sufficient.

**Findings 3, 5, 6:** Low priority. Current behaviour is correct and the trade-offs are reasonable.
