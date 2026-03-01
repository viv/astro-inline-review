---
created: 2026-02-24
status: in-progress
purpose: Package rename candidates — tracking shortlisted names, availability, and rationale
context: review-loop is being renamed to drop the Astro-specific branding ahead of multi-framework support
---

# Package Name Candidates

## Decision

**Final name: `review-loop`** (confirmed 2026-02-28)

Previously considered `redline-ai` but ruled out — npm name taken by an active package in an adjacent space ("inline AI editing for local Markdown files"), both GitHub usernames (`redline-ai`, `redlineai`) claimed, and heavy brand crowding from legal tech / contract review tools using "Redline AI".

`review-loop` was the existing leading candidate (`reviewloop` in the shortlist) and cleanly captures the human → agent → human cycle.

---

## Product positioning (as of 2026-02-24)

- A dev-only browser overlay for annotating rendered web pages during development
- Reviewers select text or Alt+click elements on a live page to leave feedback annotations
- AI coding agents connect via **MCP (primary mechanism)** and read annotations, make changes, then mark annotations as addressed
- Human reviewer accepts or reopens each annotation in the browser panel
- **Zero bytes shipped in production** — purely a dev tool
- Goal: reduce friction in the feedback loop between developer reviewing and agent modifying/remediating

## Constraints

- Must be available on npm
- No framework names (not "astro", not "vite", not "next")
- Should convey: in-browser annotation + AI agent workflow
- Developer audience

---

## Shortlisted candidates

| Name | Available | Origin | Why / Feel / Notes |
|------|-----------|--------|-------------------|
| `annotate-agent` | ✅ | Full context agent | Blunt and descriptive — human annotates, agent acts. Would search well. Concern: mechanical, not particularly memorable. |
| `annotate-dev` | ✅ | Functional, Logical agents | Action first, then scope. Mirrors how developers search. Concern: slightly awkward word order as a package name. |
| `annotate-for-agents` | ✅ | User | Extremely explicit about the purpose — developers building AI fix pipelines will understand immediately. Concern: long and slightly awkward as an import name. |
| `corrections` | ✅ | — | Simple plural noun — "corrections to be made". Familiar from editorial and journalism. Concern: sounds like a passive list rather than an active tool. |
| `dev-markup` | ✅ | Functional, Logical agents | "Markup" does double duty (HTML markup + editorial marks). `-dev` suffix instantly signals dev-only, zero-prod. Concern: "markup" strongly connotes HTML. |
| `devglass` | ✅ | Full context agent | A pane of glass you write on top of a rendered page — metaphorically precise. Short, brandable. Concern: abstract; doesn't surface well in search. |
| `earmark` | ✅ | Metaphors agent | Earmarking = flagging something for attention; the folded page corner is a physical annotation gesture. Best available single word. Concern: modern usage skews toward budget/allocation. |
| `feedback-overlay` | ✅ | Logical agent | Describes both the mechanism (overlay) and purpose (feedback). Concern: doesn't signal dev-only nature. |
| `inline-feedback` | ✅ | Logical agent | Most searchable by someone who doesn't know this tool exists. "Inline" signals on-page, "feedback" is the action. Concern: "inline" is overloaded in CSS context. |
| `live-annotate` | ✅ | Functional agent | "Live" signals dev-server context, "annotate" is the action. Purposeful and action-oriented. Concern: "live" is overloaded in dev tooling. |
| `live-refine` | ✅ | — | "Live" = dev-server, "refine" = iterative improvement. Has a nice product feel. Concern: "refine" is broad; could be mistaken for a performance profiling tool. |
| `live-revise` | ✅ | — | Revising on the live dev preview. Clean and purposeful. Concern: "revise" leans toward text editing rather than annotation. |
| `markup-agent` | ✅ | Full context agent | Markup = annotating; agent = AI actor. Clear two-part meaning. Concern: might read as "a markup language agent". |
| `markup-loop` | ✅ | Full context agent | "Markup" works on two levels (HTML + editorial), "loop" captures the human↔agent cycle. Concern: hyphen makes it less clean as a package name. |
| `markup-mcp` | ✅ | Full context agent | Signals both annotation and the MCP protocol integration. Concern: may date badly if MCP terminology shifts. |
| `page-annotate` | ✅ | Logical agent | Clear scope (pages) + action (annotate). Concern: slightly generic, doesn't communicate the dev-only or agent angle. |
| `page-markup` | ✅ | Logical agent | Editorial connotation scoped to pages. Concern: same HTML/markup confusion risk as `dev-markup`. |
| `page-refine` | ✅ | — | Refine pages iteratively with annotated feedback. Concern: doesn't communicate the annotation mechanism or AI agent angle. |
| `page-review` | ✅ | Logical agent | Short, obvious. Concern: too generic — could mean a code review tool, SEO tool, etc. |
| `pagemarks` | ✅ | Full context agent | Evokes leaving marks directly on a page, clean and memorable. Concern: may conflict with bookmark-adjacent tooling in search results. |
| `pinpoint-review` | ✅ | Full context agent | "Pinpoint" conveys precision — feedback on exactly this element or text. Concern: slightly long for a package name. |
| `proofread-agent` | ✅ | — | Clearly describes the human+AI dynamic — you proofread, the agent acts. Concern: "proofread" implies copy/text only, not element-level annotation. |
| `refine-agent` | ✅ | — | Agent-forward framing — the agent refines based on annotations. Concern: "refine" is broad; agent is secondary to the annotation workflow. |
| `refine-loop` | ✅ | — | The refinement loop between reviewer and agent. Concern: abstract — "refine" doesn't hint at in-browser annotation. |
| `rephrase-loop` | ✅ | — | The rephrase iteration cycle. Concern: too narrow — implies text-only workflow. |
| `revise-agent` | ✅ | — | Human annotates, agent revises. Paired nicely. Concern: "revise" leans textual; misses the element annotation angle. |
| `revise-loop` | ✅ | — | The revision loop between reviewer and agent. Concern: "revise" is familiar but broad. |
| `review-live-loop` | ✅ | User | Captures all three dimensions: the review action, the live dev-server context, and the human↔agent cycle. Concern: three words makes it longer than most package names. |
| `reviewloop` | ✅ | Full context, Functional agents | Cleanly captures the human → agent → human cycle. Reads naturally as a compound. Concern: "loop" is somewhat overused in devtools. |
| `reword-agent` | ✅ | — | Clean, specific. Human marks text, agent rewords it. Concern: too narrow — implies only copy changes, not element annotation. |
| `reword-loop` | ✅ | — | The reword iteration cycle. Concern: same narrowness as `reword-agent`. |

