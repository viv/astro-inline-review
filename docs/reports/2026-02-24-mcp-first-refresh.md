---
generated_by: Claude Opus 4.6
generation_date: 2026-02-24
model_version: claude-opus-4-6
purpose: documentation_update_report
status: final
human_reviewer: matthewvivian
tags: [documentation, mcp-first, refresh]
---

# Documentation Update Report: MCP-First Refresh

**Branch:** `docs/mcp-first-refresh`
**Date:** 2026-02-24

## Summary

Comprehensive review and update of all user-facing documentation to establish MCP as the primary integration path, ensure dev-only/zero-production messaging is prominent, and add a clear feedback loop description throughout.

## Files Reviewed

| File | Status | Key Changes |
|------|--------|-------------|
| `README.md` | Updated | Full restructure with MCP-first framing, feedback loop diagram, required heading structure, Troubleshooting and FAQ sections added |
| `docs/guides/mcp-setup.md` | Updated | Added "Before you begin" prerequisites, updated tool count (6 → 7), enhanced feedback loop diagram with element annotations, updated troubleshooting |
| `docs/guides/mcp-tools.md` | Updated | Added `update_annotation_target` tool, updated `resolve_annotation` with `autoResolve` parameter and status lifecycle, added `status`/`replacedText` to return docs |
| `docs/guides/release.md` | No change needed | Already uses British English, well-structured, no MCP-first framing needed (release process is orthogonal) |
| `docs/spec/specification.md` | Updated | Added MCP as primary agent integration path in overview, repositioned Markdown export as secondary, updated design principle 6 |

## Key Messaging Changes

### 1. MCP-First Positioning

**Before:** MCP appeared at ~60% through the README (line 131 of 213). The opening pitch led with Markdown export as the primary workflow.

**After:** MCP connectivity appears in the top third of the README. The overview introduces the feedback loop, the "Why MCP-First" section explains the value, and the quickstart shows MCP setup as step 3. Markdown export is clearly labelled as secondary throughout.

### 2. Dev-Only / Zero Production Footprint

**Before:** Mentioned in a single sentence at line 33 of the README ("Ships zero bytes in production builds").

**After:** Explicitly stated in the opening paragraph, reinforced with a dedicated subsection in the Overview listing concrete evidence (devDependency install, `astro dev` only activation, no scripts/middleware/host elements in production). Added to FAQ as well.

### 3. Feedback Loop Framing

**Before:** The workflow section (README line 75) described a linear process ending at "paste the export into your coding agent". No diagram showing the iterative cycle.

**After:** ASCII flow diagram in both README and mcp-setup.md showing the bidirectional human ↔ agent cycle. Numbered steps describe the full loop: annotate → agent reads → agent acts → agent marks addressed → reviewer confirms/re-annotates.

### 4. Tool Coverage Completeness

**Before:** Only 6 tools documented. `update_annotation_target` was missing from all user-facing docs. `resolve_annotation` did not document the `autoResolve` parameter or the `open → addressed → resolved` status lifecycle.

**After:** All 7 tools documented with correct parameters, return types, and examples. Status lifecycle explained with clear progression diagram.

## Heading Structure Applied

All major documents now follow the required structure where applicable:

1. Overview
2. Why MCP-First (README)
3. Quickstart (README)
4. Usage
5. Configuration
6. Troubleshooting
7. FAQ
8. Contributing

The MCP guides follow a context-appropriate variant (Before you begin → Setup → Workflow → Troubleshooting).

## British English Verification

All updated documents use British English spelling throughout. Verified: no instances of "organization", "color", "behavior", "center", "license" (as verb), "customize", or other American English forms.

## Unresolved Gaps and Follow-ups

| Item | Status | Notes |
|------|--------|-------|
| Cursor/Windsurf MCP config examples | Proposed follow-up | The "Other MCP clients" section gives generic guidance. Specific config examples for Cursor and Windsurf would be valuable once their MCP configuration formats stabilise. |
| Package rename | Pending | The README references `astro-inline-review` throughout. A rename is noted as pending in other docs — documentation will need updating when the new name is finalised. |
| Acceptance test repo link | To confirm | The link to `astro-inline-review-tests` in Contributing should be verified as accessible. |
| Element annotation in specification | Already covered | The specification already documents Alt+click element annotation thoroughly. No changes needed beyond the overview reframing. |
