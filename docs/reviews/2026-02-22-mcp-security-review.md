---
generated_by: Claude Opus 4.6
generation_date: 2026-02-22
model_version: claude-opus-4-6
purpose: security_review
status: resolved
scope: [review-loop, mcp-server]
tags: [security, mcp, agent-integration, code-review]
---

# Security Review: MCP Server

## Executive Summary

The MCP server adds agent integration to review-loop via 6 tools (4 read, 2 write) over stdio transport. The implementation is ~280 lines of source across 8 files (`server.ts`, `types.ts`, and 6 tool files), backed by 45 tests (35 unit + 10 integration). It reuses the existing `ReviewStorage` class for all file I/O.

The security posture is good. The stdio transport constrains the attack surface to the local machine — there is no network listener, no HTTP port, and no authentication surface. Input validation uses Zod schemas at the MCP SDK layer. The main concern is the `--storage` CLI argument which accepts arbitrary file paths, but this is consistent with the trust model established for the REST API's `storagePath` option (developer-controlled configuration).

Two new runtime dependencies (`@modelcontextprotocol/sdk`, `zod`) increase the supply chain surface compared to the previously zero-dependency package. This is an accepted trade-off documented below.

## Findings Table

| # | Severity | Category | Description | Recommendation |
|---|----------|----------|-------------|----------------|
| 1 | Low | Path Traversal | `--storage` CLI arg accepts arbitrary file paths via `resolve()` | Acceptable — same trust model as REST API's `storagePath` option |
| 2 | Low | Data Integrity | Read-modify-write in write tools is not atomic | Acceptable for single-agent use; document the limitation |
| 3 | Low | Supply Chain | Two new runtime dependencies added | Acceptable — both are widely-used, well-maintained packages |
| 4 | Low | Input Validation | `message` param in `add_agent_reply` has no `.min(1)` on Zod schema | Empty strings caught by handler logic; Zod check would be more consistent |
| 5 | Informational | Information Disclosure | Error messages include the searched ID | Helpful for agent debugging; no sensitive data exposed |
| 6 | Informational | DoS | No limit on annotation store size read into memory | Constrained by local file system; not externally exploitable |

## Detailed Findings

### 1. Storage Path Accepts Arbitrary File Paths (Low)

**Location:** `src/mcp/server.ts` lines 12-17

```typescript
export function parseStoragePath(argv: string[]): string {
  const idx = argv.indexOf('--storage');
  const value = idx !== -1 && idx + 1 < argv.length ? argv[idx + 1] : undefined;
  const raw = value ?? './inline-review.json';
  return resolve(process.cwd(), raw);
}
```

The `--storage` argument is resolved against `process.cwd()` with no path restriction. An argument like `--storage /etc/passwd` would attempt to read that file as JSON (and fail gracefully, returning an empty store). An argument like `--storage /tmp/evil.json` would write annotation data to an arbitrary location.

However, this argument is provided via `.mcp.json` configuration or direct CLI invocation — both controlled by the developer who installed the package. This is the same trust model as the REST API's `storagePath` option (Finding 4 of the original security review). The `ReviewStorage` class always writes valid JSON, so even a misconfigured path cannot corrupt non-JSON files in a dangerous way (the entire file content is replaced with JSON).

**Assessment:** Acceptable. Same trust level as `astro.config.mjs`. The developer who configures `.mcp.json` controls the storage path.

### 2. Non-Atomic Read-Modify-Write in Write Tools (Low)

**Location:** `src/mcp/tools/resolve-annotation.ts` lines 10-24, `src/mcp/tools/add-agent-reply.ts` lines 16-35

Both write tools follow a read-modify-write pattern:

1. `storage.read()` — reads file from disk
2. Mutate the in-memory object
3. `storage.write(store)` — writes back to disk

The `ReviewStorage.write()` method serialises writes through a promise queue, preventing two writes from interleaving. However, if two concurrent tool calls both read before either writes, the second write will overwrite the first's changes.

In practice, MCP servers handle one tool call at a time (single stdio connection, sequential message processing). The MCP SDK's `StdioServerTransport` processes messages from stdin sequentially. A race condition would require two separate processes writing to the same JSON file simultaneously, which is outside the scope of this tool.

**Assessment:** Acceptable for single-agent, single-process use. The design review (Finding 2) documents this assumption. If multi-agent support is added, a compare-and-swap pattern should be introduced.

