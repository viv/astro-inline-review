/**
 * Client-side markdown export — clipboard wrapper.
 *
 * Markdown generation is delegated to the shared module (src/shared/export.ts)
 * which is inlined into the client bundle by tsup's noExternal setting.
 */

import { generateExport } from '../shared/export.js';
import type { ReviewStore } from './types.js';

// Re-export for consumers (e.g. tests)
export { generateExport };

/**
 * Copy markdown to clipboard and return success status.
 */
export async function exportToClipboard(store: ReviewStore): Promise<boolean> {
  const markdown = generateExport(store);

  try {
    await navigator.clipboard.writeText(markdown);
    return true;
  } catch {
    // Fallback for older browsers or non-HTTPS contexts
    try {
      const textarea = document.createElement('textarea');
      textarea.value = markdown;
      textarea.style.cssText = 'position: fixed; left: -9999px;';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch {
      return false;
    }
  }
}
