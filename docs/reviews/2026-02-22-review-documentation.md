---
generated_by: Claude Opus 4.6
generation_date: 2026-02-22
model_version: claude-opus-4-6
purpose: documentation_and_engineering_plans_review
status: draft
scope: [engineering-plans, guides, reviews, README, CLAUDE.md, documentation]
tags: [documentation, engineering-plans, review, completeness, accuracy]
---

# Documentation and Engineering Plans Review

**Reviewed**: All files in `docs/engineering-plans/`, `docs/guides/`, `docs/reviews/`, `README.md`, `CLAUDE.md`
**Review date**: 2026-02-22
**Reviewer**: Claude Opus 4.6 (docs-reviewer agent)

## Executive Summary

The documentation for review-loop is comprehensive and well-structured. There are 5 engineering plans, 2 guides, 11 previous review documents, a detailed README, and a thorough CLAUDE.md. The engineering plans follow a consistent format with frontmatter metadata and clear session boundaries. The MCP server plan is the most detailed, with 7 fully-completed sessions, and serves as an exemplar of the project's planning approach.

The main findings are: (1) one engineering plan has a stale status (`agent-prompt-export` is marked `draft` / `not_started` but appears to have been intentionally deferred — needs clarification), (2) the CLAUDE.md is accurate but missing the annotation dismissal feature documentation, (3) the README is accurate and well-written, (4) most previous review recommendations have been addressed, and (5) several plans have minor metadata inconsistencies.

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 1 |
| Medium | 5 |
| Low | 6 |
| Info | 4 |
| **Total** | **16** |

---

## 1. Engineering Plans

### 1.1 Plan Inventory and Status

| Plan | Status (frontmatter) | Actual Status | Correct? |
|------|---------------------|---------------|----------|
| `2026-02-22-agent-bridge.md` | `implemented` | Implemented (Approaches A, B, C done; D deferred) | Yes |
| `2026-02-22-mcp-server.md` | `implemented` | All 7 sessions completed | Yes |
| `2026-02-22-export-button.md` | `implemented` | Export button in panel, tests passing | Yes |
| `2026-02-22-annotation-dismissal.md` | `implemented` | Delete button and orphan indicator in panel | Yes |
| `2026-02-22-agent-prompt-export.md` | `draft` / `not_started` | Not implemented | See Finding #1 |

### Finding #1: Agent-Prompt Export plan status needs clarification

- **Severity**: Medium
- **File**: `docs/engineering-plans/2026-02-22-agent-prompt-export.md`

The agent-prompt-export plan is the only plan with `status: draft` and `implementation_tracking: not_started`. This is factually correct — the feature has not been implemented. However, it is unclear whether this plan is:
- (a) Still intended for future work
- (b) Deferred in favour of the MCP approach (which largely supersedes the copy-paste workflow)
- (c) Abandoned

The MCP server provides a more powerful agent integration path than enhanced markdown export, so this plan may be less relevant now. The plan itself has open questions that were never resolved.

**Recommendation**: Either mark the plan as `status: deferred` with a note explaining that MCP supersedes the copy-paste workflow, or update the status to reflect the current intent. Add a note in the frontmatter: `superseded_by: docs/engineering-plans/2026-02-22-mcp-server.md` if applicable.

### Finding #2: MCP Server plan Session 7 status inconsistency

- **Severity**: Low
- **File**: `docs/engineering-plans/2026-02-22-mcp-server.md`

Session 7's status is listed as `complete` (lowercase, no backticks) while all other sessions use `completed` (past tense). This is a minor inconsistency.

**Recommendation**: Change Session 7 status to `completed` for consistency.

### Finding #3: Annotation Dismissal plan missing `implementation_tracking` field

- **Severity**: Low
- **File**: `docs/engineering-plans/2026-02-22-annotation-dismissal.md`

The frontmatter includes `status: implemented` but lacks the `implementation_tracking` field that other implemented plans have (e.g., `implementation_tracking: completed` in the agent-bridge and MCP server plans).

**Recommendation**: Add `implementation_tracking: completed` to the frontmatter.