---

## Previously considered and eliminated

| Name | Reason removed |
|------|---------------|
| `annotant` | User disliked |
| `callout` | Taken |
| `chalk` | Taken |
| `correct-agent` | User disliked |
| `corrections` | Passive feel |
| `dev-annotate` | User disliked |
| `dev-comments` | User disliked |
| `dev-proofread` | User disliked |
| `dev-refine` | User disliked |
| `dev-revise` | User disliked |
| `devglass` | Abstract |
| `dispatch` | Taken |
| `dogear` | Taken |
| `feedloop` | User disliked |
| `galley` | Taken |
| `ghostmark` | Taken |
| `gloss` | Taken |
| `hotmark` | User disliked |
| `inkwell` | Taken |
| `inline-mark` | User disliked |
| `lacuna` | Taken |
| `livemarks` | User disliked |
| `marginalia` | Taken |
| `overlay` | Taken |
| `paper-trail` | User disliked |
| `pagepin` | User disliked |
| `pinboard` | Taken |
| `pin-review` | User disliked |
| `proofread-dev` | User disliked |
| `punchlist` | Taken |
| `relay` | Taken |
| `render-review` | User disliked |
| `rephrase-agent` | User disliked |
| `roundtrip` | Taken |
| `scholia` | User disliked |
| `scrawl` | Taken |
| `site-annotate` | User disliked |
| `sitemark` | User disliked |
| `snag` | Taken |
| `sticky-loop` | User disliked |
| `whispermark` | User disliked |