# Release Process

How `review-loop` gets from a commit on `main` to a published npm package.

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

1. **npm Trusted Publisher** configured on npmjs.com. See [Trusted Publisher Setup](#trusted-publisher-setup) below.

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
5. Publishes to npm with [provenance attestation](https://docs.npmjs.com/generating-provenance-statements) via OIDC trusted publisher
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

### Why OIDC trusted publishing?

OIDC replaces long-lived npm tokens with short-lived credentials cryptographically bound to a specific workflow run. No tokens to rotate, no secrets to manage, and no risk of a leaked token granting persistent publish access. See [npm Trusted Publishers docs](https://docs.npmjs.com/trusted-publishers/).

### Why npm provenance?

[npm provenance](https://docs.npmjs.com/generating-provenance-statements) cryptographically links the published package to the exact commit, workflow run, and repository. Consumers can verify that the package was built from the claimed source code in CI — not on someone's laptop. With OIDC, provenance and publish auth use the same identity token.

### Why `prepublishOnly`?

The `prepublishOnly` script in `package.json` runs `npm run build && npm test` before any `npm publish`. This is a safety net against accidental local publishes with stale `dist/` contents. The release workflow builds explicitly before publishing, so this is redundant in CI but essential protection for local mistakes.

### Why `--access public`?

The package is unscoped (`review-loop`, not `@scope/review-loop`). Unscoped packages default to public, but being explicit avoids surprises if the package name or scope ever changes.

### Why auto-generated release notes?

GitHub's "generate release notes" feature diffs commits between the previous tag and the new one, producing a reasonable summary without manual effort. For significant releases, you can always edit the GitHub Release afterwards to add context.

## Trusted Publisher Setup

The release workflow authenticates with npm using **OIDC trusted publishing** — no tokens or secrets required.

### Configuring on npmjs.com

1. Go to [npmjs.com → Packages → review-loop → Settings](https://www.npmjs.com/package/review-loop/access)
2. Under **Trusted Publishers**, click **Add trusted publisher**
3. Select **GitHub Actions** and configure:
   - **Repository owner**: `viv`
   - **Repository name**: `review-loop`
   - **Workflow filename**: `release.yml`
   - **Environment**: _(leave blank)_
4. Save

> **Important**: npm does not validate the configuration at save time. Typos in the workflow filename will only surface as auth errors at publish time. The filename must match exactly, including the `.yml` extension.

### How it works

During a release workflow run, GitHub Actions mints a short-lived OIDC identity token attesting "this token was issued for workflow `release.yml` in repo `viv/review-loop`". The npm CLI (v11.5.1+, upgraded in the workflow) exchanges that token for a short-lived publish credential scoped to that single invocation. No secrets are stored anywhere.

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
| OIDC trusted publisher | Credentials bound to this repo and workflow — no token to leak or rotate |

## Related Files

- `.github/workflows/release.yml` — the release workflow
- `.github/workflows/ci.yml` — continuous integration (runs on every push/PR)
- `.github/workflows/acceptance.yml` — Playwright E2E tests
- `package.json` — version, `prepublishOnly` script, package metadata