### Finding #4: Export Button plan missing `implementation_tracking` field

- **Severity**: Low
- **File**: `docs/engineering-plans/2026-02-22-export-button.md`

Same issue as Finding #3 — `status: implemented` but no `implementation_tracking` field.

**Recommendation**: Add `implementation_tracking: completed` to the frontmatter.

### 1.2 Plan Completeness

| Plan | Sessions | All Covered? | Cross-references |
|------|----------|-------------|-----------------|
| Agent Bridge | 5 sessions | Yes — all 5 documented, Approaches A-C done, D deferred | References MCP server plan correctly |
| MCP Server | 7 sessions | Yes — all 7 documented with prompts and status | References agent bridge plan correctly |
| Export Button | 1 session | Yes — single session, concise and complete | None needed |
| Annotation Dismissal | 2 sessions | Yes — Session 1 implemented, Session 2 (test repo) documented | None needed |
| Agent-Prompt Export | 4 sessions | N/A — not started | Has open questions |

### 1.3 Session Boundaries

All plans follow the user's preferred session structure:
- Clear goals per session
- Entry state documented
- Exit state documented
- Session prompts provided (MCP server plan)
- No time estimates (correctly omitted per user preferences)

The MCP server plan is the gold standard — each of its 7 sessions has a detailed prompt with exact steps, making it possible to resume from documentation alone. The other plans have adequate session descriptions but less detailed prompts.

### Finding #5: Annotation Dismissal plan Session 2 references external test repo

- **Severity**: Info
- **File**: `docs/engineering-plans/2026-02-22-annotation-dismissal.md`

Session 2 describes changes to `../review-loop-tests/` which is a separate repository. The plan clearly notes this is the test repo, and the session boundary is well-defined. However, it's worth noting that Session 2's scenario tests and spec updates may not have been fully executed yet, as the most recent commits focus on Session 1 (the implementation in the main repo).

The git log shows:
- `600c7c2 feat: add annotation delete button and orphan indicator in panel` (Session 1)
- `a5c138c docs: update spec for annotation delete button and orphan indicator` (Session 2 — spec part)
- `a8fe533 docs: mark annotation dismissal plan as implemented` (Plan status update)

The scenario tests in the external repo cannot be verified from this repository.

### 1.4 Implementation Tracking

Cross-referencing plans against actual implementation:

**Agent Bridge (Approach A)**: CLAUDE.md documents `inline-review.json` schema — verified present and accurate.

**Agent Bridge (Approach B / MCP Server)**: All 6 MCP tools implemented:
- `src/mcp/tools/list-annotations.ts` — present
- `src/mcp/tools/list-page-notes.ts` — present
- `src/mcp/tools/get-annotation.ts` — present
- `src/mcp/tools/get-export.ts` — present
- `src/mcp/tools/resolve-annotation.ts` — present
- `src/mcp/tools/add-agent-reply.ts` — present

Supporting infrastructure:
- `src/mcp/server.ts` — present (entry point with CLI arg parsing)
- `src/mcp/types.ts` — present (shared ToolResult/ErrorResult)
- `src/shared/export.ts` — present (extracted from middleware)
- `.mcp.json` — present and correct

**Export Button**: `src/client/ui/panel.ts` has `data-air-el="export"` button — verified.

**Annotation Dismissal**: `PanelCallbacks` interface includes `onAnnotationDelete` and `isAnnotationOrphaned` — verified. Orphan indicator CSS class `.air-annotation-item--orphan` present.

---

## 2. README.md Accuracy

### Finding #6: README accurately reflects current features

- **Severity**: Info (Positive)

The README is well-written and accurate. Key verifications:
- Features list matches implementation (text annotations, page notes, export, persistence, multi-page, Shadow DOM, keyboard shortcuts, MCP server, zero-config)
- Install and configuration instructions are correct
- Keyboard shortcuts table is correct
- Export format examples are accurate
- MCP section correctly documents auto-discovery, manual setup, and available tools
- Storage documentation is correct
- Alternatives section provides fair comparison with astro-annotate
- CI badges reference correct GitHub paths

### Finding #7: README MCP tools table missing resolved/replies detail

