# CI/CD Pipeline Review — astro-inline-review

**Date**: 2026-02-22
**Reviewer**: CI/CD Pipeline Review Agent
**Scope**: All GitHub Actions workflows in `astro-inline-review` and `astro-inline-review-tests`

---

## Summary

The CI/CD setup covers the core workflow well: build, test, type-check, pack verification, acceptance tests, and release validation. The separation of concerns across three workflows in the main repo is clean and appropriate for the project's stage. However, there are several gaps around dependency management, security hardening, and missing quality gates that should be addressed before the first public release.

**Workflows reviewed:**
- `astro-inline-review/.github/workflows/ci.yml` — Build, test, type-check, audit, pack
- `astro-inline-review/.github/workflows/release.yml` — Release validation (manual)
- `astro-inline-review/.github/workflows/acceptance.yml` — Cross-repo Playwright E2E
- `astro-inline-review-tests/.github/workflows/ci.yml` — Acceptance tests (triggered from test repo)

---

## Findings

### 1. Node Version Matrix Skips Node 20 LTS

**Severity: Medium**
**File**: `ci.yml:15`

The CI matrix tests Node 18 and 22, skipping Node 20 (the current Active LTS). Given that `package.json` declares `astro: ^5.0.0` as a peer dependency, and many Astro users will be on Node 20, this is a coverage gap.

Additionally, Node 18 reached end-of-life on 2025-04-30, so it is now over 9 months past EOL.

**Recommendation:**
```yaml
node-version: [20, 22]
```

Drop Node 18 (EOL) and add Node 20 (Active LTS). If you want maximum coverage, test `[20, 22, 23]` — but at minimum, always include the current LTS.

---

### 2. No Dependency Update Automation (Dependabot/Renovate)

**Severity: High**

There is no `dependabot.yml` or `renovate.json` in either repository. Dependencies (`@modelcontextprotocol/sdk`, `zod`, `astro`, `happy-dom`, `vitest`, `tsup`, `@playwright/test`) will drift without automated PRs.

This is particularly important because:
- `@modelcontextprotocol/sdk` is a fast-moving dependency
- Security patches in transitive dependencies won't be picked up
- Astro peer dependency compatibility could silently break

**Recommendation:** Add `.github/dependabot.yml`:
```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    labels:
      - "dependencies"
    open-pull-requests-limit: 10
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
    labels:
      - "ci"
```

Do the same for the `astro-inline-review-tests` repository.

---

### 3. No Lint or Format Check in CI

**Severity: Medium**
**File**: `ci.yml`

The CI pipeline runs `tsc --noEmit` (type-checking) but there is no ESLint or Prettier step. The `package.json` does not include ESLint or Prettier as devDependencies either, which means there is no automated code style enforcement at all.

For a library that will accept contributions, this leads to inconsistent formatting and missed lint warnings.

**Recommendation:** Add ESLint and optionally Prettier, then add a CI step:
```yaml
- name: Lint
  run: npx eslint .

- name: Format check
  run: npx prettier --check .
```

---

### 4. Security Audit Only Runs on One Matrix Node

**Severity: Low**
**File**: `ci.yml:43-44`

```yaml
- name: Security audit (production deps)
  if: matrix.node-version == 22
  run: npm audit --audit-level=high --omit=dev
```

This is a reasonable optimisation — running audit once rather than per-matrix-entry — but the condition is coupled to a specific version number. If the matrix changes, this may silently stop running.

**Recommendation:** Consider extracting audit to its own job (parallel, not matrix-dependent) or using `matrix.node-version == matrix.node-version[matrix.node-version.length - 1]` pattern. Alternatively, keep the current approach but document it with a comment:
```yaml
# Audit runs only once — not needed per Node version
if: matrix.node-version == 22
```

---

### 5. Acceptance Workflow Lacks npm Cache

**Severity: Low**
**File**: `acceptance.yml:25-27`

The `setup-node` step in `acceptance.yml` does not configure `cache: npm`:

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 22
```

The main `ci.yml` correctly uses `cache: npm`. The acceptance workflow runs three separate `npm install`/`npm ci` commands (main package, test runner, fixture), so caching would provide meaningful speedup.

**Recommendation:**
```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 22
    cache: npm
    cache-dependency-path: |
      astro-inline-review/package-lock.json
      astro-inline-review-tests/package-lock.json
```

Note: The fixture uses `npm install` (not `npm ci`) which is correct since it uses a `file:` dependency, but this means it won't benefit from lockfile-based caching directly.

---

### 6. Acceptance Workflow Uses `npm install` for Fixture (Potentially Non-Deterministic)

**Severity: Low**
**File**: `acceptance.yml:38-39`

```yaml
- name: Install fixture deps
  working-directory: astro-inline-review-tests/fixture
  run: npm install
