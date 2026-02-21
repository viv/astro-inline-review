import type http from 'node:http';
import type { Connect } from 'vite';
import type { Annotation, TextAnnotation, ElementAnnotation, PageNote, ReviewStore } from '../types.js';
import { isTextAnnotation, isElementAnnotation } from '../types.js';
import { ReviewStorage } from './storage.js';

const API_PREFIX = '/__inline-review/api';

/**
 * Creates Vite dev server middleware that serves the REST API.
 *
 * Routes:
 *   GET    /annotations        — list (optional ?page= filter)
 *   POST   /annotations        — create
 *   PATCH  /annotations/:id    — update
 *   DELETE /annotations/:id    — delete
 *   GET    /page-notes         — list (optional ?page= filter)
 *   POST   /page-notes         — create
 *   PATCH  /page-notes/:id     — update
 *   DELETE /page-notes/:id     — delete
 *   GET    /export             — markdown export
 */
export function createMiddleware(storage: ReviewStorage): Connect.NextHandleFunction {
  // CORS note: This API inherits Vite's CORS configuration, which is permissive
  // by default in dev mode (server.cors: true). Any website open in the same browser
  // could potentially access these endpoints. The impact is limited to annotation
  // data on a dev-only tool — no credentials or secrets are exposed.
  return async (req, res, next) => {
    const url = req.url ?? '';
    if (!url.startsWith(API_PREFIX)) {
      return next();
    }

    const path = url.slice(API_PREFIX.length);
    const method = req.method ?? 'GET';

    // Parse query string
    const [routePath, queryString] = path.split('?');
    const params = new URLSearchParams(queryString ?? '');

    try {
      // --- Annotations ---
      if (routePath === '/annotations' && method === 'GET') {
        const store = await storage.read();
        const page = params.get('page');
        const filtered = page
          ? store.annotations.filter(a => a.pageUrl === page)
          : store.annotations;
        return sendJson(res, { ...store, annotations: filtered, pageNotes: store.pageNotes });
      }

      if (routePath === '/annotations' && method === 'POST') {
        const body = await readBody<Record<string, unknown>>(req);
        const store = await storage.read();

        const now = new Date().toISOString();
        const base = {
          id: generateId(),
          pageUrl: (body.pageUrl as string) ?? '',
          pageTitle: (body.pageTitle as string) ?? '',
          note: (body.note as string) ?? '',
          createdAt: now,
          updatedAt: now,
        };

        let annotation: Annotation;
        if (body.type === 'element') {
          annotation = {
            ...base,
            type: 'element',
            elementSelector: body.elementSelector as ElementAnnotation['elementSelector'],
          };
        } else {
          annotation = {
            ...base,
            type: 'text',
            selectedText: (body.selectedText as string) ?? '',
            range: (body.range as TextAnnotation['range']) ?? { startXPath: '', startOffset: 0, endXPath: '', endOffset: 0, selectedText: '', contextBefore: '', contextAfter: '' },
          };
        }

        store.annotations.push(annotation);
        await storage.write(store);
        return sendJson(res, annotation, 201);
      }

      const annotationMatch = routePath?.match(/^\/annotations\/([^/]+)$/);
      if (annotationMatch && method === 'PATCH') {
        const id = annotationMatch[1];
        const body = await readBody<Partial<Annotation>>(req);
        const store = await storage.read();
        const idx = store.annotations.findIndex(a => a.id === id);
        if (idx === -1) return sendError(res, 404, 'Annotation not found');
        store.annotations[idx] = {
          ...store.annotations[idx],
          note: body.note ?? store.annotations[idx].note, // Allowlist: only 'note' is mutable
          updatedAt: new Date().toISOString(),
        };
        await storage.write(store);
        return sendJson(res, store.annotations[idx]);
      }

      if (annotationMatch && method === 'DELETE') {
        const id = annotationMatch[1];
        const store = await storage.read();
        const idx = store.annotations.findIndex(a => a.id === id);
        if (idx === -1) return sendError(res, 404, 'Annotation not found');
        store.annotations.splice(idx, 1);
        await storage.write(store);
        return sendJson(res, { ok: true });
      }

      // --- Page Notes ---
      if (routePath === '/page-notes' && method === 'GET') {
        const store = await storage.read();
        const page = params.get('page');
        const filtered = page
          ? store.pageNotes.filter(n => n.pageUrl === page)
          : store.pageNotes;
        return sendJson(res, { ...store, pageNotes: filtered, annotations: store.annotations });
      }

      if (routePath === '/page-notes' && method === 'POST') {
        const body = await readBody<Partial<PageNote>>(req);
        const store = await storage.read();
        const pageNote: PageNote = {
          id: generateId(),
          pageUrl: body.pageUrl ?? '',
          pageTitle: body.pageTitle ?? '',
          note: body.note ?? '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        store.pageNotes.push(pageNote);
        await storage.write(store);
        return sendJson(res, pageNote, 201);
      }

      const pageNoteMatch = routePath?.match(/^\/page-notes\/([^/]+)$/);
      if (pageNoteMatch && method === 'PATCH') {
        const id = pageNoteMatch[1];
        const body = await readBody<Partial<PageNote>>(req);
        const store = await storage.read();
        const idx = store.pageNotes.findIndex(n => n.id === id);
        if (idx === -1) return sendError(res, 404, 'Page note not found');
        store.pageNotes[idx] = {
          ...store.pageNotes[idx],
          note: body.note ?? store.pageNotes[idx].note, // Allowlist: only 'note' is mutable
          updatedAt: new Date().toISOString(),
        };
        await storage.write(store);
        return sendJson(res, store.pageNotes[idx]);
      }

      if (pageNoteMatch && method === 'DELETE') {
        const id = pageNoteMatch[1];
        const store = await storage.read();
        const idx = store.pageNotes.findIndex(n => n.id === id);
        if (idx === -1) return sendError(res, 404, 'Page note not found');
        store.pageNotes.splice(idx, 1);
        await storage.write(store);
        return sendJson(res, { ok: true });
      }

      // --- Export ---
      if (routePath === '/export' && method === 'GET') {
        const store = await storage.read();
        const markdown = generateExport(store);
        res.writeHead(200, { 'Content-Type': 'text/markdown; charset=utf-8' });
        res.end(markdown);
        return;
      }

      // Unknown API route
      return sendError(res, 404, 'Not found');
    } catch (err) {
      if (err instanceof Error && err.message === 'Request body too large') {
        return sendError(res, 413, 'Request body too large');
      }
      const message = err instanceof Error ? err.message : 'Internal server error';
      return sendError(res, 500, message);
    }
  };
}

// --- Helpers ---

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function sendJson(res: http.ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function sendError(res: http.ServerResponse, status: number, message: string): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: message }));
}

const MAX_BODY_SIZE = 1_048_576; // 1 MB

function readBody<T>(req: Connect.IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = '';
    let aborted = false;
    req.on('data', (chunk: Buffer) => {
      if (aborted) return;
      body += chunk.toString();
      if (body.length > MAX_BODY_SIZE) {
        aborted = true;
        req.destroy();
        reject(new Error('Request body too large'));
      }
    });
    req.on('end', () => {
      if (aborted) return;
      try {
        resolve(JSON.parse(body) as T);
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function generateExport(store: ReviewStore): string {
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
        lines.push(`${i}. **"${a.selectedText}"**`);
        if (a.note) {
          lines.push(`   > ${a.note}`);
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
        lines.push(`${i}. **\`${safeSelector}\`** (\`${safePreview}\`)`);
        if (a.note) {
          lines.push(`   > ${a.note}`);
        }
        lines.push('');
        i++;
      }
    }
  }

  return lines.join('\n');
}