### 3. New Runtime Dependencies (Low)

**Location:** `package.json` lines 59-62

```json
"dependencies": {
  "@modelcontextprotocol/sdk": "^1.26.0",
  "zod": "^3.25.76"
}
```

The original security review noted zero runtime dependencies as a positive security attribute. The MCP server adds two:

- **`@modelcontextprotocol/sdk`** — Official MCP SDK maintained by Anthropic. Well-maintained, widely-used in the MCP ecosystem. The `^1.26.0` range pins to the v1.x major version.
- **`zod`** — Standard schema validation library with 30M+ weekly npm downloads. Used by the MCP SDK itself for parameter validation.

Both are well-maintained, widely-used packages with active security processes. The `^` ranges follow npm's recommended versioning.

**Assessment:** Acceptable trade-off. These dependencies are necessary for MCP support and are high-quality packages. Consumers who do not use the MCP server will still pull these dependencies via `npm install`, but they add no runtime code to the Astro integration path (only the MCP entry point imports them).

**Note for consumers:** The MCP dependencies are loaded only when running the MCP server process (`dist/mcp/server.js`). The Astro integration entry point (`dist/index.js`) does not import them. Tree-shaking is not relevant here since these are separate entry points, but the dependencies are not part of the browser bundle (`dist/client.js`) either.

### 4. Missing `.min(1)` on `message` Zod Schema (Low)

**Location:** `src/mcp/tools/add-agent-reply.ts` line 48

```typescript
message: z.string().describe('The reply message explaining what was done'),
```

The `id` parameters across all tools now have `.min(1)` validation (added in the design review fix-up). The `message` parameter in `add_agent_reply` does not have `.min(1)`, though the handler does check for empty/whitespace messages:

```typescript
if (!params.message.trim()) {
  return { isError: true, content: [...] };
}
```

This is a minor inconsistency — the handler catches the case, but the Zod schema doesn't express the constraint. The handler's check is actually stricter (it rejects whitespace-only strings), so the Zod `.min(1)` would be redundant for empty strings but wouldn't cover whitespace-only.

**Assessment:** Acceptable as-is. The handler logic is correct and stricter than what Zod `.min(1)` would provide.

### 5. Error Messages Include Search Parameters (Informational)

**Location:** `src/mcp/tools/get-annotation.ts` line 16, `resolve-annotation.ts` line 16, `add-agent-reply.ts` line 22

```typescript
content: [{ type: 'text', text: `Annotation with ID "${params.id}" not found` }],
```

Error responses echo back the searched ID. Over stdio transport to a local agent, this is helpful for debugging (the agent can see which ID it searched for). Unlike the REST API (Finding 5 of the original review), there is no network boundary where information disclosure would be a concern — the only consumer is the agent process that provided the ID.

**Assessment:** Good practice for agent-facing tools. No action needed.

### 6. No Store Size Limit (Informational)

**Location:** `src/server/storage.ts` lines 21-48

The `ReviewStorage.read()` method reads the entire JSON file into memory and parses it. A very large `inline-review.json` (e.g., millions of annotations) would consume significant memory. However:

- The file is local and written only by the ReviewStorage class (or the developer manually)
- There is no external API that allows unbounded growth — the MCP server only adds small `resolvedAt` timestamps and reply objects
- The REST API's body size limit (1 MB, from the original security review fix) constrains individual write sizes

**Assessment:** Not a practical concern. The file grows proportionally to the number of annotations, which is bounded by human reviewer activity.

## Transport Security

### stdio Properties

The MCP server uses `StdioServerTransport` — communication occurs over the process's stdin/stdout file descriptors:

- **No network listener:** No TCP/UDP port, no HTTP server, no WebSocket. The server is not reachable over the network.
- **No authentication needed:** The parent process (the coding agent) spawns the server as a child process. Access control is inherited from the OS process model — only the parent can write to the child's stdin.
- **No TLS needed:** Communication is via pipe, not network. Data never leaves the machine.
- **Process isolation:** The MCP server runs in its own Node.js process with standard OS-level isolation. It has the same file system permissions as the parent process.

This is the most secure transport option for local agent integration. SSE (the alternative MCP transport) would require an HTTP server with CORS, authentication, and network exposure concerns.

## Dependency Audit

