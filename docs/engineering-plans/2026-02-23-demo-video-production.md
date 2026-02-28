---
generated_by: Claude Sonnet 4.6
generation_date: 2026-02-23
model_version: claude-sonnet-4-6
purpose: production_plan
status: draft
human_reviewer: matthewvivian
implementation_tracking: pending
tags: [demo, video, readme, kap, imovie, gif, mcp, marketing]
---

# Demo Video Production Plan

## Goal

Produce a short screen recording (MP4 + optional GIF) demonstrating the end-to-end `astro-inline-review` workflow for embedding in the README. The video shows a human reviewer annotating a live Astro site, then an AI agent (Claude Code via MCP) addressing the annotations and making real code changes, then the result reflected back in the browser.

---

## Equipment & Software

| Tool | Purpose | Cost |
|------|---------|------|
| **Kap** | Screen recording | Free — https://getkap.co |
| **iMovie** | Editing (trim, stitch, speed up) | Free (bundled) |
| **Gifski** (optional) | High-quality GIF conversion | Free — `brew install gifski` |
| MacBook Pro 14" Retina | Recording screen | — |

**Screen choice:** Record on the MacBook Pro Retina display. The 4K external monitors produce files that are too large and hard to frame well. If the browser and terminal don't both fit comfortably, record a specific region rather than the full display — Kap's region selection makes this easy.

---

## Pre-Production Checklist

Complete all of this before touching the record button.

### 1. Create a demo Astro project

You need a clean, self-contained Astro project separate from this repo. It should:

- Have `astro-inline-review` installed and configured
- Have a real-looking page with 2–3 paragraphs of copy
- Include at least one **deliberate flaw** a reviewer would plausibly flag — this is the text Claude will fix

**Suggested flaw:** A paragraph that uses informal language, e.g.:

> "This tool is super handy for dev teams who wanna get feedback fast without jumping between loads of different apps."

The reviewer will annotate this. Claude will rephrase it to be more professional. The before/after should be **visually obvious** when you see the page refresh.

### 2. Pre-stage Claude Code

Before recording the terminal scene:

- Have Claude Code open in a new terminal window
- The MCP server should already be connected (verify with a quick `list_annotations` call off-camera)
- Pre-type (but do not submit) the prompt:

  ```
  I've left some inline review annotations on my Astro site. Please check them via the MCP tools and address each one, then mark it as addressed.
  ```

- This way the terminal scene starts with you hitting Enter, not typing

### 3. Browser setup

- Demo site running at `http://localhost:4321`
- Browser zoomed to ~110–125% so text is legible in the recording
- Only the demo tab open — close all other tabs
- No notifications, Do Not Disturb on
- Hide the menu bar and dock if recording full screen (System Settings → Dock & Menu Bar)

### 4. Kap settings

