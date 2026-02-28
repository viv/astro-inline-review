---
name: commit
description: Stage changes and create a well-crafted git commit following project conventions. Focuses on WHY not WHAT, uses conventional commits, never adds co-authored-by lines.
user_invocable: true
---

# Commit

Create a git commit for the current changes following project conventions.

## Process

1. **Assess the changes** — run these in parallel:
   - `fish -c "git status"` (never use `-uall`)
   - `fish -c "git diff --staged"` and `fish -c "git diff"` to see all changes
   - `fish -c "git log --oneline -5"` to match recent commit style

2. **Stage files** — add specific files by name. Never use `git add -A` or `git add .` which can accidentally include sensitive files or unrelated changes. If there are untracked files that look unrelated, ask before staging.

3. **Draft the commit message** following these rules:

### Format: Conventional Commits
```
<type>: <concise subject line>

<body explaining WHY, not WHAT>
```

Types: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`, `style:`, `perf:`

### Subject line
- Concise, imperative mood
- No full stop at the end
- Under 72 characters

### Body: Focus on WHY
- Explain the **problem being solved** or requirement being met
- Explain the **reasoning** behind the approach taken
- Mention important **constraints** (backward compatibility, performance, etc.)
- The diff shows the "what" — the commit message explains the "why"
- Use UK English (e.g., "behaviour" not "behavior", "organisation" not "organization")

### References
- When changes relate to ADRs, reference them: `See: ADR-006`
- When changes relate to issues, reference them naturally in the body

### Never include
- `Co-Authored-By:` lines (any author)
- `Generated with Claude Code` or similar
- Bullet lists of what changed (the diff shows that)
- Time estimates or subjective commentary

4. **Commit** — use `fish -c` with the message inline (no heredocs in fish). For multi-line messages:
```bash
fish -c 'git commit -m "type: subject line

Body paragraph explaining why this change was made.

Additional context about constraints or reasoning."'
```

5. **Verify** — run `fish -c "git status"` after to confirm success.

## Important notes

- Commits are GPG-signed via git config. Never use `--no-gpg-sign` or `--no-verify`.
- Never amend a previous commit unless explicitly asked — always create new commits.
- If a pre-commit hook fails, fix the issue and create a NEW commit (don't amend).
- If there are no changes to commit, say so rather than creating an empty commit.

## Two-phase output

Output any commentary or context FIRST, then output ONLY the raw commit message text as the very last thing. No code fences, no labels, no surrounding text. This ensures `/copy` captures just the commit message if the user wants to commit manually.
