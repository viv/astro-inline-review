---
generated_by: Claude Opus 4.6
generation_date: 2026-02-28
model_version: claude-opus-4-6
purpose: api_review
status: draft
human_reviewer: matthewvivian
tags: [rest-api, mcp, state-machine, annotation-status, workflow, review]
---

# API & Annotation State Machine Review

A comprehensive assessment of the REST API, MCP API, and annotation status lifecycle for accuracy, clarity, ease of use, and coherence.

## Executive Summary

The APIs are functional and well-tested, but the review uncovered several design concerns that affect clarity and correctness:

1. **The `resolve_annotation` MCP tool name is misleading** — its default action is to mark as *addressed*, not *resolved*. This is the single biggest source of confusion in the entire API surface.
2. **The annotation state machine is not enforced** — any state can transition to any other state via the REST API, undermining the documented lifecycle.
3. **REST API response shapes are inconsistent** — `GET /annotations` returns the full store, while `POST`/`PATCH` return individual annotations.
4. **Accept = permanent deletion** is an unusual and irreversible pattern that removes audit trails.
5. **The `addressed` state's purpose is vague** — it signals "the agent did something" but doesn't require actual evidence of action.

The sections below provide detailed findings organised by area, each with a severity rating and recommendation.


## Part 1: REST API Review

### 1.1 GET /annotations Returns Full Store (Medium — Clarity)

**Finding**: `GET /annotations` returns the full `ReviewStore` shape:
```json
{ "version": 1, "annotations": [...], "pageNotes": [...] }
```

This endpoint is named `/annotations` but returns page notes too. The specification acknowledges this as intentional (client caches everything from one request), but it means the URL doesn't describe what it returns.

**Impact**: A developer hitting `GET /annotations` for the first time would not expect to also receive page notes. Similarly, `GET /page-notes` returns the full store including annotations.

**Recommendation**: Consider one of:
- (a) **Add a `GET /store` endpoint** that returns the full shape, and make `GET /annotations` return just the annotations array. This is the cleanest semantically.
- (b) **Document the current behaviour prominently** in the API reference and add a comment in `CLAUDE.md`. (This is already partially done in the specification but not in the CLAUDE.md API table.)
- (c) **Accept the status quo** — this is a dev tool with one client, and the client relies on this behaviour. It works, even if the naming is imprecise.

### 1.2 Inconsistent Response Shapes (Medium — Ease of Use)

**Finding**: The annotation endpoints return different shapes depending on the method:

| Endpoint | Response Shape |
|----------|---------------|
| `GET /annotations` | Full store: `{ version, annotations[], pageNotes[] }` |
| `POST /annotations` | Single annotation object |
| `PATCH /annotations/:id` | Single annotation object |
| `DELETE /annotations/:id` | `{ ok: true }` |

An API consumer must know which shape to expect per method. The `GET` returning a store while `POST`/`PATCH` return individual annotations is surprising.

**Recommendation**: This is a pragmatic trade-off for a single-client tool. If the API were to be formalised, standardising on enveloped responses (e.g. `{ data: ... }`) would help. For now, document the differences clearly.

### 1.3 New Annotations Have No Explicit Status (Low — Correctness)

**Finding**: `POST /annotations` does not set `status: 'open'` on the created annotation. The annotation is stored without a `status` field, relying on `getAnnotationStatus()` to derive `'open'` from the absence of the field.

This means the JSON file contains annotations where some have `"status": "addressed"` and others have no `status` field at all. An external consumer parsing the JSON file directly (not using `getAnnotationStatus()`) would need to know this convention.

**Recommendation**: Set `status: 'open'` explicitly on creation in `middleware.ts`. This makes the data self-describing without requiring knowledge of the backward compatibility logic. The `getAnnotationStatus()` helper would still be needed for truly legacy data, but all new annotations would be explicit.

### 1.4 PATCH Doesn't Enforce State Transitions (High — Correctness)

**Finding**: The REST API accepts any valid status value on PATCH, with no regard for the current state:

