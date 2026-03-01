---
generated_by: Claude Opus 4.6
generation_date: 2026-02-22
model_version: claude-opus-4-6
purpose: implementation_plan
status: implemented
human_reviewer: matthewvivian
implementation_tracking: completed
notes: |
  Approach A (direct JSON file access) implemented — CLAUDE.md documents inline-review.json schema.
  Approach B (MCP server) implemented — 6 tools over stdio, .mcp.json auto-discovery, CLI args.
  See: docs/engineering-plans/2026-02-22-mcp-server.md for full implementation plan.
  Approach C (REST API from agent) available as-is — REST API already documented in CLAUDE.md.
  Approach D (file watcher) deferred — superseded by MCP.
tags: [mcp, agent-integration, json, real-time, developer-experience, architecture]
---

# Bridging the Running Component and the Coding Agent

## Problem

There is a disconnect between the reviewer annotating in the browser and the coding agent working in the terminal. Today, the workflow is:

1. Reviewer annotates the site in the browser
2. Reviewer clicks "Copy" to export markdown
3. Reviewer pastes markdown into the coding agent
4. Agent makes changes
5. Reviewer refreshes the browser to see the result
6. Repeat

Steps 2-3 are manual friction. Step 5 requires the reviewer to notice changes. There's no live feedback loop — the agent can't see what the reviewer is annotating in real time, and the reviewer can't see what the agent is doing without manually checking.

## Goal

Create a tighter feedback loop where the coding agent can read review annotations directly (without copy-paste) and ideally react to new annotations as they appear.

## Approaches

### Approach A: Direct JSON file access (simplest)

**How it works:** The coding agent reads `inline-review.json` directly from the filesystem.

**Pros:**
- Zero additional infrastructure — the JSON file already exists and is always up to date
- Any coding agent (Claude Code, Cursor, Copilot, etc.) can read a file
- Already designed for this: storage reads always from disk, no caching, external edits picked up immediately
- Works right now with no code changes (agent just reads the file)

**Cons:**
- Agent needs to know the file path (documented convention, or discovered via config)
- No push notification — agent must poll or be told to re-read
- Raw JSON is less readable than the markdown export for humans reviewing the agent's context

**What to build:**
- A CLAUDE.md snippet or project rule that tells the agent about `inline-review.json` and its schema
- An optional `--print-store-path` CLI flag or a well-known path convention
- A small "agent instructions" markdown file generated alongside the JSON, explaining the schema

### Approach B: MCP server (richest integration)

**How it works:** The Astro integration spins up an MCP (Model Context Protocol) server alongside the Vite dev server. The coding agent connects to it as an MCP tool provider.

**Possible MCP tools:**
- `list_annotations` — returns all annotations (with optional page filter)
- `list_page_notes` — returns all page notes
- `get_annotation` — returns a single annotation by ID
- `resolve_annotation` — marks an annotation as addressed (could add a `resolved` status)
- `add_agent_note` — lets the agent add a note back to an annotation (bidirectional!)
- `get_export` — returns the markdown export
- `watch_annotations` — subscribe to new/changed annotations (if MCP supports streaming/notifications)

**Pros:**
- Native integration with Claude Code and other MCP-aware agents
- Structured, typed tool interface — the agent knows exactly what operations are available
- Bidirectional: agent can write back (resolve, comment) not just read
- Could support real-time notifications when new annotations appear
- Schema self-documenting via MCP tool descriptions

**Cons:**
- Requires MCP client support in the agent (Claude Code has this; others may not)
- More code to build and maintain
- MCP server lifecycle management (start/stop alongside Astro dev)
- Testing is harder (need to test MCP protocol compliance)

**Architecture sketch:**
```
┌─────────────┐     HTTP API      ┌──────────────┐
│   Browser    │ ←──────────────→ │  Vite/Astro   │
│  (reviewer)  │                  │  Dev Server   │
└─────────────┘                  │               │
                                  │  ReviewStorage │ ←→ inline-review.json
                                  │               │
┌─────────────┐   MCP protocol   │  MCP Server    │
│ Coding Agent │ ←──────────────→ │  (stdio/SSE)  │
│ (Claude Code)│                  └──────────────┘
└─────────────┘
```

The MCP server would share the same `ReviewStorage` instance as the REST API middleware, so both the browser and the agent see the same data with no sync issues.

