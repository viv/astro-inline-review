---
created: 2026-02-28
status: draft
purpose: Product framing — how we communicate what review-loop is and why it matters
context: Ahead of the package rename, we need clear positioning, taglines, and descriptions that work across README, npm, GitHub, and documentation
generated_by: Claude Opus 4.6
human_reviewer: matthewvivian
tags: [framing, positioning, review-loop, rename]
---

# Product Framing: review-loop

## The core problem

Reviewing a rendered site and turning that into code changes means constant context-switching. You spot something wrong in the browser, then have to find the right source file, locate the right line, and describe what you saw. The gap between _seeing_ a problem and _fixing_ it is where momentum dies.

This is the "edit while reading" problem — you're always in the wrong mode. Reading mode shows you what's wrong; editing mode lets you fix it. Switching between them is where the friction lives.

## What review-loop does (one sentence)

review-loop keeps you in the browser: annotate what needs changing on the live page, and your AI coding agent acts on the feedback directly.

## The loop

The name captures the workflow literally:

```
Human reviewer                    AI coding agent
──────────────                    ───────────────
1. Browse rendered site
2. Annotate (select text or
   Alt+click elements)
                          ───────►
                                  3. Read annotations via MCP
                                  4. Edit source files
                                  5. Mark addressed, reply
                          ◄───────
6. See updates in panel
7. Accept or re-annotate
         │
         └──── loop ────►
```

The human stays in one place (the browser). The agent stays in one place (the codebase). Annotations are the interface between them.

## Tagline candidates

Short, punchy lines for README header, npm description, or social:

| Tagline | Feel | Notes |
|---------|------|-------|
| **Point. Fix. Repeat.** | Action-oriented, rhythmic | Three words, captures the loop. Strong. |
| **Inline feedback, automated resolution.** | Professional, descriptive | Two-part structure — what it is, what happens. |
| **Underline problems. Automate fixes.** | Direct, imperative | "Underline" works literally (text selection) and figuratively. |
| **Review in the browser. Fix in the code.** | Clear split of concerns | Emphasises the two-mode bridging. |
| **Annotate what you see. Your agent fixes the rest.** | Conversational | Longer but very clear for someone encountering it cold. |
| **Edit while reading.** | Borrowed insight (redline-ai) | Captures the core friction reduction. Might be too generic on its own. |
| **Close the gap between seeing and fixing.** | Problem-focused | Emphasises the pain point rather than the mechanism. |
| **The feedback loop between humans and coding agents.** | Literal, explanatory | Works well as a subtitle or npm description. Less punchy. |

## npm description (max ~120 chars)

Current: _"Dev-only annotation overlay for reviewing rendered sites and feeding corrections to AI coding agents via MCP"_ (107 chars)

Candidates:
- `Dev-only annotation overlay — review your site in the browser, let your AI agent fix the code` (95 chars)
- `Annotate your rendered site. Your coding agent acts on the feedback. Zero production bytes.` (92 chars)
- `Point at what needs fixing on your live site. Your AI coding agent does the rest.` (81 chars)
- `Bridge human reviewers and AI coding agents with in-browser annotations` (71 chars)

## Key messaging pillars

These are the things that matter most and should come through in any description:

1. **Stay in the browser** — no switching to an editor to describe what you saw. You annotate on the rendered page itself.

2. **Agent-native** — MCP-first integration means your coding agent reads annotations with full context (page URL, exact text ranges, element selectors) and works through them autonomously.

3. **The loop closes** — this isn't one-way feedback. The agent marks work as addressed, replies with what it did, and the reviewer confirms or reopens. The annotation is the unit of work.

4. **Zero production footprint** — dev-only. No scripts, no API, no UI in production builds. This matters for trust — it's safe to add to any project.

5. **Framework-agnostic** — Astro, Vite (SvelteKit, Nuxt, Remix), Express/Connect. Not tied to one ecosystem.

## What review-loop is NOT

Useful for positioning by contrast:

- **Not a code review tool** — it reviews the _rendered output_, not the source code
- **Not a bug tracker** — annotations are transient; once addressed and accepted, they're deleted
- **Not a commenting system** — annotations aren't for discussion threads; they're instructions for an agent to act on
- **Not a CMS** — it doesn't provide an editing interface; it provides a feedback interface
- **Not a testing tool** — it captures subjective human judgement ("this heading is awkward", "move this section up"), not automated assertions

## Audience

Primary: developers using AI coding agents (Claude Code, Cursor, Windsurf, Codex) who review rendered output during development.

Secondary: non-technical reviewers (content editors, designers, product managers) who can annotate a dev site and have a developer's agent action the feedback.

## Comparable tools and how we differ

| Tool | What it does | How review-loop differs |
|------|-------------|----------------------|
| **redline-ai** | Inline AI editing for Markdown files — select text, instruct AI, review diff, apply | review-loop works on any rendered page (not just Markdown), uses an asynchronous annotation loop (not immediate editing), and persists annotations for team workflows |
| **Marker.io / BugHerd** | Visual bug reporting overlays that create tickets in Jira/Linear/etc. | review-loop feeds annotations directly to AI agents via MCP, not to ticket systems. The agent acts autonomously rather than waiting for a human developer |
| **Figma comments** | In-context annotation on design files | review-loop annotates the _actual rendered site_, not a design mockup. The feedback is on real HTML, with real XPaths and selectors |
| **Percy / Chromatic** | Visual regression testing (screenshot diffs) | These are automated; review-loop captures subjective human judgement |

## Open questions

- [ ] Which tagline to lead with in the README header?
- [ ] Should the npm description emphasise the MCP angle or keep it generic?
- [ ] Do we need a logo or visual identity? (Probably not yet — keep it text-only)
- [ ] README hero section — ASCII diagram (current), animated GIF, or screenshot?
- [ ] Is "annotation overlay" the right category term, or is there something better?