```
PATCH /annotations/:id { "status": "resolved" }  // from open — skips addressed
PATCH /annotations/:id { "status": "open" }       // from addressed — allowed
PATCH /annotations/:id { "status": "addressed" }  // from resolved — allowed
```

The documented lifecycle is `open → addressed → resolved` with a reopen path from `resolved → open`, but the API doesn't enforce this. Any consumer can move an annotation to any state.

**Impact**: The state machine documented in the specification is aspirational rather than enforced. This creates a divergence between what the documentation says and what the system allows.

**Recommendation**: Either:
- (a) **Enforce transitions**: Add validation that checks the current status before allowing a change. Define the allowed transitions explicitly (e.g. `open → addressed`, `open → resolved`, `addressed → resolved`, `resolved → open`, `addressed → open`).
- (b) **Document that transitions are not enforced**: Update the specification to state that the lifecycle diagram is a recommended workflow, not a constraint. This is the simpler option if strict enforcement adds more complexity than value.

### 1.5 PATCH Allows `reply` Without Documentation in CLAUDE.md (Low — Documentation)

**Finding**: The `PATCH /annotations/:id` endpoint accepts a `reply: { message: string }` field to append reviewer replies. This is documented in the specification (section 3.2.1a) but not in the CLAUDE.md REST API table.

The CLAUDE.md table says PATCH accepts "note, replacedText, status, and/or reply" — the "and/or reply" was added, but the schema for `reply` is not shown.

**Recommendation**: Add the `reply` field to the CLAUDE.md PATCH description for completeness.

### 1.6 DELETE Returns `{ ok: true }` (Low — Consistency)

**Finding**: DELETE endpoints return `{ ok: true }` on success. This is a common pattern but inconsistent with other endpoints that return the affected object. A 204 No Content would be more conventional for DELETE operations.

**Recommendation**: Minor. Either 200 with `{ ok: true }` or 204 No Content are acceptable. Consider switching to 204 if the API is ever versioned.

### 1.7 No Empty-Note Validation on POST /annotations (Low — Data Quality)

**Finding**: `POST /annotations` validates that `note` is a string but not that it's non-empty. An annotation with `note: ""` is valid. The specification says for PageNote: "Must be non-empty (empty notes are not saved)" but no such constraint exists for annotations.

This is probably intentional — you might create an annotation by selecting text without adding a note — but it's inconsistent with page notes.

**Recommendation**: If empty-note annotations are intentional, document the design choice. If not, add empty-string validation.

### 1.8 GET /page-notes Also Returns Annotations (Low — Clarity)

**Finding**: `GET /page-notes` (line 242-249 in middleware.ts) returns the full store shape with page notes filtered but annotations unfiltered. This mirrors the `/annotations` behaviour but in reverse.

**Recommendation**: Same as 1.1 — the `/page-notes` endpoint returns more than page notes.


## Part 2: MCP API Review

### 2.1 `resolve_annotation` Name Is Misleading (High — Clarity)

**Finding**: The MCP tool `resolve_annotation` does **not** resolve annotations by default. It marks them as `"addressed"`. To actually resolve, you need `autoResolve: true`.

The engineering plan (2026-02-23-annotation-status-lifecycle.md) explicitly acknowledges this: "Renaming the MCP tool would break existing agent configurations." The choice to keep the name was a backward-compatibility decision.

However, this is the tool agents will call most frequently, and its name directly contradicts its default behaviour. When an agent reads `resolve_annotation`, the natural interpretation is "this will resolve the annotation" — but it won't.

**Impact**: Every agent integration will need to understand that `resolve_annotation` doesn't resolve. The tool description compensates with a detailed explanation, but tool names are the primary signal agents use when selecting tools.

**Recommendation**: **Rename to `mark_annotation`** or `address_annotation` with the `status` parameter being explicit:
```
mark_annotation({ id: "...", status: "addressed" })     // default
mark_annotation({ id: "...", status: "resolved" })       // auto-resolve
```

