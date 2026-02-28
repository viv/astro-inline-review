---
name: pull-request
description: Create a pull request with properly formatted description, test plan, and final completeness verification of both the PR and any linked issue.
user_invocable: true
---

# Pull Request

Create a pull request for the current branch following project conventions, then verify completeness.

## Process

### 1. Assess the branch

Run these in parallel:
- `fish -c "git status"` (never use `-uall`)
- `fish -c "git log main..HEAD --oneline"` to see all commits being PR'd
- `fish -c "git diff main...HEAD --stat"` to see scope of changes
- `fish -c "git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null"` to check remote tracking

If the branch isn't pushed, push it:
```bash
fish -c "git push -u origin HEAD"
```

### 2. Identify linked issue

Search commit messages for issue references (`Closes #N`, `#N`, etc.):
```bash
fish -c "git log main..HEAD --oneline | grep -oE '#[0-9]+' | sort -u"
```

If an issue is linked, read it to understand the full task list:
```bash
fish -c "gh issue view ISSUE_NUMBER"
```

### 3. Draft the PR body

Write the body to a temp file using the Write tool (never use `--body` inline — backticks and special characters get mangled by shell layers).

**Path:** `/tmp/gh-pr-body.md`

**Structure:**

```markdown
## Summary

- Bullet point explaining the main change and WHY
- Supporting detail
- Another key change

## Breaking Changes

- Only include this section if there are breaking changes
- Each breaking change with migration path

## Test plan

- [x] All NNN unit tests pass (`npm test`)
- [x] Build succeeds (`npm run build`)
- [x] Lint clean (`npm run lint`)
- [x] TypeScript compiles (`tsc --noEmit`)
- [x] Other automated checks that have been verified
- [ ] Manual verification items not yet confirmed
- [ ] Scenario tests updated in `astro-inline-review-tests` (if behaviour changes)

Closes #N
See: `docs/engineering-plans/YYYY-MM-DD-slug.md`
```

**Rules:**
- Pre-tick only items you have actually verified (ran the command, saw it pass)
- Include specific test counts (e.g., "All 463 unit tests pass")
- Include specific commands so reviewers can reproduce
- Reference engineering plans and related issues/PRs
- Add feature-specific test items as needed

### 4. Create the PR

```bash
fish -c "gh pr create --title 'type: concise description' --body-file /tmp/gh-pr-body.md"
```

**Title rules:**
- Conventional commit format: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, `test:`
- Under 70 characters
- Use em-dash (—) for subtitles if needed: `refactor: simplify status model — remove resolved`

### 5. Final verification

**ACTION REQUIRED — Tell the user what you're checking, then perform these checks:**

#### 5a. PR completeness

Read back the PR to verify the body rendered correctly:
```bash
fish -c "gh pr view PR_NUMBER --json title,body,state"
```

Check all test plan items — are any ticked that shouldn't be, or unticked that should be?

#### 5b. Issue completeness

If the PR closes an issue, read the issue and check every checkbox:
```bash
fish -c "gh issue view ISSUE_NUMBER --json body -q .body"
```

Look for unticked checkboxes (`- [ ]`). For each one:
- Has it actually been completed? If yes, tick it.
- Is it still pending? Flag it to the user.

Update the issue if checkboxes need ticking:
1. Write the updated body to `/tmp/gh-issue-body.md`
2. `fish -c "gh issue edit ISSUE_NUMBER --body-file /tmp/gh-issue-body.md"`

#### 5c. Scenario tests

If the PR changes UI behaviour, CSS, status model, MCP tools, or export format:
- Check whether scenario tests in `astro-inline-review-tests` need updating
- Check whether a "Scenario tests updated" checkbox exists on both the PR and issue
- **Flag to the user** if scenario tests appear to need updating but haven't been

#### 5d. CI status

Check CI status:
```bash
fish -c "gh pr checks PR_NUMBER"
```

If checks are still running, tell the user. If any failed, flag them.

### 6. Report to user

Summarise what was created and any outstanding items:
- PR URL
- Linked issue status (all checkboxes ticked, or list remaining)
- CI status (passing, running, or failed)
- Any manual steps the user needs to take

## Important notes

- Always use `--body-file` for PR body content (same lesson as GitHub issues)
- Never force-push unless explicitly asked
- Never push to main/master directly
- If the branch has uncommitted changes, ask the user before proceeding
- Include the `Closes #N` reference in the PR body, not just the title
- UK English throughout (behaviour, organisation, etc.)

## Two-phase output

Output any commentary or context FIRST, then output the PR URL as the very last thing. This ensures `/copy` captures just the URL if the user wants to share it.
