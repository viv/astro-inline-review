import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { ReviewStorage } from '../../../src/server/storage.js';
import { createEmptyStore } from '../../../src/shared/types.js';
import type { ReviewStore } from '../../../src/shared/types.js';
import { listAnnotationsHandler } from '../../../src/mcp/tools/list-annotations.js';

const TEST_DIR = join(tmpdir(), 'air-mcp-list-ann-' + Date.now());
const TEST_FILE = join(TEST_DIR, 'store.json');

function makeTextAnnotation(id: string, pageUrl: string, text: string, note: string) {
  return {
    id,
    type: 'text' as const,
    pageUrl,
    pageTitle: 'Test Page',
    selectedText: text,
    note,
    range: { startXPath: '', startOffset: 0, endXPath: '', endOffset: 0, selectedText: text, contextBefore: '', contextAfter: '' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('list_annotations handler', () => {
  let storage: ReviewStorage;

  beforeEach(() => {
    if (!existsSync(TEST_DIR)) mkdirSync(TEST_DIR, { recursive: true });
    if (existsSync(TEST_FILE)) unlinkSync(TEST_FILE);
    storage = new ReviewStorage(TEST_FILE);
  });

  afterEach(() => {
    if (existsSync(TEST_FILE)) unlinkSync(TEST_FILE);
  });

  it('returns empty array when store has no annotations', async () => {
    const result = await listAnnotationsHandler(storage, {});

    const data = JSON.parse(result.content[0].text);
    expect(data).toEqual([]);
  });

  it('returns all annotations when no pageUrl filter', async () => {
    const store: ReviewStore = {
      ...createEmptyStore(),
      annotations: [
        makeTextAnnotation('1', '/', 'hello', 'note1'),
        makeTextAnnotation('2', '/about', 'world', 'note2'),
      ],
    };
    await storage.write(store);

    const result = await listAnnotationsHandler(storage, {});

    const data = JSON.parse(result.content[0].text);
    expect(data).toHaveLength(2);
    expect(data[0].id).toBe('1');
    expect(data[1].id).toBe('2');
  });

  it('filters by pageUrl when provided', async () => {
    const store: ReviewStore = {
      ...createEmptyStore(),
      annotations: [
        makeTextAnnotation('1', '/', 'hello', 'note1'),
        makeTextAnnotation('2', '/about', 'world', 'note2'),
        makeTextAnnotation('3', '/about', 'foo', 'note3'),
      ],
    };
    await storage.write(store);

    const result = await listAnnotationsHandler(storage, { pageUrl: '/about' });

    const data = JSON.parse(result.content[0].text);
    expect(data).toHaveLength(2);
    expect(data.every((a: any) => a.pageUrl === '/about')).toBe(true);
  });

  it('returns empty array when pageUrl filter matches nothing', async () => {
    const store: ReviewStore = {
      ...createEmptyStore(),
      annotations: [makeTextAnnotation('1', '/', 'hello', 'note1')],
    };
    await storage.write(store);

    const result = await listAnnotationsHandler(storage, { pageUrl: '/nonexistent' });

    const data = JSON.parse(result.content[0].text);
    expect(data).toEqual([]);
  });

  it('returns content as formatted JSON text', async () => {
    const store: ReviewStore = {
      ...createEmptyStore(),
      annotations: [makeTextAnnotation('1', '/', 'hello', 'note1')],
    };
    await storage.write(store);

    const result = await listAnnotationsHandler(storage, {});

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    // Should be pretty-printed JSON
    expect(result.content[0].text).toContain('\n');
  });
});