- Set recording region to cover just the browser window (or the split browser + terminal layout)
- Enable **highlight cursor** (Kap preferences)
- Set FPS to **30** for recording (smooth playback; you'll export at 15fps for GIF)
- Confirm output folder is somewhere you'll find it

---

## Script / Storyboard

Record each scene as a **separate clip**. Don't try to do it all in one take.

---

### Scene 1 — The Site (5 seconds)

**What to show:** The demo Astro site, looking like a real product. The review FAB is visible in the corner. Mouse hovers gently over it.

**Goal:** Establish context. Viewer understands this is a live website with a review tool active.

**Notes:** No action needed — just a moment to let the viewer orient.

---

### Scene 2 — Adding an Annotation (15–20 seconds)

**What to show:**

1. Mouse moves to the problematic paragraph
2. Slowly select the informal text (click and drag clearly)
3. The annotation popup appears
4. Type a concise review note — something like: `"Too informal — please rephrase for a professional audience"`
5. Click submit / hit Enter
6. The highlight appears on the text

**Goal:** Show the annotation creation flow clearly.

**Notes:** Type slowly and deliberately. Don't rush — this is the UX demo.

---

### Scene 3 — The Panel (8 seconds)

**What to show:**

1. Click the FAB to open the review panel
2. The annotation is listed with status **open**
3. Maybe scroll the panel briefly if there are multiple annotations

**Goal:** Show the annotation exists in the panel with its status.

---

### Scene 4 — Switch to Terminal (transition, 2 seconds)

**What to show:** Clean ⌘+Tab or click to bring Claude Code terminal to front.

**Notes:** A moment of transition — don't rush it.

---

### Scene 5 — Claude Code Addresses the Annotation (speed up 4–6×)

**What to show:**

1. Hit Enter to submit the pre-typed prompt
2. Claude reads the annotation via MCP (`list_annotations`)
3. Claude identifies the source file and makes the edit
4. Claude calls `add_agent_reply` and `resolve_annotation` (addressed)

**Goal:** Show the agent workflow. This scene should be **sped up** in editing — it can be 60–90 seconds of real time compressed to ~15 seconds.

**Notes:** Don't worry about it looking perfect in real time — the speed-up will smooth over any pauses.

---

### Scene 6 — Back to the Browser (transition, 2 seconds)

**What to show:** Switch back to the browser. HMR has already refreshed the page (or refresh manually if needed).

---

### Scene 7 — The Result (12 seconds)

**What to show:**

1. Pan/scroll to where the annotated text was — it now reads professionally
2. Open the review panel
3. The annotation shows status **addressed**
4. Expand the annotation to show the agent's reply
5. Hover over the highlighted text to show it now reflects the replacement

**Goal:** Payoff — the viewer sees the full loop completed.

---

### Scene 8 — Wrap-up (5 seconds)

**What to show:** Either resolve/delete the annotation, or simply show the clean panel state.

**Goal:** Tidy ending. Annotation is gone or resolved. The system is in a clean state.

---

## Editing in iMovie

### Import and assemble

1. Import all Kap-exported MP4 clips into iMovie
2. Drag them into the timeline in scene order (1 → 8)
3. Trim dead time at the start and end of each clip

### Speed up Scene 5

1. Select the terminal scene clip in the timeline
2. Click the **Speed** button in the toolbar (looks like a speedometer)
3. Drag the speed handle, or set a custom speed percentage (400–600% = 4–6× speed up)
4. iMovie will show a rabbit icon on the clip

### Add transitions (optional)

A simple **cross-dissolve** between scenes looks professional and signals the viewer that time or context has changed. Keep transitions short (0.5s).

### Titles (optional)

Consider a brief title card at the start: "astro-inline-review — review your site, fix it with AI"

### Export

**File → Share → File:**
- Resolution: 1080p
- Quality: Best
- Format: MP4

---

## GIF Export (optional)

If you want a GIF version for platforms that don't support video:

```bash
# Step 1: Extract frames from the exported MP4
ffmpeg -i demo-final.mp4 -vf fps=15,scale=1200:-1 frames/frame%04d.png

# Step 2: Convert to GIF with Gifski
gifski --fps 15 --width 1200 -o demo.gif frames/*.png
```

**Warning:** Even at 1200px wide and 15fps, a 90-second GIF will be 15–30MB. GitHub renders GIFs but they load slowly above ~5MB. Consider keeping the GIF to the highest-impact scenes only (e.g., Scene 2 + Scene 7), or skip GIF entirely and use MP4.

---

## Hosting & Embedding

### MP4 (recommended)

GitHub hosts video files attached to issues/PRs. To get a hosted URL:

1. Open any GitHub issue on your repo
2. Drag the MP4 into the comment box
3. GitHub uploads it and gives you a URL like:
   `https://github.com/user-attachments/assets/xxx/demo.mp4`
4. Use that URL in the README:

```markdown
https://github.com/user-attachments/assets/xxx/demo.mp4
```

GitHub renders this as an inline video player automatically.

### GIF (fallback)

Commit the GIF to the repo (e.g., `docs/assets/demo.gif`) and reference it:

```markdown
![Demo of astro-inline-review](docs/assets/demo.gif)
```

---

## Accessibility

Add a collapsible transcript below the video in the README:

```markdown
<details>
<summary>Video transcript</summary>

1. A live Astro site is shown with the inline review FAB visible in the corner
2. The reviewer selects informal copy and adds an annotation: *"Too informal — please rephrase for a professional audience"*
3. The review panel opens, showing the annotation with status **open**
4. In Claude Code, the agent is prompted to check and address the annotations via MCP
5. Claude reads the annotation, edits the source file, and marks the annotation as **addressed**
6. Back in the browser, the page has refreshed — the copy now reads professionally
7. The review panel shows the annotation status as **addressed** with the agent's reply
8. The annotation is resolved, leaving a clean panel

</details>
```

---

## Success Criteria

- [ ] Demo Astro project set up with `astro-inline-review` installed
- [ ] At least one deliberate copy flaw for Claude to fix
- [ ] All 8 scenes recorded as separate clips in Kap
- [ ] Clips assembled and edited in iMovie (terminal scene sped up)
- [ ] Exported as 1080p MP4
- [ ] MP4 hosted on GitHub and embedded in README
- [ ] Accessibility transcript added to README
- [ ] (Optional) GIF version exported via Gifski

---

## Tips

- **Restart the demo data** between takes: delete `inline-review.json` and restart `astro dev` for a clean state
- **Zoom your browser** to 110–125% — UI elements need to be legible in the recording
- **Do not rush** the annotation creation scene — viewers need to follow each step
- **Do multiple takes** of the tricky scenes; you can pick the best one in iMovie
- **Watch your recording** at 1x speed before editing — you'll spot dead time you didn't notice while recording