**Implementation notes:**
- Use the `@modelcontextprotocol/sdk` package for the MCP server
- Transport: `stdio` is simplest for local dev (agent launches the server as a subprocess)
- Alternative transport: `SSE` over HTTP, which could reuse the existing Vite server
- The MCP server config would be written to `.claude/mcp.json` or similar for auto-discovery

### Approach C: REST API from the agent (middle ground)

**How it works:** The coding agent calls the existing `/__inline-review/api/*` REST endpoints directly via `curl` or `fetch`.

**Pros:**
- API already exists — no new server code needed
- Works with any agent that can make HTTP requests
- Bidirectional (agent can POST/PATCH/DELETE via existing endpoints)

**Cons:**
- Requires the Astro dev server to be running (it should be, but it's a dependency)
- Agent needs to know the dev server URL (typically `http://localhost:4321`)
- Less discoverable than MCP — agent needs explicit instructions about the API
- No push notifications (polling only)

**What to build:**
- Documentation/instructions for agents on the REST API shape
- A CLAUDE.md snippet that tells the agent how to use the API
- Optionally, a small CLI wrapper script that makes common API calls easy

### Approach D: File watcher + agent notification (push-based)

**How it works:** A file watcher monitors `inline-review.json` for changes and notifies the agent when annotations change.

**Possible mechanisms:**
- Write a summary file (e.g., `inline-review-latest.md`) on every change, which the agent can watch
- Use `fsnotify`-style events if the agent supports file watching
- Touch a sentinel file that triggers an agent hook

**Pros:**
- Push-based — agent doesn't need to poll
- Simple conceptually

**Cons:**
- Agent-side file watching support varies
- Adds complexity without the structured interface of MCP
- Mostly superseded by Approach B (MCP with notifications)

## Recommendation

**Start with Approach A (direct JSON file access), then build towards Approach B (MCP server).**

Reasoning:
1. **Approach A costs nothing** — it works today with just documentation. Write the CLAUDE.md instructions and the agent can immediately read `inline-review.json`. This unblocks the workflow now.
2. **Approach B is the proper long-term solution** — MCP gives structured, discoverable, bidirectional integration. But it's a bigger piece of work and should be designed carefully.
3. **Approach C is a fallback** — if MCP proves too complex or the agent ecosystem doesn't support it well enough, the REST API is already there. Just needs documentation.
4. **Approach D isn't worth building independently** — MCP notifications subsume this.

## Implementation sessions

### Session 1: Document the JSON file for agents (Approach A)

- Add a section to the project CLAUDE.md explaining `inline-review.json` location and schema
- Create a small reference doc (`docs/agent-integration.md`) with the schema, example data, and suggested prompts
- Add a `storagePath` getter or log message so the agent can discover the file path
- This session alone makes the agent-bridge workflow viable

### Session 2: Design the MCP server interface (Approach B — design only)

- Define the MCP tool set (names, parameters, return types)
- Decide on transport (stdio vs SSE)
- Decide on lifecycle (does the integration auto-start it? separate command?)
- Write the MCP server specification as a doc
- Decide on the `resolve` / `agent_note` data model additions

### Session 3: Implement MCP server core

- Add `@modelcontextprotocol/sdk` dependency
- Implement the MCP server with `list_annotations`, `get_annotation`, `list_page_notes`, `get_export` tools
- Share `ReviewStorage` instance with existing middleware
- Write unit tests for each tool

### Session 4: Implement bidirectional MCP tools

- Add `resolve_annotation` tool (needs a `resolvedAt` / `resolvedBy` field on annotations)
- Add `add_agent_note` tool (needs a `replies` array or similar on annotations)
- Update the browser UI to show resolved state and agent replies
- This is where it gets genuinely powerful — the agent can mark work as done

### Session 5: MCP auto-discovery and lifecycle

- Auto-generate `.claude/mcp.json` when the integration activates
- Clean up the config when `astro dev` stops
- Document setup for other MCP-aware agents
- End-to-end testing of the full workflow

## Open questions

- Should the MCP server be a separate package (`review-loop-mcp`) or part of the main integration?
- What's the right transport for local dev — stdio (simpler) or SSE (reuses Vite's HTTP server)?
- Should `resolve_annotation` actually delete the annotation or just mark it? (Marking is safer — preserves history)
- Do we need annotation categories/priorities, or is that over-engineering for now?
- Should the agent be able to create annotations (e.g., "I changed this, please review")? That would make the flow truly bidirectional.
