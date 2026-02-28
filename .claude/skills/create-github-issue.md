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

## Issue structure

Every issue should include:

- **Summary** — what and why, concisely
- **Problem/motivation** — context for the change
- **Proposed changes** — what will be done
- **Tasks** — checkboxes grouped by category (code, tests, docs, quality gates)
- **Related** — linked issues, PRs, engineering plans, reviews

## Quality gates

Every issue's task list must include these standard quality gates:

```markdown
### Quality gates

- [ ] Engineering plan created as a markdown document
- [ ] Engineering plan maintained and kept up to date throughout implementation
- [ ] Specification updated (`docs/spec/specification.md`)
- [ ] Independent review carried out and markdown report added to `docs/reviews/`
- [ ] Findings of the independent review assessed and addressed
- [ ] All commits follow conventional commit format (no co-authored-by tagline)
- [ ] All affected documentation updated (except point-in-time documents such as reviews)
- [ ] CI passes on the pull request
- [ ] Acceptance tests pass
```

Add feature-specific quality gates as needed, for example:
- `[ ] MCP tools tested end-to-end` (for MCP changes)
- `[ ] Backward compatibility verified with existing data` (for schema changes)
- `[ ] Scenario tests updated in `astro-inline-review-tests`` (for UI/behaviour changes)
- `[ ] No references to removed concept remain in source code` (for removal refactors)

## Never do this

```bash
# BAD — backticks and quotes will be escaped/mangled
fish -c 'gh issue create --body "Use `resolved` status..."'
```
