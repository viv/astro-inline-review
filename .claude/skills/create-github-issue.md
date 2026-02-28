---
name: create-github-issue
description: Create or edit a GitHub issue with properly formatted markdown. Avoids shell escaping problems with backticks and special characters.
user_invocable: true
---

# Create/Edit GitHub Issue

When creating or editing GitHub issues, **always use `--body-file`** to avoid shell escaping issues (backticks, quotes, special chars get mangled by fish/bash layers).

## Steps

1. Write the issue body to a temp file using the Write tool:
   - Path: `/tmp/gh-issue-body.md`
   - Use proper markdown with backticks, code blocks, tables, etc.

2. Create or edit the issue using `--body-file`:

**Create:**
```bash
fish -c "gh issue create --title 'issue title here' --body-file /tmp/gh-issue-body.md --label 'label1,label2'"
```

**Edit:**
```bash
fish -c "gh issue edit ISSUE_NUMBER --body-file /tmp/gh-issue-body.md"
```

## Checklist for issue content

Based on project conventions (see issue #31 for reference):

- [ ] Clear summary section
- [ ] Problem/motivation section
- [ ] Proposed changes
- [ ] Tasks section with checkboxes, grouped by category (code, tests, docs, quality gates)
- [ ] Related issues/PRs linked
- [ ] Engineering plan referenced if one exists
- [ ] Quality gates include: conventional commits, CI passing, acceptance tests, no stale references

## Never do this

```bash
# BAD — backticks and quotes will be escaped/mangled
fish -c 'gh issue create --body "Use `resolved` status..."'
```
