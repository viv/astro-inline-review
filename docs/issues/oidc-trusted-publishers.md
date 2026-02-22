# Migrate npm publishing from token-based auth to OIDC trusted publishers

## Problem

The release workflow (`.github/workflows/release.yml`) authenticates with npm using a granular access token stored as the `NPM_TOKEN` repository secret. This works but has operational and security downsides:

1. **Token rotation burden**: Granular read-write tokens have a maximum 90-day expiry. Forgetting to rotate silently breaks releases until someone notices the workflow failure and manually creates + updates the secret.
2. **Secret sprawl**: The token exists in two places (npmjs.com and GitHub Secrets) and must be kept in sync. Anyone with repo admin access can read the secret reference, and a leaked token grants publish access until it expires or is revoked.
3. **No identity binding**: The token authenticates _a user_, not _a specific workflow run_. If the token leaks, any machine anywhere can publish to npm — there's no way to restrict it to "only from this repo's release workflow".

npm now supports [Trusted Publishers](https://docs.npmjs.com/trusted-publishers/) using OpenID Connect (OIDC), which went GA on July 31, 2025. This replaces long-lived tokens with short-lived, cryptographically-signed credentials scoped to a specific repository and workflow — eliminating all three problems above.

## How OIDC trusted publishing works

1. You configure a **trust relationship** on npmjs.com, specifying your GitHub org/user, repository name, workflow filename, and optionally a GitHub Actions environment.
2. During a workflow run, GitHub Actions mints a short-lived **OIDC identity token** that attests "this token was issued for workflow `release.yml` in repo `viv/astro-inline-review`".
3. The npm CLI (v11.5.1+) automatically detects the OIDC environment and exchanges the identity token for a short-lived npm publish token — no secrets needed.
4. The publish token is scoped to that single `npm publish` invocation and expires immediately after.

## Proposed Solution

### 1. Configure trusted publisher on npmjs.com

1. Go to [npmjs.com → Packages → astro-inline-review → Settings](https://www.npmjs.com/package/astro-inline-review/access)
2. Under **Trusted Publishers**, click **Add trusted publisher**
3. Select **GitHub Actions** and configure:
   - **Repository owner**: `viv`
   - **Repository name**: `astro-inline-review`
   - **Workflow filename**: `release.yml`
   - **Environment**: _(leave blank unless we add a GitHub Actions environment later)_
4. Save

> **Important**: npm does not validate the configuration at save time. Typos in the workflow filename will only surface as auth errors at publish time. Double-check that the filename matches exactly, including the `.yml` extension.

### 2. Update the release workflow

The current workflow already has `id-token: write` permission (for provenance). The only change needed is removing the `NODE_AUTH_TOKEN` env var and ensuring the npm CLI version supports OIDC.

```yaml
# BEFORE
      - name: Publish to npm
        run: npm publish --provenance --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

# AFTER
      - name: Publish to npm
        run: npm publish --provenance --access public
        # Authentication via OIDC trusted publisher — no token needed.
        # Requires npm >= 11.5.1 and id-token: write permission (already set).
```

Additionally, ensure the npm CLI version is sufficient. Node 22 ships with npm 10.x, which does **not** support OIDC. Options:

- **Option A (preferred)**: Pin a specific npm version in the workflow:
  ```yaml
      - name: Upgrade npm
        run: npm install -g npm@latest
  ```
- **Option B**: Switch to Node 23+ which ships with npm 11.x+

### 3. Update release documentation

Update `docs/guides/release.md`:

- Remove the entire **npm Token Setup** section (token creation, adding the secret, token rotation)
- Remove references to the 90-day rotation cycle
- Add a new section documenting the trusted publisher setup and how it works
- Update the **Safety Checks** table to replace "Scoped token" with "OIDC trusted publisher"
- Update the **Prerequisites** section to reference the trusted publisher instead of `NPM_TOKEN`

### 4. Update CLAUDE.md

Update the Releasing section to remove mention of `NPM_TOKEN` secret and reference the trusted publisher approach.

### 5. Clean up the old secret

After verifying the first OIDC-based release succeeds:

1. Delete the `NPM_TOKEN` secret from GitHub repository settings
2. Revoke the token on npmjs.com

## Why this approach

- **Zero ongoing maintenance**: No tokens to rotate, no secrets to manage, no calendar reminders
- **Stronger security**: Credentials are short-lived, cryptographically bound to a specific workflow run, and cannot be exfiltrated or reused
- **Minimal workflow change**: The `id-token: write` permission is already in place; the only code change is removing the `NODE_AUTH_TOKEN` env var and ensuring npm version compatibility
- **Provenance preserved**: `--provenance` continues to work (and is in fact strengthened by OIDC — the provenance attestation and publish auth use the same identity)
- **Backward-compatible rollback**: If anything goes wrong, re-adding `NODE_AUTH_TOKEN` restores the old behaviour immediately

## Caveats

- **npm CLI version**: Requires npm >= 11.5.1. Node 22's bundled npm (10.x) is too old. The workflow must explicitly upgrade npm or move to a newer Node version.
- **Cloud runners only**: Trusted publishing currently supports only GitHub-hosted runners (`ubuntu-latest` etc.). Self-hosted runner support is planned for a future release. This is not a concern for us — we use `ubuntu-latest`.
- **One publisher per package**: Each npm package can only have one trusted publisher configured at a time. This is fine for our single-workflow setup.
- **New package bootstrap**: Trusted publishers cannot be configured until the package exists on npm. Since `astro-inline-review` is already published, this is not a concern.
- **Validation is deferred**: npm does not validate the trusted publisher configuration when you save it. Errors (e.g., typo in workflow filename) only appear when you attempt to publish.

## Tasks

- [ ] Configure trusted publisher on npmjs.com for `astro-inline-review`
- [ ] Determine npm CLI version strategy (upgrade npm in workflow vs. bump Node version)
- [ ] Update `.github/workflows/release.yml` to remove `NODE_AUTH_TOKEN` and add npm version upgrade step
- [ ] Update `docs/guides/release.md` to document the new approach and remove token rotation guidance
- [ ] Update `CLAUDE.md` releasing section to remove `NPM_TOKEN` reference
- [ ] Test by tagging and pushing a release (or dry-run the workflow with `act` or a pre-release tag)
- [ ] After successful OIDC publish, delete `NPM_TOKEN` from GitHub Secrets
- [ ] Revoke the old granular access token on npmjs.com
- [ ] All commits must follow the style already established by the repo (conventional commits, no authored by tagline)
