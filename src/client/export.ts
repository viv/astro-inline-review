/**
 * Client-side markdown export generation.
 *
 * Generates markdown on-demand from the cached store data.
 * This duplicates the server-side export logic intentionally — the client
 * version can work offline from the cache, whilst the server version
 * is the canonical export endpoint.
 */

import type { ReviewStore, Annotation, PageNote } from './types.js';
import { isTextAnnotation, isElementAnnotation } from './types.js';

/**
 * Generate markdown export from a ReviewStore.
 */
export function generateExportMarkdown(store: ReviewStore): string {
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const lines: string[] = [
    '# Inline Review — Copy Annotations',
    `Exported: ${now}`,
    '',
  ];

  // Group by page URL
  const pages = new Map<string, { title: string; annotations: Annotation[]; notes: PageNote[] }>();

  for (const a of store.annotations) {
    if (!pages.has(a.pageUrl)) {
      pages.set(a.pageUrl, { title: a.pageTitle, annotations: [], notes: [] });
    }
    pages.get(a.pageUrl)!.annotations.push(a);
  }

  for (const n of store.pageNotes) {
    if (!pages.has(n.pageUrl)) {
      pages.set(n.pageUrl, { title: n.pageTitle, annotations: [], notes: [] });
    }
    pages.get(n.pageUrl)!.notes.push(n);
  }

  if (pages.size === 0) {
    lines.push('No annotations or notes yet.');
    return lines.join('\n');
  }

  for (const [url, page] of pages) {
    lines.push('---', '');
    lines.push(`## ${url}${page.title ? ` — ${page.title}` : ''}`);
    lines.push('');

    if (page.notes.length > 0) {
      lines.push('### Page Notes');
      for (const n of page.notes) {
        lines.push(`- ${n.note}`);
      }
      lines.push('');
    }

    const textAnnotations = page.annotations.filter(isTextAnnotation);
    const elementAnnotations = page.annotations.filter(isElementAnnotation);

    if (textAnnotations.length > 0) {
      lines.push('### Text Annotations');
      let i = 1;
      for (const a of textAnnotations) {
        const resolved = a.resolvedAt ? ' ✅ [Resolved]' : '';
        lines.push(`${i}. **"${a.selectedText}"**${resolved}`);
        if (a.note) {
          lines.push(`   > ${a.note}`);
        }
        if (a.replies && a.replies.length > 0) {
          for (const reply of a.replies) {
            lines.push(`   > **Agent:** ${reply.message}`);
          }
        }
        lines.push('');
        i++;
      }
    }

    if (elementAnnotations.length > 0) {
      lines.push('### Element Annotations');
      let i = 1;
      for (const a of elementAnnotations) {
        const safeSelector = a.elementSelector.cssSelector.replace(/`/g, '\\`');
        const safePreview = a.elementSelector.outerHtmlPreview.replace(/`/g, '\\`');
        const resolved = a.resolvedAt ? ' ✅ [Resolved]' : '';
        lines.push(`${i}. **\`${safeSelector}\`** (\`${safePreview}\`)${resolved}`);
        if (a.note) {
          lines.push(`   > ${a.note}`);
        }
        if (a.replies && a.replies.length > 0) {
          for (const reply of a.replies) {
            lines.push(`   > **Agent:** ${reply.message}`);
          }
        }
        lines.push('');
        i++;
      }
    }
  }

  return lines.join('\n');
}

/**
 * Copy markdown to clipboard and return success status.
 */
export async function exportToClipboard(store: ReviewStore): Promise<boolean> {
  const markdown = generateExportMarkdown(store);

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
