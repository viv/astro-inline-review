import type http from 'node:http';
import { randomUUID } from 'node:crypto';
import type { Connect } from 'vite';
import type { Annotation, TextAnnotation, ElementAnnotation, PageNote } from '../types.js';
import { isTextAnnotation } from '../types.js';
import { ReviewStorage } from './storage.js';
import { generateExport } from '../shared/export.js';

const API_PREFIX = '/__inline-review/api';

class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
  }
}

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
  }
}

/**
 * Validates the request body for POST /annotations.
 * Returns a descriptive error message, or null if valid.
 */
function validateAnnotationBody(body: Record<string, unknown>): string | null {
  if (body.type !== 'text' && body.type !== 'element') {
    return 'Invalid or missing "type": must be "text" or "element"';
  }
  if (typeof body.pageUrl !== 'string') {
    return 'Invalid or missing "pageUrl": must be a string';
  }
  if (typeof body.note !== 'string') {
    return 'Invalid or missing "note": must be a string';
  }

  if (body.type === 'text') {
    if (typeof body.selectedText !== 'string') {
      return 'Invalid or missing "selectedText": must be a string when type is "text"';
    }
    if (typeof body.range !== 'object' || body.range === null || Array.isArray(body.range)) {
      return 'Invalid or missing "range": must be an object when type is "text"';
    }
  }

  if (body.type === 'element') {
    if (typeof body.elementSelector !== 'object' || body.elementSelector === null || Array.isArray(body.elementSelector)) {
      return 'Invalid or missing "elementSelector": must be an object when type is "element"';
    }
  }

  return null;
}

/**
 * Validates the request body for POST /page-notes.
 * Returns a descriptive error message, or null if valid.
 */
function validatePageNoteBody(body: Record<string, unknown>): string | null {
  if (typeof body.pageUrl !== 'string') {
    return 'Invalid or missing "pageUrl": must be a string';
  }
  if (typeof body.note !== 'string') {
    return 'Invalid or missing "note": must be a string';
  }
  return null;
}

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

        const annotationError = validateAnnotationBody(body);
        if (annotationError) throw new ValidationError(annotationError);

        let annotation!: Annotation;
        await storage.mutate(store => {
          const now = new Date().toISOString();
          const base = {
            id: randomUUID(),
            pageUrl: (body.pageUrl as string) ?? '',
            pageTitle: (body.pageTitle as string) ?? '',
            note: (body.note as string) ?? '',
            createdAt: now,
            updatedAt: now,
          };

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
          return store;
        });

        return sendJson(res, annotation, 201);
      }

      const annotationMatch = routePath?.match(/^\/annotations\/([^/]+)$/);
      if (annotationMatch && method === 'PATCH') {
        const id = annotationMatch[1];
        const body = await readBody<Partial<Annotation> & { replacedText?: string }>(req);

        if (typeof body.replacedText === 'string' && !body.replacedText.trim()) {
          throw new ValidationError('replacedText must not be empty');
        }

        let updated!: Annotation;
        await storage.mutate(store => {
          const idx = store.annotations.findIndex(a => a.id === id);
          if (idx === -1) throw new NotFoundError('Annotation not found');
          const existing = store.annotations[idx];
          store.annotations[idx] = {
            ...existing,
            note: body.note ?? existing.note,
            // Allow replacedText on text annotations only
            ...(isTextAnnotation(existing) && typeof body.replacedText === 'string'
              ? { replacedText: body.replacedText }
              : {}),
            updatedAt: new Date().toISOString(),
          };
          updated = store.annotations[idx];
          return store;
        });

        return sendJson(res, updated);
      }

      if (annotationMatch && method === 'DELETE') {
        const id = annotationMatch[1];

        await storage.mutate(store => {
          const idx = store.annotations.findIndex(a => a.id === id);
          if (idx === -1) throw new NotFoundError('Annotation not found');
          store.annotations.splice(idx, 1);
          return store;
        });

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
        const body = await readBody<Record<string, unknown>>(req);

        const pageNoteError = validatePageNoteBody(body);
        if (pageNoteError) throw new ValidationError(pageNoteError);

        let pageNote!: PageNote;
        await storage.mutate(store => {
          pageNote = {
            id: randomUUID(),
            pageUrl: body.pageUrl as string,
            pageTitle: (body.pageTitle as string) ?? '',
            note: body.note as string,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          store.pageNotes.push(pageNote);
          return store;
        });

        return sendJson(res, pageNote, 201);
      }

      const pageNoteMatch = routePath?.match(/^\/page-notes\/([^/]+)$/);
      if (pageNoteMatch && method === 'PATCH') {
        const id = pageNoteMatch[1];
        const body = await readBody<Partial<PageNote>>(req);

        let updated!: PageNote;
        await storage.mutate(store => {
          const idx = store.pageNotes.findIndex(n => n.id === id);
          if (idx === -1) throw new NotFoundError('Page note not found');
          store.pageNotes[idx] = {
            ...store.pageNotes[idx],
            note: body.note ?? store.pageNotes[idx].note, // Allowlist: only 'note' is mutable
            updatedAt: new Date().toISOString(),
          };
          updated = store.pageNotes[idx];
          return store;
        });

        return sendJson(res, updated);
      }

      if (pageNoteMatch && method === 'DELETE') {
        const id = pageNoteMatch[1];

        await storage.mutate(store => {
          const idx = store.pageNotes.findIndex(n => n.id === id);
          if (idx === -1) throw new NotFoundError('Page note not found');
          store.pageNotes.splice(idx, 1);
          return store;
        });

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
      if (err instanceof ValidationError) {
        return sendError(res, 400, err.message);
      }
      if (err instanceof NotFoundError) {
        return sendError(res, 404, err.message);
      }
      if (err instanceof Error && err.message === 'Request body too large') {
        return sendError(res, 413, 'Request body too large');
      }
      if (err instanceof Error && err.message === 'Invalid JSON body') {
        return sendError(res, 400, 'Invalid JSON body');
      }
      const message = err instanceof Error ? err.message : 'Internal server error';
      return sendError(res, 500, message);
    }
  };
}

// --- Helpers ---

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