- **Severity**: Low

The README's MCP tools table lists all 6 tools correctly. However, the `get_export` description says "Markdown export of all annotations and page notes" but doesn't mention that resolved annotations and agent replies are included in the export. This is a minor omission since the tool descriptions are brief by design.

**Recommendation**: No change needed — the detailed descriptions are in `docs/guides/mcp-tools.md` where they belong. The README appropriately links to the guides.

### Finding #8: README TODO comment for screenshot

- **Severity**: Low

The README contains `<!-- TODO: Add screenshot/GIF here -->` on line 13. This has likely been present since the initial README and is a known deferred item.

**Recommendation**: Either add a screenshot/GIF or remove the TODO comment to keep the README clean.

---

## 3. CLAUDE.md Accuracy

### Finding #9: CLAUDE.md missing annotation dismissal feature

- **Severity**: High
- **File**: `CLAUDE.md`

The CLAUDE.md accurately describes:
- Architecture (client/server/storage split)
- Schema (annotations and pageNotes with correct fields)
- REST API endpoints
- MCP server and tools
- Development commands
- Key file paths

However, it does not mention the annotation dismissal feature (delete button, orphan indicator) which was the most recent feature added. The `PanelCallbacks` interface now includes `onAnnotationDelete` and `isAnnotationOrphaned`, but CLAUDE.md doesn't reference these.

More importantly, the schema section in CLAUDE.md does not document the `resolvedAt` and `replies` fields on annotations, which were added as part of the MCP server work. These fields are important for agents reading the annotation data.

**Recommendation**: Update the CLAUDE.md schema section to include:
```json
"resolvedAt": "ISO 8601 (optional, set when resolved via MCP)",
"replies": [{ "message": "string", "createdAt": "ISO 8601" }]
```

Also consider adding a brief note about the annotation dismissal feature to the architecture section.

### Finding #10: CLAUDE.md file paths accurate

- **Severity**: Info (Positive)

All key file paths in CLAUDE.md verified against the actual file system:
- `src/shared/types.ts` — present
- `src/server/storage.ts` — present
- `src/server/middleware.ts` — present
- `src/client/export.ts` — present
- `src/index.ts` — present
- `src/mcp/server.ts` — present
- `src/mcp/types.ts` — present
- `src/mcp/tools/` — present (6 tool files)
- `.mcp.json` — present
- `docs/spec/specification.md` — present

---

## 4. Guide Accuracy

### 4.1 MCP Setup Guide (`docs/guides/mcp-setup.md`)

### Finding #11: MCP setup guide accurate and well-structured

- **Severity**: Info (Positive)

The setup guide covers:
- Prerequisites (build, have annotations)
- Claude Code automatic setup via `.mcp.json`
- Other MCP clients manual setup
- Typical workflow diagram
- Troubleshooting section

The `.mcp.json` content shown matches the actual file. The troubleshooting section covers common issues appropriately.

### 4.2 MCP Tools Reference (`docs/guides/mcp-tools.md`)

### Finding #12: MCP tools reference is comprehensive

- **Severity**: Info (Positive)

The tools reference documents all 6 tools with parameters, return shapes, error handling, and workflow examples. The documentation is practical and concise.

---

## 5. Previous Review Recommendations

### 5.1 Spec Reviews (Rounds 1-3)

| Review | Total Findings | Status | Notes |
|--------|---------------|--------|-------|
| Round 1 (24 findings) | 24 | All resolved | Spec updated comprehensively |
| Round 2 (15 findings) | 14 resolved, 1 outstanding | SPEC2-015 not resolved | Test count still says "110" — carried to Round 3 as SPEC3-011 |
| Round 3 (15 findings) | Status unclear | Not explicitly marked | This is the most recent spec review |

### Finding #13: Spec Review Round 3 findings may not be fully addressed

- **Severity**: Medium

The Round 3 spec review (`2026-02-21-spec-review-round-3.md`) identified 2 Critical and 6 Major findings. Its `status` is `resolved`, which was set after the review was produced. However, I cannot confirm from the git history that all findings were actually fixed in the specification. Key findings to verify:

