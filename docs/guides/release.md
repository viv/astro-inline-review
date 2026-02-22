# Release Process

How `astro-inline-review` gets from a commit on `main` to a published npm package.

## Overview

Releases are driven by **git tags**. Pushing a `v*` tag triggers the GitHub Actions release workflow, which builds, tests, validates, publishes to npm, and creates a GitHub Release — fully automated, no manual steps after the tag push.

```
bump version in package.json
        ↓
  commit + tag
        ↓
  git push --tags
        ↓
  ┌─────────────────────────────┐
  │  GitHub Actions (release)   │
  │                             │
  │  npm ci                     │
  │  npm run build              │
  │  npm test                   │
  │  validate version ↔ tag     │
  │  npm pack                   │
  │  npm publish --provenance   │
  │  create GitHub Release      │
  └─────────────────────────────┘
        ↓
  live on npm + GitHub Releases
```

## Releasing a Version

### Prerequisites (one-time setup)

1. **npm granular access token** stored as the `NPM_TOKEN` repository secret. See [Token Setup](#npm-token-setup) below.

2. CI passing on `main`. The release workflow runs its own build and tests, but you should not tag a broken commit.

### Steps

```bash
# 1. Make sure you're on main and up to date
git checkout main && git pull

# 2. Bump version — updates package.json, package-lock.json, commits, and tags
npm version <major|minor|patch|1.0.0> -m "chore: release v%s"

# 3. Push commit and tag
git push origin main --tags
```

That's it. The release workflow takes over from here.

`npm version` does three things in one command:
- Updates `version` in `package.json` and `package-lock.json`
- Creates a git commit (message customised by `-m`)
- Creates a git tag (`v1.0.0`)

### What happens next

1. The `v*` tag push triggers `.github/workflows/release.yml`
2. Workflow installs, builds, and runs the full test suite
3. Validates that `package.json` version matches the tag (strips the `v` prefix)
4. Packs the tarball and uploads it as a build artifact
5. Publishes to npm with [provenance attestation](https://docs.npmjs.com/generating-provenance-statements)
6. Creates a GitHub Release with auto-generated release notes and the tarball attached

### If something goes wrong

If the workflow fails after tagging but before publishing:

```bash
# Delete the tag locally and remotely
git tag -d v1.0.0
git push origin :refs/tags/v1.0.0

# Fix the issue, then re-tag and push
git tag v1.0.0
git push origin main --tags
```

If the workflow fails *after* publishing to npm but before creating the GitHub Release, create the release manually from the GitHub UI — the package is already live.

## Design Decisions

### Why tag-triggered?

Tags are an explicit, auditable release intent. They integrate naturally with git history, require no manual dispatch, and produce a clean 1:1 mapping between tags and published versions. The CI workflow already validates every push to `main`, so by the time you tag a commit, it has already passed build and test.

### Why npm provenance?

[npm provenance](https://docs.npmjs.com/generating-provenance-statements) cryptographically links the published package to the exact commit, workflow run, and repository. Consumers can verify that the package was built from the claimed source code in CI — not on someone's laptop. This is a supply chain security best practice and shows a provenance badge on npmjs.com.

### Why `prepublishOnly`?

The `prepublishOnly` script in `package.json` runs `npm run build && npm test` before any `npm publish`. This is a safety net against accidental local publishes with stale `dist/` contents. The release workflow builds explicitly before publishing, so this is redundant in CI but essential protection for local mistakes.

### Why `--access public`?

The package is unscoped (`astro-inline-review`, not `@scope/astro-inline-review`). Unscoped packages default to public, but being explicit avoids surprises if the package name or scope ever changes.

### Why auto-generated release notes?

GitHub's "generate release notes" feature diffs commits between the previous tag and the new one, producing a reasonable summary without manual effort. For significant releases, you can always edit the GitHub Release afterwards to add context.

## npm Token Setup

The release workflow authenticates with npm using a **granular access token** stored as a GitHub repository secret.

### Creating the token

1. Go to [npmjs.com → Access Tokens](https://www.npmjs.com/settings/~/tokens)
2. Click **Generate New Token** → **Granular Access Token**
3. Configure:
   - **Token name**: `astro-inline-review-github-actions` (or similar)
   - **Expiration**: 90 days (maximum for read-write tokens — set a calendar reminder to rotate)
   - **Packages and scopes**: Read and Write, scoped to `astro-inline-review`
   - **Organisations**: No permissions
4. Copy the token

### Adding the secret

1. Go to the GitHub repository → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Name: `NPM_TOKEN`
4. Value: paste the token
5. Click **Add secret**

### Token rotation

Granular tokens with read-write package permissions have a maximum expiry of 90 days. When the token expires, the release workflow will fail with an authentication error. To rotate:

1. Create a new token on npmjs.com (same settings as above)
2. Update the `NPM_TOKEN` secret in GitHub repository settings
3. Delete the old token on npmjs.com

Set a calendar reminder for ~80 days after creation. The 90-day cycle is worth the trade-off — granular tokens are scoped to a single package with no org permissions, limiting blast radius if one leaks.

## Pre-release Versions

The `v*` trigger naturally supports pre-release tags like `v1.0.0-beta.1`. These will publish to the `latest` dist-tag by default. If you want pre-releases to publish under a separate dist-tag (e.g., `next`), the workflow would need a step to detect the pre-release suffix and pass `--tag next` to `npm publish`. This can be added when needed.

## Safety Checks

Multiple layers prevent bad publishes:

| Layer | What it catches |
|-------|-----------------|
| CI on every push | Build failures, test failures, type errors, audit issues |
| Version ↔ tag validation | Tagging the wrong commit, forgetting to bump |
| `prepublishOnly` script | Accidental local publish with stale build |
| npm provenance | Tampered packages, builds not from CI |
| Scoped token | Limits blast radius if token leaks |

## Related Files

- `.github/workflows/release.yml` — the release workflow
- `.github/workflows/ci.yml` — continuous integration (runs on every push/PR)
- `.github/workflows/acceptance.yml` — Playwright E2E tests
- `package.json` — version, `prepublishOnly` script, package metadata
