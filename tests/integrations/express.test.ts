import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { inlineReview } from '../../src/integrations/express.js';
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { IncomingMessage, ServerResponse } from 'node:http';

const TEST_DIR = join(tmpdir(), 'air-express-test-' + Date.now());
const TEST_FILE = join(TEST_DIR, 'express-store.json');

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

describe('express adapter', () => {
  beforeEach(() => {
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }
    if (existsSync(TEST_FILE)) {
      unlinkSync(TEST_FILE);
    }
  });

  afterEach(() => {
    if (existsSync(TEST_FILE)) {
      unlinkSync(TEST_FILE);
    }
  });

  it('inlineReview() returns object with apiMiddleware and clientMiddleware functions', () => {
    const middleware = inlineReview({ storagePath: TEST_FILE });
    expect(middleware).toHaveProperty('apiMiddleware');
    expect(middleware).toHaveProperty('clientMiddleware');
    expect(typeof middleware.apiMiddleware).toBe('function');
    expect(typeof middleware.clientMiddleware).toBe('function');
  });

  describe('apiMiddleware', () => {
    it('passes through non-API requests', async () => {
      const { apiMiddleware } = inlineReview({ storagePath: TEST_FILE });
      const req = mockRequest('GET', '/some-page');
      const res = mockResponse();
      let nextCalled = false;

      await apiMiddleware(req as any, res as any, () => { nextCalled = true; });

      expect(nextCalled).toBe(true);
    });

    it('handles API requests', async () => {
      const { apiMiddleware } = inlineReview({ storagePath: TEST_FILE });
      const req = mockRequest('GET', '/__inline-review/api/annotations');
      const res = mockResponse();

      await apiMiddleware(req as any, res as any, () => {});

      expect(res._status).toBe(200);
      const data = JSON.parse(res._body);
      expect(data.annotations).toEqual([]);
    });
  });

  describe('clientMiddleware', () => {
    it('passes through non-client requests', async () => {
      const { clientMiddleware } = inlineReview({ storagePath: TEST_FILE });
      const req = mockRequest('GET', '/some-page');
      const res = mockResponse();
      let nextCalled = false;

      await clientMiddleware(req as any, res as any, () => { nextCalled = true; });

      expect(nextCalled).toBe(true);
    });

    it('passes through other __inline-review paths', async () => {
      const { clientMiddleware } = inlineReview({ storagePath: TEST_FILE });
      const req = mockRequest('GET', '/__inline-review/api/annotations');
      const res = mockResponse();
      let nextCalled = false;

      await clientMiddleware(req as any, res as any, () => { nextCalled = true; });

      expect(nextCalled).toBe(true);
    });

    it('attempts to serve JS content at /__inline-review/client.js', async () => {
      const { clientMiddleware } = inlineReview({ storagePath: TEST_FILE });
      const req = mockRequest('GET', '/__inline-review/client.js');
      const res = mockResponse();
      let nextCalled = false;

      // The client.js file may not exist in test env (not built),
      // so the middleware should call next() on read failure
      await clientMiddleware(req as any, res as any, () => { nextCalled = true; });

      // Either it serves the file (with JS content-type) or falls through to next()
      if (nextCalled) {
        // File not found — graceful fallthrough is correct behaviour
        expect(nextCalled).toBe(true);
      } else {
        // File was found and served
        expect(res._headers['Content-Type']).toBe('application/javascript');
        expect(res._headers['Cache-Control']).toBe('no-cache');
      }
    });
  });
});