- **SPEC3-001** (Critical): PATCH mutability table should show only `note` as mutable
- **SPEC3-002** (Critical): Element highlight opacity should be 0.8 not 0.7
- **SPEC3-008** (Major): `__restoreHighlights` missing from shadow root bridge table

**Recommendation**: Verify that the specification has been updated to address all Round 3 findings, particularly the 2 Critical ones.

### 5.2 Security Reviews

| Review | Findings | Status |
|--------|----------|--------|
| Security Review (2026-02-21) | 2 Medium fixed, 8 Low/Info | Resolved |
| Security Review Round 2 (2026-02-21) | 10 findings, all Low/Info | Resolved |
| MCP Security Review (2026-02-22) | 6 findings, all Low/Info | Resolved |

All security reviews are marked as resolved. The medium-severity findings from the first review (body size limit, PATCH field allowlisting) were fixed and verified in Round 2. The MCP security review found no Critical or High issues.

### 5.3 System Architecture Review

| Review | Key Recommendations | Status |
|--------|-------------------|--------|
| System Review (2026-02-21) | 10 tech debt items | Partially addressed |

**Addressed**:
- Item 2 (Duplicate types) — Extracted to `src/shared/types.ts`
- Item 3 (Duplicate export logic) — Extracted to `src/shared/export.ts`
- Item 10 (Dead code `__scrollToAnnotation`) — Not verified from current review

**Not addressed (still outstanding)**:
- Item 1 (Shadow root bridge → typed mediator) — Panel still uses `(shadowRoot as any).__refreshPanel` pattern
- Item 4 (FAB state desync) — Not verified
- Item 5 (Escape handler bypasses hidePopup) — Not verified
- Item 6 (N+1 delete in Clear All) — Still sequential deletes
- Item 7 (Double fetch on panel open) — Not verified
- Item 8 (Extract inspector from annotator.ts) — Not done

### Finding #14: Outstanding tech debt from system review not tracked

- **Severity**: Medium

The system architecture review identified 10 items of technical debt. At least 2 were addressed (shared types, shared export), but the remaining items have no tracking mechanism. There is no "tech debt backlog" document or plan for addressing them.

**Recommendation**: Create a lightweight tech debt tracking document (e.g., `docs/engineering-plans/tech-debt-backlog.md`) or add a section to an existing plan. This would make it easy to pick up items in future sessions.

### 5.4 MCP Design Review

| Review | Findings | Status |
|--------|----------|--------|
| MCP Design Review (2026-02-22) | 6 findings | Findings 1 & 4 fixed (shared types), Finding 3 fixed (.min(1)), Others documented |

The MCP design review findings were addressed in MCP Server Session 6. The review status is `draft` in the frontmatter, but the findings appear to have been resolved.

### Finding #15: MCP Design Review status should be `resolved`

- **Severity**: Low
- **File**: `docs/reviews/2026-02-22-mcp-design-review.md`

The frontmatter says `status: draft` but the findings were addressed in MCP Server Session 6 (per the session prompt).

**Recommendation**: Update to `status: resolved`.

### 5.5 Test Coverage and Quality Reviews

| Review | Key Findings | Status |
|--------|-------------|--------|
| Test Coverage (2026-02-21) | 26 gaps identified, 10 addressed | `addressed` |
| Test Quality (2026-02-21) | 50+ waitForTimeout, resp.ok bug | `complete` |

The test coverage review had 10 recommended tests implemented, bringing the suite from 110 to 120 tests. The remaining 16 gaps are documented as low-risk.

The test quality review identified systemic timing issues. Its status is `complete` (meaning the review is complete) but the recommendations (particularly P0 fixes like `resp.ok` → `resp.ok()` and API response waits) have an unclear resolution status.

### Finding #16: Test quality review P0 recommendations not tracked

- **Severity**: Medium

The test quality review identified 3 P0 (fix immediately) recommendations:
1. Add API response waits to `addPageNote` helper
2. Remove redundant `waitForTimeout(500)` calls
3. Fix `resp.ok` → `resp.ok()`

These are in the external test repository and their resolution status cannot be verified from this repo. However, there is no tracking mechanism to ensure they are addressed.