### @modelcontextprotocol/sdk ^1.26.0

- **Publisher:** Anthropic (modelcontextprotocol npm org)
- **Used for:** MCP server framework, stdio transport, tool registration
- **Transitive deps:** Brings in `zod`, `content-type`, `raw-body`, `eventsource`, `pkce-challenge`, `zod-to-json-schema`
- **Assessment:** Well-maintained, official SDK. The SSE-related transitive deps (`eventsource`, `raw-body`, `content-type`) are loaded but not used by the stdio transport. No known vulnerabilities.

### zod ^3.25.76

- **Publisher:** Colin McDonnell
- **Used for:** Zod schemas for tool parameter validation
- **Transitive deps:** None (zero-dependency package)
- **Assessment:** Industry-standard validation library. 30M+ weekly downloads. No known vulnerabilities.

### npm audit

```
$ npm audit
found 0 vulnerabilities
```

## Comparison with REST API Security Review

| Concern | REST API | MCP Server |
|---------|----------|------------|
| Transport | HTTP on localhost (Vite dev middleware) | stdio (child process pipes) |
| Authentication | None (localhost assumed trusted) | None (OS process model) |
| Body size limit | 1 MB (fixed in review round 2) | N/A — Zod validates params; no raw body parsing |
| Field injection | Fixed with allowlist (review round 2) | N/A — tools have explicit parameter schemas |
| Path traversal | `storagePath` in astro.config.mjs | `--storage` CLI arg — same trust model |
| Information disclosure | Error messages forwarded to client | Error messages include search params — appropriate for agent |
| Concurrency | Write queue serialises writes | Same write queue; single-agent assumption |
| Dependencies | Zero runtime | Two runtime (`@modelcontextprotocol/sdk`, `zod`) |

The MCP server has a smaller attack surface than the REST API because stdio eliminates all network-related concerns (CORS, body parsing, HTTP method handling). The Zod-based parameter validation is more structured than the REST API's manual JSON parsing.

## Positive Observations

1. **stdio transport eliminates network attack surface.** No ports, no CORS, no authentication complexity.
2. **Zod schema validation.** All tool parameters are validated by Zod schemas before reaching handler code. The `.min(1)` constraint on ID parameters was added in the design review fix-up.
3. **Shared ReviewStorage.** The MCP server reuses the same storage class as the REST API, inheriting its write queue serialisation and schema validation on read.
4. **Read-only by default.** Four of six tools are read-only. Only `resolve_annotation` and `add_agent_reply` write to disk, and both are append-only operations (setting a timestamp, adding a reply).
5. **No `eval()`, no `Function()`, no dynamic code execution.** All code paths are static.
6. **Graceful error handling.** All tools return structured error responses with `isError: true` rather than throwing exceptions that could crash the server.
7. **Process separation.** The MCP server runs in its own Node.js process, isolated from Vite's dev server. A crash in the MCP server does not affect the dev server or vice versa.

## Recommendations

### No Critical or High Findings

No code changes are required. All findings are Low or Informational severity.

### Nice to Have

1. **Add `.min(1)` to `message` Zod schema** in `add-agent-reply.ts` for consistency with the ID parameter validation pattern. The handler already catches empty messages, so this is purely for schema-level documentation. (Finding #4)

2. **Document the single-agent assumption** in a code comment in the write tool files, noting that concurrent writes from multiple processes could lose data. (Finding #2)

## Conclusion

The MCP server has a strong security posture for a local dev tool. The stdio transport eliminates the largest class of potential vulnerabilities (network exposure, authentication, CORS). Input validation via Zod schemas is appropriate and well-implemented. The two new runtime dependencies are justified and well-maintained. No Critical or High findings were identified.

## Resolution

| # | Finding | Action |
|---|---------|--------|
| 1 | Path traversal via `--storage` | **No action.** Same trust model as REST API `storagePath`. |
| 2 | Non-atomic read-modify-write | **No action.** Documented as single-agent assumption. |
| 3 | New runtime dependencies | **No action.** Accepted trade-off for MCP support. |
| 4 | Missing `.min(1)` on `message` | **No action.** Handler logic is stricter than Zod check would be. |
| 5 | Error messages include IDs | **No action.** Helpful for agent debugging, no network exposure. |
| 6 | No store size limit | **No action.** Bounded by human reviewer activity. |
