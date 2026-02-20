import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createMiddleware } from '../../src/server/middleware.js';
import { ReviewStorage } from '../../src/server/storage.js';
import { createEmptyStore } from '../../src/types.js';
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { IncomingMessage, ServerResponse } from 'node:http';

const TEST_DIR = join(tmpdir(), 'air-mw-test-' + Date.now());
const TEST_FILE = join(TEST_DIR, 'mw-store.json');

/**
 * Create a minimal mock request.
 */
function mockRequest(method: string, url: string, body?: unknown): IncomingMessage {
  const chunks: Buffer[] = [];
  if (body) {
    chunks.push(Buffer.from(JSON.stringify(body)));
  }

  const req = {
    method,
    url,
    headers: { 'content-type': 'application/json' },
    on(event: string, cb: (...args: any[]) => void) {
      if (event === 'data') {
        for (const chunk of chunks) cb(chunk);
      }
      if (event === 'end') cb();
      return req;
    },
  } as unknown as IncomingMessage;

  return req;
}

/**
 * Create a minimal mock response that captures the output.
 */
function mockResponse(): ServerResponse & { _status: number; _body: string; _headers: Record<string, string> } {
  let body = '';
  let status = 200;
  const headers: Record<string, string> = {};

  const res = {
    _status: status,
    _body: body,
    _headers: headers,
    writeHead(s: number, h?: Record<string, string>) {
      res._status = s;
      if (h) Object.assign(res._headers, h);
    },
    end(data?: string) {
      if (data) res._body = data;
    },
  } as any;

  return res;
}