**Recommendation**: Consider adding a note to the test quality review about resolution status, or track these as items in a future session plan.

---

## 6. Documentation Gaps

### 6.1 Missing Documentation

| Gap | Severity | Notes |
|-----|----------|-------|
| No `ARCHITECTURE.md` or architecture overview beyond CLAUDE.md | Low | System review suggested this; CLAUDE.md partially covers it |
| No changelog or version history | Low | Small project, git log serves this purpose |
| No `docs/agent-integration.md` mentioned in agent-bridge plan | Low | CLAUDE.md serves this purpose instead; plan can be updated |

### 6.2 Documentation Consistency

The documentation is generally consistent. All engineering plans use the same frontmatter format. The guides are written in the same practical, concise tone. The reviews follow a consistent structure with findings tables.

One inconsistency: the `model_version` field in frontmatter varies between `claude-opus-4-6` and `claude-opus-4-6` (same value across all files — consistent).

---

## 7. Cross-Reference Matrix

| Document | References To | Referenced By |
|----------|--------------|---------------|
| Agent Bridge Plan | MCP Server Plan | MCP Server Plan |
| MCP Server Plan | Agent Bridge Plan, Spec | MCP Reviews, CLAUDE.md |
| Export Button Plan | Spec sections | None |
| Annotation Dismissal Plan | Spec sections, highlights.ts | Git commits |
| Agent-Prompt Export Plan | None | None |
| MCP Setup Guide | MCP Tools Guide | README |
| MCP Tools Guide | None | MCP Setup Guide, README |
| README | Spec, Guides | None |
| CLAUDE.md | Spec | None |

### Finding: Agent-Prompt Export plan is isolated

The agent-prompt-export plan has no cross-references to or from other documents, reinforcing the assessment in Finding #1 that its status needs clarification.

---

## Summary of Findings

| # | Severity | Category | Description |
|---|----------|----------|-------------|
| 1 | Medium | Plan Status | Agent-Prompt Export plan status unclear — draft/not_started but may be superseded by MCP |
| 2 | Low | Consistency | MCP Server plan Session 7 status says `complete` instead of `completed` |
| 3 | Low | Metadata | Annotation Dismissal plan missing `implementation_tracking` field |
| 4 | Low | Metadata | Export Button plan missing `implementation_tracking` field |
| 5 | Info | Cross-reference | Annotation Dismissal plan Session 2 test repo work not verifiable from main repo |
| 6 | Info | Positive | README accurately reflects current features |
| 7 | Low | Completeness | README MCP tools table doesn't mention resolved/replies in export |
| 8 | Low | Housekeeping | README has stale TODO comment for screenshot |
| 9 | High | Accuracy | CLAUDE.md missing `resolvedAt`, `replies` fields and annotation dismissal feature |
| 10 | Info | Positive | CLAUDE.md file paths all verified correct |
| 11 | Info | Positive | MCP setup guide accurate and well-structured |
| 12 | Info | Positive | MCP tools reference comprehensive |
| 13 | Medium | Tracking | Spec Review Round 3 critical findings may not be fully addressed in spec |
| 14 | Medium | Tracking | Outstanding tech debt from system review has no tracking mechanism |
| 15 | Low | Metadata | MCP Design Review status should be `resolved` not `draft` |
| 16 | Medium | Tracking | Test quality review P0 recommendations not tracked |

## Recommended Actions

### Immediate
1. **Update CLAUDE.md** to include `resolvedAt`, `replies` fields in schema and mention annotation dismissal (Finding #9)
2. **Clarify agent-prompt-export plan status** — mark as deferred/superseded if appropriate (Finding #1)

### Short-term
3. **Fix metadata inconsistencies** in engineering plans (Findings #2, #3, #4, #15)
4. **Verify Spec Round 3 critical findings** are addressed in specification (Finding #13)

### Medium-term
5. **Create tech debt tracking** document or backlog (Finding #14)
6. **Track test quality P0 items** resolution status (Finding #16)
7. **Remove README screenshot TODO** or add actual screenshot (Finding #8)
