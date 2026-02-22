import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { ReviewStorage } from '../../../src/server/storage.js';
import { createEmptyStore } from '../../../src/shared/types.js';
import type { ReviewStore } from '../../../src/shared/types.js';
import { resolveAnnotationHandler } from '../../../src/mcp/tools/resolve-annotation.js';

const TEST_DIR = join(tmpdir(), 'air-mcp-resolve-' + Date.now());
const TEST_FILE = join(TEST_DIR, 'store.json');

function makeTextAnnotation(id: string, pageUrl: string, note: string) {
  return {
    id,
    type: 'text' as const,
    pageUrl,
    pageTitle: 'Test Page',
    selectedText: 'some text',
    note,
    range: { startXPath: '', startOffset: 0, endXPath: '', endOffset: 0, selectedText: 'some text', contextBefore: '', contextAfter: '' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('resolve_annotation handler', () => {
  let storage: ReviewStorage;

  beforeEach(() => {
    if (!existsSync(TEST_DIR)) mkdirSync(TEST_DIR, { recursive: true });
    if (existsSync(TEST_FILE)) unlinkSync(TEST_FILE);
    storage = new ReviewStorage(TEST_FILE);
  });

  afterEach(() => {
    if (existsSync(TEST_FILE)) unlinkSync(TEST_FILE);
  });

  it('sets resolvedAt to a valid ISO 8601 timestamp', async () => {
    const store: ReviewStore = {
      ...createEmptyStore(),
      annotations: [makeTextAnnotation('ann1', '/', 'fix this')],
    };
    await storage.write(store);

    const result = await resolveAnnotationHandler(storage, { id: 'ann1' });

    const data = JSON.parse(result.content[0].text);
    expect(data.resolvedAt).toBeDefined();
    expect(new Date(data.resolvedAt).toISOString()).toBe(data.resolvedAt);
  });

  it('updates resolvedAt when resolving an already-resolved annotation', async () => {
    const store: ReviewStore = {
      ...createEmptyStore(),
      annotations: [{
        ...makeTextAnnotation('ann1', '/', 'fix this'),
        resolvedAt: '2026-01-01T00:00:00.000Z',
      }],
    };
    await storage.write(store);

    const result = await resolveAnnotationHandler(storage, { id: 'ann1' });

    const data = JSON.parse(result.content[0].text);
    expect(data.resolvedAt).toBeDefined();
    expect(data.resolvedAt).not.toBe('2026-01-01T00:00:00.000Z');
  });

  it('returns error for non-existent ID', async () => {
    const result = await resolveAnnotationHandler(storage, { id: 'nonexistent' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('not found');
  });

  it('persists the change to the JSON file', async () => {
    const store: ReviewStore = {
      ...createEmptyStore(),
      annotations: [makeTextAnnotation('ann1', '/', 'fix this')],
    };
    await storage.write(store);

    await resolveAnnotationHandler(storage, { id: 'ann1' });

    // Read back from disk
    const persisted = await storage.read();
    expect(persisted.annotations[0].resolvedAt).toBeDefined();
    expect(new Date(persisted.annotations[0].resolvedAt!).toISOString()).toBe(persisted.annotations[0].resolvedAt);
  });

  it('updates the updatedAt timestamp', async () => {
    const store: ReviewStore = {
      ...createEmptyStore(),
      annotations: [makeTextAnnotation('ann1', '/', 'fix this')],
    };
    await storage.write(store);

    const result = await resolveAnnotationHandler(storage, { id: 'ann1' });

    const data = JSON.parse(result.content[0].text);
    expect(data.updatedAt).not.toBe('2026-01-01T00:00:00.000Z');
  });
});
