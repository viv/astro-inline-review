import { resolve, dirname } from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type http from 'node:http';
import { ReviewStorage } from '../server/storage.js';
import { createMiddleware } from '../server/middleware.js';
import type { InlineReviewOptions } from '../types.js';
export type { InlineReviewOptions } from '../types.js';

export interface InlineReviewMiddleware {
  apiMiddleware: (req: http.IncomingMessage, res: http.ServerResponse, next: (err?: unknown) => void) => void;
  clientMiddleware: (req: http.IncomingMessage, res: http.ServerResponse, next: (err?: unknown) => void) => void;
}

/**
 * astro-inline-review Express/Connect adapter — dev-only annotation overlay.
 *
 * Returns two middleware functions for use with Express, Connect, or any
 * compatible HTTP framework. Users must manually add the client script tag
 * to their HTML template:
 *
 *   <script type="module" src="/__inline-review/client.js"></script>
 */
export function inlineReview(options: InlineReviewOptions = {}): InlineReviewMiddleware {
  const storagePath = options.storagePath
    ? resolve(options.storagePath)
    : resolve(process.cwd(), 'inline-review.json');
  const storage = new ReviewStorage(storagePath);

  // Resolve path to the bundled client.js relative to this file's location
  // At runtime this file is at dist/integrations/express.js, so ../client.js = dist/client.js
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const clientJsPath = resolve(__dirname, '..', 'client.js');

  return {
    apiMiddleware: createMiddleware(storage),
    clientMiddleware: async (req, res, next) => {
      if (req.url !== '/__inline-review/client.js') return next();
      try {
        const content = await readFile(clientJsPath, 'utf-8');
        res.writeHead(200, {
          'Content-Type': 'application/javascript',
          'Cache-Control': 'no-cache',
        });
        res.end(content);
      } catch {
        next();
      }
    },
  };
}
