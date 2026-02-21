---
generated_by: Claude Opus 4.6
generation_date: 2026-02-21
model_version: claude-opus-4-6
purpose: security_review
status: draft
scope: [astro-inline-review, astro-inline-review-tests]
tags: [security, npm, supply-chain, code-review]
---

# Security Review: astro-inline-review & astro-inline-review-tests

## Executive Summary

astro-inline-review is a dev-only Astro integration that provides a text annotation overlay during `astro dev`, persisting annotations to a local JSON file via a REST API served through Vite dev server middleware. The integration ships zero bytes in production builds. astro-inline-review-tests is a separate Playwright acceptance test suite.

Overall, the security posture is good for a dev-only tool. The codebase is small (approximately 1,100 lines of source across 19 files), with no runtime dependencies (all dependencies are devDependencies or peerDependencies), clean git history, and no secrets or credentials. The attack surface is constrained to `localhost` during development. I found no critical or high-severity issues. There are several medium and low severity findings related to request body handling, prototype pollution via object spread in the PATCH endpoint, and the use of `innerHTML` with hardcoded strings. Most are low-risk given the dev-only context but worth addressing before wider adoption.

## Findings Table

| # | Severity | Category | Description | Recommendation |
|---|----------|----------|-------------|----------------|
| 1 | Medium | DoS | No request body size limit on API endpoints | Add a body size limit to `readBody()` |
| 2 | Medium | Injection | PATCH endpoint object spread allows field injection | Allowlist updatable fields in PATCH handlers |
| 3 | Low | XSS | `innerHTML` used with hardcoded SVG and static strings | Acceptable as-is; document the pattern |
| 4 | Low | Path Traversal | `storagePath` option passed directly to `resolve()` | Document that this option is trusted developer input |
| 5 | Low | Information Disclosure | Error messages from catch blocks forwarded to client | Sanitise error messages in 500 responses |
| 6 | Low | ID Predictability | `generateId()` uses `Date.now()` + `Math.random()` | Acceptable for dev-only; consider `crypto.randomUUID()` |
| 7 | Informational | Shadow DOM | Open Shadow DOM (`mode: 'open'`) is inspectable | Expected for dev tools; not a concern |
| 8 | Informational | npm Package | `.npmignore` not present, but `"files"` field is correct | No action needed |
| 9 | Informational | Stale Data | `inline-review.json` checked into tests repo `.git` | Already in `.gitignore`; committed copy is test fixture data |
| 10 | Informational | `textContent` | User-supplied annotation text rendered via `textContent` (not `innerHTML`) | Good practice; no action needed |

## Detailed Findings

### 1. No Request Body Size Limit (Medium)

**Location:** `/Users/matthewvivian/Documents/code/cpd/astro-inline-review/src/server/middleware.ts` lines 178-191

The `readBody()` function accumulates request body chunks into a string with no upper bound:

```typescript
function readBody<T>(req: Connect.IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body) as T);
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}
```

A malicious request with a multi-gigabyte body would cause the dev server to exhaust memory. Since the API only listens on localhost via Vite's dev server middleware, exploitation requires local access or a compromised browser extension making requests to localhost. The risk is low in practice, but a simple fix makes it robust.

**Recommendation:** Add a body size limit (e.g. 1 MB) and reject requests that exceed it:

```typescript
const MAX_BODY_SIZE = 1_048_576; // 1 MB
req.on('data', (chunk: Buffer) => {
  body += chunk.toString();
  if (body.length > MAX_BODY_SIZE) {
    reject(new Error('Request body too large'));
    req.destroy();
  }
});
```

### 2. PATCH Endpoint Field Injection via Object Spread (Medium)

**Location:** `/Users/matthewvivian/Documents/code/cpd/astro-inline-review/src/server/middleware.ts` lines 71-78, 124-129

The PATCH handlers use object spread to merge the request body into the existing record:

```typescript
store.annotations[idx] = {
  ...store.annotations[idx],
  ...body,
  id: store.annotations[idx].id, // Prevent ID change
  updatedAt: new Date().toISOString(),
};
```

