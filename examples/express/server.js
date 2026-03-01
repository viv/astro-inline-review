import express from 'express';
import { inlineReview } from 'review-loop/express';

const app = express();
const { apiMiddleware, clientMiddleware } = inlineReview();

app.use(apiMiddleware);
app.use(clientMiddleware);

const STYLES = `
    body { font-family: system-ui, sans-serif; max-width: 640px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; }
    h1 { margin-bottom: 0.5rem; }
    .highlight { background: #fef3c7; padding: 0.25rem 0.5rem; border-radius: 4px; }
    .card { border: 1px solid #ddd; border-radius: 8px; padding: 1rem; margin: 1rem 0; background: #fafafa; }
    footer { margin-top: 2rem; border-top: 1px solid #e5e7eb; padding-top: 1rem; color: #6b7280; font-size: 0.875rem; }
    a { color: #e94560; }`;

const SCRIPT = '<script type="module" src="/__inline-review/client.js"></script>';

app.get('/', (req, res) => {
  res.type('html').send(/* html */ `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Express Inline Review Example</title>
  <style>${STYLES}</style>
</head>
<body>
  <nav><a href="/about">Go to About Page &rarr;</a></nav>

  <h1>Express Inline Review Example</h1>

  <p>This page exists to test the <strong>review-loop</strong> Express adapter.
  Select any text to create a text annotation, or <kbd>Alt+click</kbd> an element to
  create an element annotation.</p>

  <h2>Sample Content</h2>

  <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
  incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud
  exercitation ullamco laboris.</p>

  <p class="highlight">This highlighted paragraph is useful for testing element annotations.
  Try Alt+clicking on it to annotate the entire element.</p>

  <ul>
    <li>First list item — try selecting just this text</li>
    <li>Second list item — annotations should persist across reloads</li>
    <li>Third list item — open the panel to see all annotations</li>
  </ul>

  <footer>
    <p>Footer element for additional annotation targets.</p>
  </footer>

  ${SCRIPT}
</body>
</html>`);
});

app.get('/about', (req, res) => {
  res.type('html').send(/* html */ `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>About - Express Inline Review Example</title>
  <style>${STYLES}</style>
</head>
<body>
  <nav><a href="/">&larr; Back to Home</a></nav>

  <h1>About This Project</h1>

  <p>This second page tests multi-page annotation. Annotations created here should
  appear under the <code>/about</code> URL in the panel, separate from annotations
  on the home page.</p>

  <h2>Why Multi-Page Matters</h2>
  <p>Reviewers often annotate across multiple pages of a site. Each page's annotations
  are stored with their page URL, so switching between pages shows the relevant
  annotations in context while the panel displays all annotations across pages.</p>

  <div class="card">
    <h3>Project Details</h3>
    <p>This project demonstrates the Express/Connect adapter for review-loop.
    The adapter provides <code>apiMiddleware</code> for the REST API and
    <code>clientMiddleware</code> to serve the bundled client script.</p>
  </div>

  <div class="card">
    <h3>Technical Notes</h3>
    <p>The annotation store is a single JSON file shared between both pages. The MCP
    server also reads this same file, enabling coding agents to see all annotations
    regardless of which page they were created on.</p>
  </div>

  <footer>
    <p>Express inline-review example — about page.</p>
  </footer>

  ${SCRIPT}
</body>
</html>`);
});

const port = 3000;
app.listen(port, () => {
  console.log(`Express inline-review example running at http://localhost:${port}`);
});
