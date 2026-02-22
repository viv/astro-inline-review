import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { ReviewStorage } from '../../../src/server/storage.js';
import { createEmptyStore } from '../../../src/shared/types.js';
import type { ReviewStore } from '../../../src/shared/types.js';
import { getExportHandler } from '../../../src/mcp/tools/get-export.js';

const TEST_DIR = join(tmpdir(), 'air-mcp-get-exp-' + Date.now());
const TEST_FILE = join(TEST_DIR, 'store.json');

describe('get_export handler', () => {
  let storage: ReviewStorage;

  beforeEach(() => {
    if (!existsSync(TEST_DIR)) mkdirSync(TEST_DIR, { recursive: true });
    if (existsSync(TEST_FILE)) unlinkSync(TEST_FILE);
    storage = new ReviewStorage(TEST_FILE);
  });

  afterEach(() => {
    if (existsSync(TEST_FILE)) unlinkSync(TEST_FILE);
  });

  it('returns empty message when store has no data', async () => {
    const result = await getExportHandler(storage);

    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('No annotations or notes yet');
  });

  it('returns markdown with annotations grouped by page', async () => {
    const store: ReviewStore = {
      ...createEmptyStore(),
      annotations: [
        {
          id: '1', type: 'text', pageUrl: '/', pageTitle: 'Home',
          selectedText: 'hello', note: 'fix this',
          range: { startXPath: '', startOffset: 0, endXPath: '', endOffset: 0, selectedText: 'hello', contextBefore: '', contextAfter: '' },
          createdAt: '', updatedAt: '',
        },
        {
          id: '2', type: 'text', pageUrl: '/about', pageTitle: 'About',
          selectedText: 'world', note: 'update this',
          range: { startXPath: '', startOffset: 0, endXPath: '', endOffset: 0, selectedText: 'world', contextBefore: '', contextAfter: '' },
          createdAt: '', updatedAt: '',
        },
      ],
    };
    await storage.write(store);

    const result = await getExportHandler(storage);

    const text = result.content[0].text;
    expect(text).toContain('# Inline Review');
    expect(text).toContain('## / — Home');
    expect(text).toContain('## /about — About');
    expect(text).toContain('**"hello"**');
    expect(text).toContain('> fix this');
  });

  it('includes page notes in the export', async () => {
    const store: ReviewStore = {
      ...createEmptyStore(),
      pageNotes: [
        { id: '1', pageUrl: '/', pageTitle: 'Home', note: 'General feedback', createdAt: '', updatedAt: '' },
      ],
    };
    await storage.write(store);

    const result = await getExportHandler(storage);

    const text = result.content[0].text;
    expect(text).toContain('### Page Notes');
    expect(text).toContain('- General feedback');
  });

  it('returns a single text content item', async () => {
    const result = await getExportHandler(storage);

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
  });
});
