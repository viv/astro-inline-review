---
generated_by: Claude Opus 4.6
generation_date: 2026-02-24
model_version: claude-opus-4-6
purpose: product_idea
status: draft
human_reviewer: matthewvivian
tags: [idea, remote-mcp, uat, annotation, new-project]
---

# Idea: Remote Annotation Tool for UAT / Pre-Production Sites

## Origin

review-loop is a dev-only tool: reviewers annotate during `astro dev`, and coding agents consume annotations via MCP. The question arose — what if non-developers (product owners, QA, stakeholders) could annotate a deployed UAT or staging site, and those annotations flowed directly to a developer's coding agent?

This document captures the idea, architectural considerations, and open questions. **This would be a separate product**, not a mode of review-loop. The dev-only tool stays focused on the developer-agent feedback loop.

## The Vision

1. A development team deploys a site to a UAT/staging environment
2. The deployed site includes an annotation overlay (no browser extension, no install — just visit the URL)
3. Reviewers annotate directly in-browser: select text, click elements, leave comments
4. Annotations are stored server-side and exposed via a remote MCP server
5. A developer's coding agent (Claude Code, Cursor, etc.) connects to the remote MCP server and acts on the feedback

The feedback loop becomes: reviewer annotates staging site → agent reads annotations via MCP → agent makes code changes → new staging deploy → reviewer verifies.

## Why This Is a Separate Product

review-loop has a clear identity: dev-only, ships zero bytes in production, single-developer workflow. Extending it to deployed environments would:

- Dilute the "zero bytes in production" promise
- Add operational complexity (auth, persistent services, multi-user concurrency)
- Require framework independence (reviewers might be annotating Next.js, plain HTML, anything)
- Shift from "npm package" to "deployable service"

The two tools share principles (annotation data model, MCP integration, agent-consumable feedback) but have fundamentally different deployment models.

## Architecture Overview

### Components

1. **Annotation client** — browser-based UI (shadow DOM overlay) injected into the deployed site via a `<script>` tag. No browser extension; no install required for reviewers. The development team adds the script as part of their staging deployment.

2. **Annotation server** — standalone HTTP service that provides:
   - REST API for the client (CRUD operations on annotations)
   - Remote MCP server (HTTP+SSE or Streamable HTTP transport) for agent access
   - Storage backend

3. **MCP client** — the developer's coding agent connects to the remote MCP server over the network

### Client Injection

The client should be deployable via a single script tag:

```html
<script src="https://annotations.example.com/client.js" data-api="https://annotations.example.com/api"></script>
```

This means:
- No framework coupling — works with any site (Astro, Next.js, plain HTML, etc.)
- Configurable API base URL (not hardcoded like the current tool)
- The development team controls when and where annotations are enabled
- No install friction for reviewers — just visit the URL

### Authentication and Access Control

**Design decision: no user identification within the tool.**

The tool does not authenticate individual reviewers. If you can access the site, you can annotate. This keeps the tool simple and avoids the UX problem of credential distribution to non-technical reviewers.

Security is handled at the infrastructure level:
- The staging site is behind existing access controls (VPN, basic auth, SSO, IP allowlisting — whatever the team already uses)
- The annotation API inherits the same access boundary as the staging site
- The annotation server should be co-located with or behind the same access controls as the staging site

This means:
- No login screen in the annotation UI
- No API keys for reviewers
- No user management
- Annotations are anonymous (or optionally include a self-reported name, like a wiki)

