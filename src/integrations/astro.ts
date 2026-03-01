import type { AstroIntegration } from 'astro';
import { resolve } from 'node:path';
import type { InlineReviewOptions } from '../types.js';
import { ReviewStorage } from '../server/storage.js';
import { createMiddleware } from '../server/middleware.js';

/**
 * review-loop — dev-only text annotation overlay.
 *
 * Injects a client-side annotation UI during `astro dev` and registers
 * Vite middleware for a REST API that persists annotations to a JSON file.
 * Ships zero bytes in production builds.
 */
export default function inlineReview(options: InlineReviewOptions = {}): AstroIntegration {
  return {
    name: 'review-loop',
    hooks: {
      'astro:config:setup': ({ command, injectScript, updateConfig, config }) => {
        // Only activate during dev — ship nothing in production
        if (command !== 'dev') return;

        // Resolve storage path relative to project root
        const storagePath = options.storagePath
          ? resolve(options.storagePath)
          : resolve(config.root instanceof URL ? config.root.pathname : String(config.root), 'inline-review.json');

        const storage = new ReviewStorage(storagePath);

        // Register Vite dev middleware for the REST API
        updateConfig({
          vite: {
            plugins: [
              {
                name: 'review-loop-middleware',
                configureServer(server) {
                  server.middlewares.use(createMiddleware(storage));

                  // Prevent Vite from triggering page reloads when the
                  // annotation store is written by an external process
                  // (e.g. MCP server). The client poller detects changes
                  // independently via the /version endpoint.
                  server.watcher.unwatch(storagePath);
                  server.watcher.unwatch(storagePath + '.tmp');
                },
              },
            ],
          },
        });

        // Inject client script on every page
        injectScript('page', `import 'review-loop/client';`);
      },
    },
  };
}