While `id` and `updatedAt` are explicitly pinned, the spread allows an attacker to inject arbitrary fields (e.g. `__proto__`, `constructor`, `toString`, or simply extra data fields like `pageUrl`, `selectedText`, `createdAt`) into the stored object. In JavaScript, `{ ...__proto__: ... }` in an object literal does not actually pollute the prototype chain (it creates a regular property), so this is not a true prototype pollution vulnerability. However, it does allow mutation of fields that should be immutable (like `createdAt`, `pageUrl`, `selectedText`) and injection of unexpected fields into the JSON store.

**Recommendation:** Allowlist the fields that can be updated via PATCH. For annotations, only `note` should be updatable. For page notes, only `note` should be updatable:

```typescript
store.annotations[idx] = {
  ...store.annotations[idx],
  note: body.note ?? store.annotations[idx].note,
  updatedAt: new Date().toISOString(),
};
```

### 3. innerHTML Usage with Hardcoded Content (Low)

**Location:** `/Users/matthewvivian/Documents/code/cpd/astro-inline-review/src/client/ui/fab.ts` lines 27, 39; `/Users/matthewvivian/Documents/code/cpd/astro-inline-review/src/client/ui/panel.ts` lines 163, 177, 215, 242, 398

Several locations use `innerHTML` assignments:

- **fab.ts:** `button.innerHTML = PENCIL_ICON` and `button.innerHTML = isOpen ? PLUS_ICON : PENCIL_ICON` - These set innerHTML from hardcoded string constants (`PENCIL_ICON`, `PLUS_ICON`) defined at the module scope. The SVG content never includes user input. Safe.

- **panel.ts:** `content.innerHTML = ''` - Used to clear the container before re-rendering. Safe (empty string).

- **panel.ts:** `content.innerHTML = '<div class="air-panel__empty">...'` - Static HTML strings with no user data interpolation. Safe.

- **panel.ts:** `item.innerHTML = ''` - Used to clear the item before replacing with an edit form. Safe.

All `innerHTML` usages are either clearing containers or injecting hardcoded strings. No user-supplied data flows into any `innerHTML` call. User-supplied text (annotation text, notes) is consistently set via `textContent`, which is the correct pattern.

**Assessment:** No XSS risk. The codebase correctly uses `textContent` for user data and `innerHTML` only for static content. No action needed, but worth noting for future maintainers.

### 4. Storage Path Traversal (Low)

**Location:** `/Users/matthewvivian/Documents/code/cpd/astro-inline-review/src/index.ts` lines 23-25

```typescript
const storagePath = options.storagePath
  ? resolve(options.storagePath)
  : resolve(config.root instanceof URL ? config.root.pathname : String(config.root), 'inline-review.json');
```

The `storagePath` option is passed directly to `resolve()`, which allows paths like `../../etc/sensitive-file` or absolute paths. However, this option is configured in `astro.config.mjs` by the developer, not by end users. It is the same trust level as the Astro config itself. The storage file is only read and written via the `ReviewStorage` class, which always writes valid JSON.

**Assessment:** Not a vulnerability, as the input comes from a trusted source (developer config). A path traversal attack would require the developer to misconfigure their own project. No action needed, but could add a comment documenting the trust assumption.

### 5. Error Message Information Disclosure (Low)

**Location:** `/Users/matthewvivian/Documents/code/cpd/astro-inline-review/src/server/middleware.ts` lines 155-158

```typescript
catch (err) {
  const message = err instanceof Error ? err.message : 'Internal server error';
  return sendError(res, 500, message);
}
```

Internal error messages (e.g. from filesystem errors) are forwarded to the client. On localhost during development, this is actually helpful for debugging. In a production context this would be a concern, but the integration is dev-only by design and the API is not reachable in production builds.

**Assessment:** Acceptable for dev tooling. The error messages are useful for debugging during development.

### 6. ID Generation Predictability (Low)

**Location:** `/Users/matthewvivian/Documents/code/cpd/astro-inline-review/src/server/middleware.ts` lines 164-166

```typescript
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
```

IDs are generated from `Date.now()` (predictable) and `Math.random()` (not cryptographically secure). For a dev-only tool where IDs are only used to correlate annotations in a local JSON file, this is perfectly adequate. There is no authentication or authorisation system where ID prediction would enable an attack.

**Assessment:** Acceptable. If the tool ever becomes multi-user, switch to `crypto.randomUUID()`.