**MCP authentication is separate** — the remote MCP server needs auth for agent connections (developers' machines connecting over the network). The MCP specification defines OAuth 2.1 with PKCE for this purpose. This is developer-facing auth, not reviewer-facing, so the UX burden is acceptable.

### Remote MCP

The MCP server runs as a persistent HTTP service alongside the annotation server, using the MCP SDK's HTTP+SSE or Streamable HTTP transport.

Key requirements:
- TLS (the MCP connection traverses the network)
- OAuth 2.1 authentication per the MCP specification
- The same tool surface as the current MCP server (list annotations, get annotation, resolve, reply, etc.)
- Potentially additional tools for remote-specific operations (e.g., "list annotations by page", "get annotations since last check")

The developer's MCP client (Claude Code, Cursor) connects to the remote server by URL, authenticates, and has full access to the annotation data.

### Storage

**JSON file storage is viable for single-process deployments.** The write-queue pattern (serialising writes within a single Node.js process) handles concurrent submissions from multiple reviewers safely, as long as there is only one server process.

The corruption risk exists only with horizontal scaling (multiple server processes writing to the same file). For a UAT annotation tool, a single process is realistic — this is not a high-traffic service.

**If scaling beyond single-process becomes necessary**, SQLite would be the natural step up: still file-based, proper concurrent access, no external service dependency. But this should be deferred unless there is a demonstrated need.

**Storage interface abstraction** — regardless of backend, the storage layer should be behind an interface from the start. This makes the backend swappable without changing consumers. The current `ReviewStorage` class could inform the interface design.

### Running in Non-Dev Mode

For the annotation client to appear on a deployed (built) site, the architecture changes fundamentally from the dev-only model:

- **Dev-only model**: Vite dev server plugin → middleware handles API → injectScript adds client
- **Deployed model**: Standalone server handles API → client loaded via external script tag

This is another reason for a separate product — the deployment model is entirely different. The annotation server is a standalone service, not a framework plugin.

For Astro SSR sites specifically, an integration could register the API as SSR routes and inject the client script. But the standalone server approach is more universal.

## What Can Be Shared with review-loop

Despite being a separate product, significant code and design can be shared:

- **Annotation data model** — the schema (types, ranges, selectors, status lifecycle) is directly reusable
- **MCP tool definitions** — the tool surface (list, get, resolve, reply, update target) is identical
- **Client UI components** — the shadow DOM overlay, highlight rendering, popup, panel could be extracted into a shared package
- **Storage logic** — the JSON file I/O, atomic writes, and data validation
- **Markdown export** — the export format for sharing annotations outside MCP

A monorepo or shared-packages approach could avoid duplication whilst keeping the products independent.

## Open Questions

1. **Annotation durability across deployments** — when a new version is deployed to staging, content changes. How do annotations survive? Options:
   - Annotations reference content by text + context (the current `range` model with `contextBefore`/`contextAfter`), which enables fuzzy re-anchoring
   - Annotations are tied to a deployment version and archived when a new version deploys
   - Some hybrid — attempt re-anchoring, mark as orphaned if it fails (the current `replacedText` model)

2. **Multi-page annotation vs. single-page** — the current tool stores `pageUrl` per annotation. For a deployed site, pages might have different URLs across deployments (e.g., preview URLs with hashes). How to handle URL instability?

3. **Notification flow** — when a reviewer creates an annotation, should the developer be notified? Options:
   - Polling (agent periodically checks via MCP)
   - Webhook to a chat tool (Slack, Teams)
   - Email digest
   - Real-time via MCP subscription (if the MCP spec supports it)

4. **Scope of "site"** — does the annotation server serve one site or multiple? Multi-tenancy adds complexity but might be necessary for teams with multiple staging environments.

5. **Self-hosted vs. hosted service** — is this a tool teams self-host (like the current npm package model) or a hosted service? Self-hosted is simpler to start with and avoids data sovereignty concerns.

6. **Relationship to existing tools** — Marker.io, BugHerd, Pastel, and similar tools solve the "annotate a website" problem for project management. The differentiator here is that the consumer is a coding agent, not a project manager. But the reviewer-facing UI is competing with polished existing products. Is the MCP-agent integration enough differentiation?

7. **Framework-specific integrations** — should there be optional framework integrations (Astro, Next.js, Nuxt, etc.) that auto-inject the client script and co-locate the API, alongside the standalone server option?

## Competitive Landscape

Existing website annotation tools target human workflows:
- **Marker.io** — captures screenshots, creates Jira/Trello/etc. tickets
- **BugHerd** — visual feedback pinned to elements, kanban board
- **Pastel** — collaborative website review with comments

None of these target coding agents as the annotation consumer. The MCP integration — where annotations flow directly into an agent's tool context — is the novel angle.

## Potential Names

(Just brainstorming, no decisions)
- inline-review (dropping the astro- prefix for framework independence)
- review-bridge
- annotate-mcp
- site-review

## Next Steps

This is an idea, not a commitment. To progress:

1. Validate the workflow — does the reviewer-to-agent loop via MCP actually change how feedback is handled? Could test this manually with the existing tool's markdown export.
2. Assess MCP remote auth maturity — can Claude Code (and other clients) actually connect to a remote MCP server with OAuth today?
3. Prototype the standalone annotation server — extract the middleware and storage from review-loop into a standalone Express app.
4. Prototype the client as an external script — extract the shadow DOM UI and make it configurable (API base URL, no Astro dependency).