describe('middleware', () => {
  let storage: ReviewStorage;
  let middleware: ReturnType<typeof createMiddleware>;

  beforeEach(() => {
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }
    if (existsSync(TEST_FILE)) {
      unlinkSync(TEST_FILE);
    }
    storage = new ReviewStorage(TEST_FILE);
    middleware = createMiddleware(storage);
  });

  afterEach(() => {
    if (existsSync(TEST_FILE)) {
      unlinkSync(TEST_FILE);
    }
  });

  it('passes through non-API requests', async () => {
    const req = mockRequest('GET', '/some-page');
    const res = mockResponse();
    let nextCalled = false;

    await middleware(req as any, res as any, () => { nextCalled = true; });

    expect(nextCalled).toBe(true);
  });

  describe('annotations CRUD', () => {
    it('GET /annotations returns empty store initially', async () => {
      const req = mockRequest('GET', '/__inline-review/api/annotations');
      const res = mockResponse();

      await middleware(req as any, res as any, () => {});

      expect(res._status).toBe(200);
      const data = JSON.parse(res._body);
      expect(data.annotations).toEqual([]);
    });

    it('POST /annotations creates and returns annotation with ID', async () => {
      const req = mockRequest('POST', '/__inline-review/api/annotations', {
        pageUrl: '/',
        pageTitle: 'Home',
        selectedText: 'hello world',
        note: 'test note',
        range: { startXPath: '/p[1]', startOffset: 0, endXPath: '/p[1]', endOffset: 11, selectedText: 'hello world', contextBefore: '', contextAfter: '' },
      });
      const res = mockResponse();

      await middleware(req as any, res as any, () => {});

      expect(res._status).toBe(201);
      const data = JSON.parse(res._body);
      expect(data.id).toBeTruthy();
      expect(data.selectedText).toBe('hello world');
      expect(data.note).toBe('test note');
      expect(data.createdAt).toBeTruthy();
    });

    it('PATCH /annotations/:id updates the annotation', async () => {
      // Create first
      const createReq = mockRequest('POST', '/__inline-review/api/annotations', {
        pageUrl: '/',
        selectedText: 'test',
        note: 'original',
        range: { startXPath: '', startOffset: 0, endXPath: '', endOffset: 0, selectedText: '', contextBefore: '', contextAfter: '' },
      });
      const createRes = mockResponse();
      await middleware(createReq as any, createRes as any, () => {});
      const created = JSON.parse(createRes._body);

      // Update
      const updateReq = mockRequest('PATCH', `/__inline-review/api/annotations/${created.id}`, {
        note: 'updated note',
      });
      const updateRes = mockResponse();
      await middleware(updateReq as any, updateRes as any, () => {});

      expect(updateRes._status).toBe(200);
      const updated = JSON.parse(updateRes._body);
      expect(updated.note).toBe('updated note');
      expect(updated.id).toBe(created.id);
    });

    it('PATCH /annotations/:id returns 404 for unknown ID', async () => {
      const req = mockRequest('PATCH', '/__inline-review/api/annotations/nonexistent', { note: 'x' });
      const res = mockResponse();

      await middleware(req as any, res as any, () => {});

      expect(res._status).toBe(404);
    });

    it('DELETE /annotations/:id removes the annotation', async () => {
      // Create first
      const createReq = mockRequest('POST', '/__inline-review/api/annotations', {
        pageUrl: '/',
        selectedText: 'delete me',
        note: '',
        range: { startXPath: '', startOffset: 0, endXPath: '', endOffset: 0, selectedText: '', contextBefore: '', contextAfter: '' },
      });
      const createRes = mockResponse();
      await middleware(createReq as any, createRes as any, () => {});
      const created = JSON.parse(createRes._body);

      // Delete
      const deleteReq = mockRequest('DELETE', `/__inline-review/api/annotations/${created.id}`);
      const deleteRes = mockResponse();
      await middleware(deleteReq as any, deleteRes as any, () => {});

      expect(deleteRes._status).toBe(200);

      // Verify it's gone
      const getReq = mockRequest('GET', '/__inline-review/api/annotations');
      const getRes = mockResponse();
      await middleware(getReq as any, getRes as any, () => {});
      const data = JSON.parse(getRes._body);
      expect(data.annotations.length).toBe(0);
    });

    it('GET /annotations?page= filters by page URL', async () => {
      // Create annotations on different pages
      for (const pageUrl of ['/', '/about']) {
        const req = mockRequest('POST', '/__inline-review/api/annotations', {
          pageUrl,
          selectedText: `text on ${pageUrl}`,
          note: '',
          range: { startXPath: '', startOffset: 0, endXPath: '', endOffset: 0, selectedText: '', contextBefore: '', contextAfter: '' },
        });
        const res = mockResponse();
        await middleware(req as any, res as any, () => {});
      }

      // Filter by page
      const req = mockRequest('GET', '/__inline-review/api/annotations?page=/about');
      const res = mockResponse();
      await middleware(req as any, res as any, () => {});

      const data = JSON.parse(res._body);
      expect(data.annotations.length).toBe(1);
      expect(data.annotations[0].pageUrl).toBe('/about');
    });
  });

  describe('page notes CRUD', () => {
    it('POST /page-notes creates a page note', async () => {
      const req = mockRequest('POST', '/__inline-review/api/page-notes', {
        pageUrl: '/',
        pageTitle: 'Home',
        note: 'This page needs work',
      });
      const res = mockResponse();

      await middleware(req as any, res as any, () => {});

      expect(res._status).toBe(201);
      const data = JSON.parse(res._body);
      expect(data.id).toBeTruthy();
      expect(data.note).toBe('This page needs work');
    });

    it('DELETE /page-notes/:id removes the note', async () => {
      // Create
      const createReq = mockRequest('POST', '/__inline-review/api/page-notes', {
        pageUrl: '/',
        note: 'temp note',
      });
      const createRes = mockResponse();
      await middleware(createReq as any, createRes as any, () => {});
      const created = JSON.parse(createRes._body);

      // Delete
      const deleteReq = mockRequest('DELETE', `/__inline-review/api/page-notes/${created.id}`);
      const deleteRes = mockResponse();
      await middleware(deleteReq as any, deleteRes as any, () => {});

      expect(deleteRes._status).toBe(200);
    });
  });

  describe('export', () => {
    it('returns markdown with annotations grouped by page', async () => {
      // Create annotations on two pages
      for (const [pageUrl, text] of [['/', 'home text'], ['/about', 'about text']] as const) {
        const req = mockRequest('POST', '/__inline-review/api/annotations', {
          pageUrl,
          pageTitle: pageUrl === '/' ? 'Home' : 'About',
          selectedText: text,
          note: `Note for ${text}`,
          range: { startXPath: '', startOffset: 0, endXPath: '', endOffset: 0, selectedText: text, contextBefore: '', contextAfter: '' },
        });
        const res = mockResponse();
        await middleware(req as any, res as any, () => {});
      }

      const req = mockRequest('GET', '/__inline-review/api/export');
      const res = mockResponse();
      await middleware(req as any, res as any, () => {});

      expect(res._status).toBe(200);
      expect(res._headers['Content-Type']).toBe('text/markdown; charset=utf-8');
      expect(res._body).toContain('# Inline Review');
      expect(res._body).toContain('## /');
      expect(res._body).toContain('## /about');
      expect(res._body).toContain('**"home text"**');
      expect(res._body).toContain('> Note for home text');
    });

    it('returns empty message when no data exists', async () => {
      const req = mockRequest('GET', '/__inline-review/api/export');
      const res = mockResponse();
      await middleware(req as any, res as any, () => {});

      expect(res._body).toContain('No annotations or notes yet');
    });
  });

  describe('error handling', () => {
    it('returns 404 for unknown API routes', async () => {
      const req = mockRequest('GET', '/__inline-review/api/unknown');
      const res = mockResponse();

      await middleware(req as any, res as any, () => {});

      expect(res._status).toBe(404);
    });
  });
});