If backward compatibility is essential, register both names (old and new) pointing to the same handler, and deprecate the old name in documentation. Alternatively, if you maintain that renaming is too disruptive, add a prominent warning in all documentation that the name is a misnomer.

### 2.2 `autoResolve: true` Doesn't Set `addressedAt` (Medium — Correctness)

**Finding**: When calling `resolve_annotation({ id, autoResolve: true })`, the handler sets:
- `status: 'resolved'`
- `resolvedAt: now`
- Does NOT set `addressedAt`

The code comment says "Keep addressedAt — shows when the agent first acted", but if the annotation was never addressed first, `addressedAt` is never set. This means auto-resolved annotations have `resolvedAt` but no `addressedAt`.

The documentation (mcp-tools.md) says: "Returns: The updated annotation object with `addressedAt` (and `resolvedAt` if `autoResolve`) set" — this is inaccurate. `addressedAt` is NOT set by `autoResolve`.

**Impact**: Consumers checking `addressedAt` to determine when the agent acted will get `undefined` for auto-resolved annotations, even though the agent clearly acted (by resolving it).

**Recommendation**: Either:
- (a) Set `addressedAt` when auto-resolving (semantically, the agent *did* address it by resolving it)
- (b) Update the documentation to accurately state that `addressedAt` is only set when status becomes `"addressed"`, not when auto-resolving
- (c) Remove the `autoResolve` parameter entirely and require agents to make two calls (`resolve_annotation` then a REST PATCH to resolved) — this simplifies the tool but adds friction

### 2.3 `add_agent_reply` Doesn't Set `role` Explicitly (Low — Consistency)

**Finding**: The `add_agent_reply` handler pushes `{ message, createdAt }` without setting `role`:

```typescript
annotation.replies.push({ message: params.message, createdAt: now });
```

This relies on the convention that absent `role` = `'agent'`. Meanwhile, the REST API PATCH explicitly sets `role: 'reviewer'` on reviewer replies.

**Impact**: JSON data has inconsistent shapes — agent replies have no `role` field, reviewer replies have `role: 'reviewer'`. While `getAnnotationStatus`-style backward compatibility is fine for migration, new code should be explicit.

**Recommendation**: Set `role: 'agent'` explicitly in `add_agent_reply`:
```typescript
annotation.replies.push({ message: params.message, createdAt: now, role: 'agent' });
```

### 2.4 Overlapping Functionality: `replacedText` in Two Tools (Medium — Clarity)

**Finding**: Two MCP tools can set `replacedText`:
- `resolve_annotation({ id, replacedText: "..." })` — sets replacedText AND changes status
- `update_annotation_target({ id, replacedText: "..." })` — sets replacedText only

**Impact**: An agent might not know which to use. The workflow example in mcp-tools.md shows using both separately (update_annotation_target first, then resolve_annotation without replacedText), but nothing prevents using resolve_annotation's replacedText parameter instead, combining the operations.

**Recommendation**: Either:
- (a) Remove `replacedText` from `resolve_annotation` — make agents always use `update_annotation_target` first. This gives each tool one clear responsibility.
- (b) Document explicitly when to use which: "Use `update_annotation_target` if you've changed the text but aren't ready to mark as addressed. Use `resolve_annotation` with `replacedText` to do both at once."

### 2.5 No MCP Tool to Reopen or Delete (Intentional — Clarity)

**Finding**: The MCP API has no tool to:
- Set status back to `'open'` (reopen)
- Delete annotations

These are reviewer-only actions, so their absence from the agent-facing MCP API is intentional.

**Recommendation**: Document this explicitly in mcp-tools.md — state that reopening and deletion are reviewer-only actions available through the browser UI and REST API, not through MCP tools.

### 2.6 No MCP Tool for Page Note Lifecycle (Low — Completeness)

**Finding**: MCP has `list_page_notes` but no way to reply to, resolve, or otherwise act on page notes. Page notes have no lifecycle at all (no status, no replies).

**Impact**: An agent can read page notes but cannot indicate that it has acted on them. The only option is to address page-level feedback without any way to mark it as handled.

