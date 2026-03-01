---
generated_by: Claude Opus 4.6
generation_date: 2026-02-26
model_version: claude-opus-4-6
purpose: engineering_plan
status: complete
human_reviewer: matthewvivian
tags: [auto-refresh, polling, mcp, panel, store-poller]
---

# Auto-Refresh Annotations Panel When MCP Agent Makes Changes

**Issue**: [#15](https://github.com/viv/review-loop/issues/15)

## Problem

When an LLM agent connected via MCP resolves or updates an annotation, the browser panel does not automatically reflect those changes. The reviewer must close and reopen the panel to see the updated state.

## Approach Decision: Polling with Lightweight Version Endpoint

Three approaches were considered:

| Approach | Pros | Cons |
|----------|------|------|
| **Polling** | Simple, reliable, no persistent connections | Latency (up to poll interval), unnecessary network traffic |
| **SSE** | Instant updates, push-based | Complex connection management, reconnection logic, more middleware surface |
| **Timestamp header** | Lightweight checks via `If-Modified-Since` / ETag | Still requires polling, more HTTP semantics to manage |

**Decision**: Polling with a dedicated lightweight `/version` endpoint.

**Rationale**:
- The store poller already exists and works. The optimisation is adding a lightweight fingerprint endpoint so polls don't transfer full annotation payloads.
- 2-second polling latency is acceptable for a dev tool — the reviewer won't notice a sub-2s delay.
- SSE would require persistent connection management, reconnection on page transitions, and more complex middleware — overkill for this use case.
- The timestamp header approach is conceptually similar to our version endpoint but adds HTTP caching semantics that complicate the implementation without meaningful benefit.

## Architecture

### Server-Side: Version Endpoint

A new `GET /__inline-review/api/version` endpoint returns a lightweight fingerprint:

```json
{ "fingerprint": "5:2026-02-26T10:30:00.000Z" }
```

The fingerprint is `<totalCount>:<latestUpdatedAt>` computed from ALL annotations and page notes (not page-filtered). Any mutation — create, update, delete, status change — modifies either the count or the latest `updatedAt`, changing the fingerprint.

### Client-Side: Optimised Poller

The existing `createStorePoller` is updated to:
1. Fetch the `/version` endpoint (tiny payload) instead of the full store
2. Compare the server-computed fingerprint with the last known value
3. When changed, fire `onStoreChanged` — the callback handles the heavier work

### Client-Side: Panel-Aware Refresh

The `onStoreChanged` callback in `index.ts` is updated to:
1. **Always** call `restoreHighlights()` — keeps DOM highlights current regardless of panel state
2. **Only** call `mediator.refreshPanel()` when the panel is open — avoids unnecessary DOM work for an invisible panel

When the panel is opened (via `togglePanel()`), it already fetches fresh data. So changes that occurred while the panel was closed are picked up on open.

### API Client Extension

A new `api.getVersion()` method is added to `src/client/api.ts` to fetch the version endpoint.

## Changes

### Server

| File | Change |
|------|--------|
| `src/server/middleware.ts` | Add `GET /version` route returning computed fingerprint |
| `tests/server/middleware.test.ts` | Tests for the version endpoint |

### Client

| File | Change |
|------|--------|
| `src/client/api.ts` | Add `getVersion()` method |
| `src/client/store-poller.ts` | Use `/version` endpoint instead of full store fetch |
| `src/client/index.ts` | Make `refreshPanel()` call conditional on panel open state |
| `tests/client/store-poller.test.ts` | Update tests for new fetch behaviour |
| `tests/client/panel-refresh.test.ts` | New: test panel-awareness (refresh when open, skip when closed) |

### Documentation

| File | Change |
|------|--------|
| `docs/spec/specification.md` | Add section on auto-refresh mechanism |
| `docs/engineering-plans/2026-02-26-auto-refresh-panel.md` | This plan |
| `docs/reviews/2026-02-26-auto-refresh-panel-review.md` | Independent code review |

## Session Plan

### Session 1: Implementation (current)

1. Create engineering plan
2. Implement server-side version endpoint with tests
3. Update client-side poller and add panel-awareness
4. Update client-side tests
5. Update specification document
6. Conduct independent review
7. Address review findings
8. Create PR