```

The fixture uses `npm install` rather than `npm ci`. This is likely intentional because the `file:../../astro-inline-review` dependency requires resolution rather than strict lockfile install. However, this means the fixture install is non-deterministic in CI.

**Recommendation:** This is acceptable given the `file:` dependency constraint, but add a comment explaining the rationale:
```yaml
# npm install (not ci) because file: dependency requires resolution
```

---

### 7. Test Repo Acceptance Workflow Duplicates Main Repo Workflow

**Severity: Info**
**File**: `astro-inline-review-tests/.github/workflows/ci.yml`

The acceptance workflow in the test repo is essentially identical to `acceptance.yml` in the main repo, with the checkout order reversed. This duplication means changes must be kept in sync manually.

This is a reasonable design choice — each repo can trigger tests independently — but should be documented.

**Recommendation:** Add a comment at the top of both files noting the intentional duplication:
```yaml
# NOTE: This workflow is intentionally mirrored in the other repo.
# Changes here should be reflected in:
#   astro-inline-review/.github/workflows/acceptance.yml
#   astro-inline-review-tests/.github/workflows/ci.yml
```

---

### 8. Release Workflow Does Not Run Full Test Suite

**Severity: Medium**
**File**: `release.yml:33-34`

The release workflow runs `npm test` but does not run the acceptance (Playwright) tests. A version could pass unit tests but fail E2E tests, and the release validation would not catch it.

**Recommendation:** Consider either:
1. Adding acceptance tests as a step in the release workflow, or
2. Making the release workflow depend on a successful acceptance test run (e.g., require the acceptance workflow to pass before release validation)
3. At minimum, document that acceptance tests should be verified separately before publishing

---

### 9. Release Workflow Has No npm Publish Step

**Severity: Info**
**File**: `release.yml`

The release workflow validates, packs, and uploads the tarball as an artifact, but does not actually publish to npm. The publish instructions are printed as a step summary for manual execution.

This is a deliberate and **good** design choice for a pre-1.0 project — manual publishing with OTP provides maximum control. However, the workflow should be prepared for eventual automation.

**Recommendation:** When ready for automated publishing, add:
```yaml
- name: Publish to npm
  if: ${{ !inputs.dry-run }}
  run: npm publish
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

With `setup-node` configured for npm registry:
```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 22
    registry-url: 'https://registry.npmjs.org'
```

---

### 10. No `.node-version` or `.nvmrc` File

**Severity: Low**

There is no `.node-version` or `.nvmrc` file to pin the expected Node version for local development. While CI specifies Node versions explicitly, contributors using `nvm` or `fnm` won't auto-switch to the correct version.

**Recommendation:** Add `.node-version`:
```
22
```

And add `engines` to `package.json`:
```json
"engines": {
  "node": ">=20"
}
```

---

### 11. No GitHub Actions Permissions Restrictions

**Severity: Medium**
**Files**: All workflow files

None of the workflows specify explicit `permissions` blocks. By default, GitHub Actions workflows receive fairly broad permissions (especially for `GITHUB_TOKEN`). Following the principle of least privilege:

**Recommendation:** Add minimal permissions to each workflow:
```yaml
permissions:
  contents: read
```

For the acceptance workflow that needs to check out a cross-repo:
```yaml
permissions:
  contents: read
```