### 7. Open Shadow DOM (Informational)

**Location:** `/Users/matthewvivian/Documents/code/cpd/astro-inline-review/src/client/ui/host.ts` line 21

```typescript
const shadow = host.attachShadow({ mode: 'open' });
```

The Shadow DOM is created with `mode: 'open'`, meaning any script on the page can access the shadow root via `element.shadowRoot`. For a dev tool, this is the correct choice - it allows Playwright tests to query elements inside the shadow DOM and enables debugging. Closed shadow DOM would add complexity without meaningful security benefit (it can still be circumvented by determined attackers).

**Assessment:** Correct choice for a dev tool. No action needed.

### 8. npm Package Scope (Informational)

**Location:** `/Users/matthewvivian/Documents/code/cpd/astro-inline-review/package.json` lines 15-17

```json
"files": [
  "dist"
]
```

The `"files"` field correctly limits the published package to only the `dist/` directory. Verified via `npm pack --dry-run`:

- `dist/client.js` (47.5 KB) - bundled client code
- `dist/client.js.map` (94.7 KB) - source map
- `dist/index.js` (9.5 KB) - server integration
- `dist/index.js.map` (20.3 KB) - source map
- `dist/index.d.ts` (623 B) - type declarations
- `LICENSE`, `README.md`, `package.json` (always included by npm)

No source files, tests, docs, assets, or configuration files are included. There is no `.npmignore` file, but this is not needed because the `"files"` field serves the same purpose (and is the preferred approach).

**Assessment:** Good. The published package contains only what it should.

**Additional note:** Source maps (`*.js.map`) are included in the published package. These map back to the original TypeScript source, which is not a security concern for an open-source MIT-licensed project. If source exposure were a concern, the maps could be excluded.

### 9. Committed inline-review.json (Informational)

**Location:** `/Users/matthewvivian/Documents/code/cpd/astro-inline-review-tests/fixture/inline-review.json`

The test fixture contains an `inline-review.json` file that is committed to the repository. It contains only test fixture data (a single annotation for "dynamically added after page load" on the home page). The file is listed in `.gitignore` but was committed before the ignore rule was added (or the fixture copy is outside the ignore pattern).

Reviewing the `.gitignore`:
```
fixture/inline-review.json
inline-review.json
```

The ignore rules are correct. The committed file appears to be an intentional test fixture (the tests clean it up before each run). It contains no sensitive data.

**Assessment:** No concern. The file contains only synthetic test data.

### 10. User Data Rendering Safety (Informational, Positive)

Throughout the client codebase, user-supplied content (annotation text, notes, page titles) is consistently rendered using `textContent` assignments rather than `innerHTML`:

- `panel.ts` line 272: `text.textContent = '"${truncated}"'`
- `panel.ts` line 279: `note.textContent = annotation.note`
- `panel.ts` line 296: `noteText.textContent = note.note`
- `popup.ts` lines 66-67: `selectedTextPreview.textContent = truncated`
- `fab.ts` line 32: `badge.textContent = '0'`
- `toast.ts` line 24: `toastEl.textContent = message`

This correctly prevents XSS even if annotations contain HTML or script content. The client API (`api.ts` line 22) also uses `encodeURIComponent` for query parameters, preventing injection in URLs.

**Assessment:** Well-implemented. No action needed.

## Additional Security Checks

### Secrets and Credentials

- **No `.env` files** found in either repository
- **No API keys, tokens, or credentials** found anywhere in the source code
- **No `.npmrc`** files containing auth tokens
- **Git history clean**: No deleted files in git history, no sensitive data previously committed and removed. Both repos have short, clean histories (9 commits in the main repo, 5 in the test repo)

### npm Scripts

