import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { ReviewStorage } from '../../../src/server/storage.js';
import { createEmptyStore } from '../../../src/shared/types.js';
import type { ReviewStore } from '../../../src/shared/types.js';
import { listPageNotesHandler } from '../../../src/mcp/tools/list-page-notes.js';

const TEST_DIR = join(tmpdir(), 'air-mcp-list-pn-' + Date.now());
const TEST_FILE = join(TEST_DIR, 'store.json');

function makePageNote(id: string, pageUrl: string, note: string) {
  return {
    id,
    pageUrl,
    pageTitle: 'Test Page',
    note,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('list_page_notes handler', () => {
  let storage: ReviewStorage;

  beforeEach(() => {
    if (!existsSync(TEST_DIR)) mkdirSync(TEST_DIR, { recursive: true });
    if (existsSync(TEST_FILE)) unlinkSync(TEST_FILE);
    storage = new ReviewStorage(TEST_FILE);
  });

  afterEach(() => {
    if (existsSync(TEST_FILE)) unlinkSync(TEST_FILE);
  });

  it('returns empty array when store has no page notes', async () => {
    const result = await listPageNotesHandler(storage, {});

    const data = JSON.parse(result.content[0].text);
    expect(data).toEqual([]);
  });

  it('returns all page notes when no pageUrl filter', async () => {
    const store: ReviewStore = {
      ...createEmptyStore(),
      pageNotes: [
        makePageNote('1', '/', 'General feedback'),
        makePageNote('2', '/about', 'About page note'),
      ],
    };
    await storage.write(store);

    const result = await listPageNotesHandler(storage, {});

    const data = JSON.parse(result.content[0].text);
    expect(data).toHaveLength(2);
    expect(data[0].id).toBe('1');
    expect(data[1].id).toBe('2');
  });

  it('filters by pageUrl when provided', async () => {
    const store: ReviewStore = {
      ...createEmptyStore(),
      pageNotes: [
        makePageNote('1', '/', 'Home note'),
        makePageNote('2', '/about', 'About note 1'),
        makePageNote('3', '/about', 'About note 2'),
      ],
    };
    await storage.write(store);

    const result = await listPageNotesHandler(storage, { pageUrl: '/about' });

    const data = JSON.parse(result.content[0].text);
    expect(data).toHaveLength(2);
    expect(data.every((n: any) => n.pageUrl === '/about')).toBe(true);
  });

  it('returns empty array when pageUrl filter matches nothing', async () => {
    const store: ReviewStore = {
      ...createEmptyStore(),
      pageNotes: [makePageNote('1', '/', 'Home note')],
    };
    await storage.write(store);

    const result = await listPageNotesHandler(storage, { pageUrl: '/nonexistent' });

    const data = JSON.parse(result.content[0].text);
    expect(data).toEqual([]);
  });

  it('returns content as formatted JSON text', async () => {
    const store: ReviewStore = {
      ...createEmptyStore(),
      pageNotes: [makePageNote('1', '/', 'Home note')],
    };
    await storage.write(store);

    const result = await listPageNotesHandler(storage, {});

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('\n');
  });
});