If artifact uploads are needed (they use `actions/upload-artifact` which doesn't require extra permissions beyond defaults), `contents: read` is sufficient.

---

### 12. No Concurrency Controls

**Severity: Low**
**Files**: All workflow files

Multiple pushes to the same branch (e.g., during a rebase or rapid iteration on a PR) will trigger concurrent workflow runs. This wastes resources and can cause confusing results.

**Recommendation:** Add concurrency groups to each workflow:
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

---

### 13. No CODEOWNERS File

**Severity: Low**

There is no `.github/CODEOWNERS` file. For a single-maintainer project this is not critical, but it's good practice for setting up review requirements.

**Recommendation:** Add `.github/CODEOWNERS`:
```
* @viv
```

---

### 14. Acceptance Tests Only Run on Push to Main (Not PRs)

**Severity: Medium**
**File**: `acceptance.yml:3-6`

```yaml
on:
  push:
    branches: [main]
  workflow_dispatch:
```

The acceptance workflow only runs on push to `main` and manual dispatch — it does not run on pull requests. This means a PR can be merged without acceptance test verification. The test repo's CI does run on PRs, but only for changes to the test repo itself.

**Recommendation:** Add PR trigger:
```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:
```

---

### 15. No Timeout Configuration on Workflows

**Severity: Low**
**Files**: All workflow files

None of the workflows or jobs set `timeout-minutes`. If a test hangs or a build gets stuck, it will run for the default 6 hours.

**Recommendation:** Add timeouts:
```yaml
jobs:
  build-and-test:
    runs-on: ubuntu-latest
    timeout-minutes: 15
```

The Playwright config does have a 30s test timeout and the CI retries are configured (retries: 2 in CI), which is good, but a job-level timeout provides an additional safety net.

---

### 16. Coverage Reports Not Aggregated or Enforced

**Severity: Low**
**File**: `ci.yml:35-40`

Coverage reports are uploaded as artifacts per Node version, but there is no:
- Coverage threshold enforcement (fail CI if coverage drops)
- Coverage report aggregation or commenting on PRs
- Upload to a coverage tracking service (Codecov, Coveralls)

**Recommendation:** Add coverage thresholds to `vitest.config.ts`:
```ts
coverage: {
  thresholds: {
    lines: 80,
    functions: 80,
    branches: 70,
  }
}
```

Or add a step in CI to check coverage and fail if below threshold.

---

### 17. Version Validation Vulnerable to Injection

**Severity: Low**
**File**: `release.yml:37-44`

```yaml
- name: Validate version
  run: |
    PKG_VERSION=$(node -p "require('./package.json').version")
    echo "Expected version: ${{ inputs.version }}"
    if [ "$PKG_VERSION" != "${{ inputs.version }}" ]; then
```

The `${{ inputs.version }}` is interpolated directly into the shell script. While this is a `workflow_dispatch` input (not from untrusted PRs), it's still best practice to use environment variables for input interpolation to prevent potential injection.

**Recommendation:**
```yaml
- name: Validate version
  env:
    EXPECTED_VERSION: ${{ inputs.version }}
  run: |
    PKG_VERSION=$(node -p "require('./package.json').version")
    echo "package.json version: $PKG_VERSION"
    echo "Expected version: $EXPECTED_VERSION"
    if [ "$PKG_VERSION" != "$EXPECTED_VERSION" ]; then
      echo "::error::Version mismatch"
      exit 1
    fi
```

---

### 18. Playwright Browser Cache Not Utilised

**Severity: Low**
**Files**: `acceptance.yml:42-43`, `astro-inline-review-tests/.github/workflows/ci.yml:45`

Playwright browsers are downloaded fresh on every run (`npx playwright install --with-deps chromium`). This adds approximately 100-200MB of download per run.

**Recommendation:** Cache Playwright browsers:
```yaml
- name: Cache Playwright browsers
  uses: actions/cache@v4
  with:
    path: ~/.cache/ms-playwright
    key: playwright-${{ hashFiles('**/package-lock.json') }}

- name: Install Playwright Chromium
  run: npx playwright install --with-deps chromium
```

---

## Summary Table

| # | Finding | Severity | Effort |
|---|---------|----------|--------|
| 1 | Node matrix skips Node 20 LTS, includes EOL Node 18 | Medium | Trivial |
| 2 | No Dependabot/Renovate for dependency updates | High | Low |
| 3 | No ESLint or Prettier in CI | Medium | Medium |
| 4 | Audit condition coupled to specific Node version | Low | Trivial |
| 5 | Acceptance workflow missing npm cache | Low | Trivial |
| 6 | Fixture uses `npm install` (non-deterministic) | Low | N/A (acceptable) |
| 7 | Duplicated acceptance workflow across repos | Info | N/A (document) |
| 8 | Release workflow does not run acceptance tests | Medium | Low |
| 9 | No automated npm publish (manual by design) | Info | N/A (future) |
| 10 | No `.node-version` or `engines` field | Low | Trivial |
| 11 | No explicit `permissions` on workflows | Medium | Trivial |
| 12 | No concurrency controls | Low | Trivial |
| 13 | No CODEOWNERS file | Low | Trivial |
| 14 | Acceptance tests don't run on PRs | Medium | Trivial |
| 15 | No job timeout configuration | Low | Trivial |
| 16 | Coverage not enforced or tracked | Low | Low |
| 17 | Version input interpolated directly in shell | Low | Trivial |
| 18 | Playwright browsers not cached | Low | Low |

## Strengths

- **Clean workflow separation**: CI, release validation, and acceptance tests are well-separated into distinct workflows with clear purposes.
- **Pack verification**: The `pack-check` job ensures the package tarball is valid before release — many projects miss this.
- **Coverage uploaded as artifacts**: Even though not enforced, coverage data is captured.
- **Release safety**: Manual publish with version validation and dry-run option is appropriate for a pre-1.0 project.
- **Cross-repo testing**: The acceptance test architecture correctly builds the main package from source and tests against a realistic fixture.
- **Playwright config is CI-aware**: Uses `forbidOnly`, retry on CI, and trace on first retry — good defaults.
- **Security audit included**: Production-only `npm audit` is a good baseline check.
- **Artifact preservation**: Both coverage and Playwright reports are uploaded with `if: always()`, ensuring reports are available even on failure.

## Priority Actions

1. **Add Dependabot configuration** (High — prevents dependency drift and security gaps)
2. **Update Node matrix to [20, 22]** (Medium — drop EOL 18, add current LTS)
3. **Add `permissions: contents: read` to all workflows** (Medium — security hardening)
4. **Enable acceptance tests on PRs** (Medium — prevents merging broken changes)
5. **Add lint/format step to CI** (Medium — code quality enforcement)
6. **Add concurrency controls and timeouts** (Low — efficiency and safety)
7. **Fix version input interpolation in release workflow** (Low — security best practice)