**Recommendation**: Consider whether page notes need a status field or whether the current design (page notes are informational context, not actionable items) is sufficient. If they're intended to be actionable, add a lifecycle. If they're contextual, document that explicitly.

### 2.7 `resolve_annotation` Description Mentions "Tier 2.5" (Low — Clarity)

**Finding**: The `replacedText` parameter description says "Enables Tier 2.5 re-anchoring in the browser UI." This is internal implementation jargon that has no meaning to an agent.

**Recommendation**: Simplify to: "Records the replacement text so the annotation can be relocated to its new position in the browser."


## Part 3: Annotation State Machine Review

### 3.1 State Definitions

Current states and their documented meanings:

| State | Meaning | Set by |
|-------|---------|--------|
| `open` | New or reopened | System (on creation) / Reviewer (reopen) |
| `addressed` | Agent has acted | Agent (MCP) |
| `resolved` | Auto-resolved by agent | Agent (MCP with autoResolve) |

### 3.2 The `resolved` State Has Two Distinct Meanings (High — Ambiguity)

**Finding**: `resolved` can mean:
1. **Agent auto-resolved**: The agent called `resolve_annotation({ autoResolve: true })` — no human reviewed the change.
2. *(Historical)* **Reviewer confirmed**: In the original engineering plan, `resolved` meant "reviewer confirmed the fix". This path was later replaced by "Accept = delete" (issue #25).

After the Accept-deletes change, `resolved` now exclusively means "agent auto-resolved, skipping human review." But this raises a question: **what is the purpose of `resolved` if acceptance removes the annotation entirely?**

The current flow is:
- Agent marks as addressed → reviewer clicks Accept → annotation is **deleted** (not moved to resolved)
- Agent marks as resolved (auto-resolve) → reviewer sees resolved annotation with Reopen/Accept buttons → can Accept (delete) or Reopen

So `resolved` is now exclusively an auto-resolve state, serving as a "pending reviewer confirmation" state for when agents skip the normal workflow. The reviewer can then either accept (delete) or reject (reopen).

**Impact**: This is coherent but the naming is confusing. "Resolved" suggests finality, but it's actually an intermediate state between "agent did something" and "reviewer accepted it". The truly final state is deletion.

**Recommendation**: Consider renaming to make the lifecycle clearer:
- `open` → `addressed` → *(accepted/deleted)* — the normal workflow
- `open` → `auto_addressed` or `pending_review` → *(accepted/deleted)* — the auto-resolve workflow

Or, if renaming is too disruptive, add documentation that explicitly explains: "`resolved` does not mean 'done' — it means 'the agent believes it's done but a reviewer hasn't confirmed'. The true end state is deletion."

### 3.3 The `addressed` State Is Vague (Medium — Clarity)

**Finding**: `addressed` means "an agent has acted on the annotation" but there's no requirement for what "acted" means. An agent can call `resolve_annotation({ id })` without:
- Making any code changes
- Adding a reply explaining what was done
- Setting `replacedText`

The state signals "I've done something" without evidence. This makes it a trust-based signal rather than a verifiable one.

**Impact**: For a dev tool where the reviewer can see the actual page, this is probably fine — the reviewer will visually verify whether the change was made. But for MCP integrations where multiple agents might process annotations, an agent could mark annotations as addressed without actually doing anything.

**Recommendation**: Consider whether `resolve_annotation` should require at least one of `replacedText` or a prior `add_agent_reply` call. This would ensure the agent provides evidence of action, not just a status change. Alternatively, document that `addressed` is a self-reported signal and reviewers should verify changes visually.

### 3.4 Reopen Clears `addressedAt` — History Loss (Medium — Data Quality)

**Finding**: When an annotation is reopened (status set to `'open'`), both `addressedAt` and `resolvedAt` are cleared:

```typescript
} else if (newStatus === 'open') {
  statusUpdates.addressedAt = undefined;
  statusUpdates.resolvedAt = undefined;
}
```

This means the timestamp of when the agent first acted is permanently lost. If a reviewer reopens an annotation, there's no record that it was ever addressed.

**Impact**: In a multi-round review workflow (address → reopen → address again → accept), you lose the history of each round. The `replies` array preserves conversation history, but the timestamps of state transitions are lost.

**Recommendation**: Consider keeping `addressedAt` on reopen, or introducing an `events` or `history` array that logs state transitions:
```json
{
  "history": [
    { "from": "open", "to": "addressed", "at": "2026-02-28T10:00:00Z" },
    { "from": "addressed", "to": "open", "at": "2026-02-28T11:00:00Z", "note": "try again" },
    { "from": "open", "to": "addressed", "at": "2026-02-28T12:00:00Z" }
  ]
}
```

This may be over-engineering for the current use case. The simpler alternative is to document that reopen clears timestamps and that the replies array is the source of truth for conversation history.

### 3.5 No "Won't Fix" or "Not Applicable" State (Low — Completeness)

**Finding**: There's no way to close an annotation as "not applicable" or "won't fix" without deleting it. Every annotation must either be addressed/accepted or remain open indefinitely.

**Impact**: In practice, a reviewer who decides an annotation is no longer relevant would just delete it. But deletion loses all context. A "dismissed" or "won't fix" state would preserve the annotation in the record while removing it from the active workflow.

**Recommendation**: Consider adding a `dismissed` state for annotations the reviewer decides not to pursue. This would preserve them in the JSON file but hide them in the UI (similar to how `resolved` currently reduces opacity). Low priority — deletion is adequate for a dev tool.

### 3.6 State Machine Diagram (Updated)

Based on the actual implementation (including Accept-deletes), the real state machine is:

```
                    ┌──────────────────────────┐
                    │                          │
                    ▼                          │
                 ┌──────┐   MCP resolve    ┌──────────┐   Accept    ┌─────────┐
  Created ──►    │ open │ ───────────────► │ addressed│ ──────────► │ DELETED │
                 └──────┘                  └──────────┘             └─────────┘
                    │                          │
                    │   MCP autoResolve        │  Reopen
                    │                          │   (+ optional reply)
                    ▼                          │
                 ┌──────────┐                  │
                 │ resolved │◄─────────────────┘
                 └──────────┘   (No, this isn't right)
                    │
                    ├── Accept ──► DELETED
                    │
                    └── Reopen ──► open
```

Wait — the Reopen button is on `resolved`, not `addressed`. Let me re-examine the spec:

- `open`: Delete button only
- `addressed`: Accept button (deletes annotation)
- `resolved`: Accept + Reopen buttons

So the corrected diagram is:

```
                 ┌──────────────────────────────────────────────┐
                 │                    Reopen                     │
                 │               (+ optional reply)              │
                 ▼                                               │
              ┌──────┐    MCP resolve      ┌───────────┐  Accept (=delete)
  Created ──► │ open │ ──────────────────► │ addressed │ ──────────► DELETED
              └──────┘                     └───────────┘
                 │
                 │  MCP autoResolve
                 ▼
              ┌──────────┐  Accept (=delete)
              │ resolved │ ──────────────────────────────────► DELETED
              └──────────┘
                 │
                 └── Reopen ──► open (see arrow above)
```

**Key observations**:
1. `addressed` has no Reopen path — once addressed, the reviewer can only Accept (delete) or... nothing else. There's no way to send an addressed annotation back to `open` from the UI buttons alone.
2. Only `resolved` has both Accept and Reopen buttons.
3. An `addressed` annotation that the reviewer disagrees with cannot be reopened via the UI — the reviewer would need to use the REST API directly.

### 3.7 Missing Reopen Path for `addressed` Annotations (High — Workflow Gap)

**Finding**: Based on the Accept-deletes engineering plan, addressed annotations show only the Accept button. A reviewer who looks at an addressed annotation and disagrees with the agent's work has no way to send it back to `open` via the browser UI.

The only options are:
- Accept (delete) — wrong, as the work isn't satisfactory
- Delete (via two-click confirmation) — loses all context
- Use the REST API to PATCH status back to `open` — not accessible to non-technical reviewers

**Impact**: This is a significant workflow gap. The most common review cycle is: agent addresses → reviewer checks → reviewer says "not quite, try again". The current UI doesn't support this for `addressed` annotations.

**Wait** — I need to re-check this. Let me look at the latest code more carefully. The Accept-deletes plan says:

```
| Status      | Buttons shown | Accept action                        |
|-------------|--------------|--------------------------------------|
| open        | Delete       | —                                    |
| addressed   | Accept       | Deletes the annotation entirely      |
| resolved    | Reopen       | —                                    |
```

But there was a later commit: `533c6d4 feat: show Accept button on resolved annotations alongside Reopen`. This added Accept to resolved. And the follow-up notes feature added Reopen functionality.

So the question is: does `addressed` have a Reopen button? Looking at the status lifecycle plan:

> **On addressed annotations**: "Accept" button (moves to `resolved`) — the primary reviewer action

This was the original plan. But after Accept-deletes:

> **On addressed annotations**: Accept → deletes annotation

And no mention of Reopen on addressed annotations. The Reopen button is only mentioned for resolved annotations.

**Conclusion**: Addressed annotations can only be accepted (deleted). There is no reject/reopen path in the UI.

**Recommendation**: Add a Reopen button to addressed annotations. The workflow should be:
- `addressed` → **Accept** (delete, reviewer approves) OR **Reopen** (back to open, reviewer disagrees)
- `resolved` → **Accept** (delete, reviewer approves) OR **Reopen** (back to open, reviewer disagrees)

Both addressed and resolved should offer the same reviewer actions.


## Summary of Findings by Severity

### High Severity (Should Fix)

| # | Finding | Area |
|---|---------|------|
| 2.1 | `resolve_annotation` name is misleading | MCP |
| 1.4 | State transitions not enforced in REST API | REST |
| 3.2 | `resolved` state has ambiguous purpose | States |
| 3.7 | No Reopen path for `addressed` annotations in UI | Workflow |

### Medium Severity (Should Address)

| # | Finding | Area |
|---|---------|------|
| 1.1 | GET /annotations returns full store | REST |
| 1.2 | Inconsistent response shapes | REST |
| 2.2 | `autoResolve` doesn't set `addressedAt` | MCP |
| 2.4 | Overlapping `replacedText` in two tools | MCP |
| 3.3 | `addressed` state is vague | States |
| 3.4 | Reopen clears `addressedAt` | States |

### Low Severity (Nice to Have)

| # | Finding | Area |
|---|---------|------|
| 1.3 | New annotations have no explicit status | REST |
| 1.5 | `reply` field not fully documented in CLAUDE.md | REST/Docs |
| 1.6 | DELETE returns `{ ok: true }` | REST |
| 1.7 | No empty-note validation on POST /annotations | REST |
| 1.8 | GET /page-notes returns annotations too | REST |
| 2.3 | `add_agent_reply` doesn't set `role` explicitly | MCP |
| 2.5 | No MCP tool to reopen/delete (intentional) | MCP |
| 2.6 | No page note lifecycle | MCP |
| 2.7 | "Tier 2.5" jargon in tool description | MCP |
| 3.5 | No "won't fix" or "dismissed" state | States |


## Recommended Priority Actions

1. **Add Reopen button to `addressed` annotations** (3.7) — this is a UX gap that blocks the most common review workflow
2. **Rename `resolve_annotation` to `mark_annotation`** (2.1) — or at minimum add a clear alias
3. **Set `status: 'open'` explicitly on creation** (1.3) — trivial fix, makes data self-describing
4. **Set `role: 'agent'` explicitly in `add_agent_reply`** (2.3) — trivial fix, improves data consistency
5. **Fix `autoResolve` to set `addressedAt`** (2.2) — or update documentation to match actual behaviour
6. **Document transition rules** (1.4) — decide whether to enforce or document as advisory