```json
"scripts": {
  "build": "tsup",
  "dev": "tsup --watch",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

No `preinstall`, `postinstall`, `prepare`, or lifecycle scripts that could execute arbitrary code on package installation. Clean.

### Dependencies

All dependencies are `devDependencies`:
- `@types/node@25.3.0` - TypeScript type definitions
- `astro@5.17.3` - Astro framework (peer dependency)
- `happy-dom@20.6.3` - DOM implementation for testing
- `tsup@8.5.1` - Build tool
- `typescript@5.9.3` - TypeScript compiler
- `vitest@3.2.4` - Test framework

The package has **zero runtime dependencies**. The only `peerDependency` is `astro ^5.0.0`. The client bundle (`dist/client.js`) is fully self-contained with all code bundled in via `noExternal: [/.*/]` in the tsup config.

`npm audit` reports **0 vulnerabilities**.

### Test Repository

The test repo (`astro-inline-review-tests`) is marked `"private": true` with a single dev dependency (`@playwright/test@^1.50.0`). The `playwright.config.ts` uses only `localhost:4321` - no external URLs or hardcoded credentials. The fixture site contains only synthetic test content with no real personal data. The `.gitignore` correctly excludes `node_modules/`, `test-results/`, `playwright-report/`, and `inline-review.json`.

### Build Configuration

The `tsup.config.ts` defines two build targets:
1. Server integration: ESM, with external Node APIs
2. Client bundle: ESM, browser platform, everything bundled (`noExternal: [/.*/]`)

No custom build plugins, no code generation, no file system access during build beyond what tsup normally does. The `vitest.config.ts` splits tests into client (happy-dom) and server (node) environments - standard configuration with nothing unusual.

### Production Safety

The integration guard in `src/index.ts` line 20 (`if (command !== 'dev') return;`) correctly prevents any code injection during `astro build` or `astro preview`. The test suite includes dedicated production safety tests (`12-production-safety.spec.ts`) that build the fixture site and verify zero traces of the integration in the output HTML and JS bundles.

## Positive Observations

1. **Strong production isolation.** The `if (command !== 'dev') return` guard is the first check in the integration hook. Production safety is tested explicitly with build output verification.

2. **Consistent XSS prevention.** User-supplied text is always rendered via `textContent`, never `innerHTML`. The codebase demonstrates good awareness of DOM injection risks.

3. **Shadow DOM isolation.** All UI lives inside a Shadow DOM, preventing style and DOM conflicts with the host site. The `:host { all: initial; }` reset ensures complete style isolation.

4. **Correct npm publishing scope.** The `"files": ["dist"]` field ensures only built artefacts are published. Verified empirically via `npm pack --dry-run`.

5. **Zero runtime dependencies.** The package has no `dependencies` - only `peerDependencies` (astro) and `devDependencies`. This minimises supply chain risk for consumers.

6. **Clean git history.** No secrets, no force-pushes, no deleted sensitive files. Short commit history is easy to audit.

7. **Write queue for file persistence.** The `ReviewStorage` class serialises concurrent writes through a promise queue, preventing file corruption from rapid operations.

8. **Schema validation on read.** The storage reader validates version number and array shapes before accepting data, gracefully falling back to an empty store on corruption.

9. **ID immutability on PATCH.** The PATCH endpoints explicitly pin the `id` field to prevent ID mutation via the request body.

10. **Comprehensive test coverage.** Both unit tests (vitest) and acceptance tests (Playwright) cover the major functionality, including edge cases, error handling, and production safety.

## Recommendations

### Should Fix (before wider distribution)

1. **Add a request body size limit** to `readBody()`. A 1 MB cap is more than sufficient for annotation data and prevents memory exhaustion from malformed requests. (Finding #1)

2. **Allowlist PATCH fields** instead of using object spread. Only `note` needs to be updatable on both annotations and page notes. This prevents field injection and simplifies the data flow. (Finding #2)

### Nice to Have

3. **Consider `crypto.randomUUID()`** for ID generation. It is available in Node 19+ and modern browsers, produces guaranteed-unique IDs, and removes any theoretical predictability concern. Not urgent for a dev-only tool.

4. **Document the `storagePath` trust assumption** with a code comment noting that this option is developer-configured and not user-facing.

5. **Consider adding a `Content-Security-Policy`** header to API responses (even just `default-src 'none'`) as defence in depth, though the API returns JSON/markdown content that browsers would not execute.

## Conclusion

The codebase is well-structured, cleanly separated between server and client concerns, and demonstrates good security awareness (textContent over innerHTML, Shadow DOM isolation, production guards, write queue serialisation). The two medium-severity findings (body size limit and PATCH field allowlisting) are straightforward fixes that would close the remaining gaps. For a dev-only tool running on localhost, the overall risk profile is low.
