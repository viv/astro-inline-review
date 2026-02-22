import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { ReviewStorage } from '../../../src/server/storage.js';
import { createEmptyStore } from '../../../src/shared/types.js';
import type { ReviewStore } from '../../../src/shared/types.js';
import { getAnnotationHandler } from '../../../src/mcp/tools/get-annotation.js';
import { makeTextAnnotation } from '../helpers/fixtures.js';

const TEST_DIR = join(tmpdir(), 'air-mcp-get-ann-' + Date.now());
const TEST_FILE = join(TEST_DIR, 'store.json');

describe('get_annotation handler', () => {
  let storage: ReviewStorage;

  beforeEach(() => {
    if (!existsSync(TEST_DIR)) mkdirSync(TEST_DIR, { recursive: true });
    if (existsSync(TEST_FILE)) unlinkSync(TEST_FILE);
    storage = new ReviewStorage(TEST_FILE);
  });

  afterEach(() => {
    if (existsSync(TEST_FILE)) unlinkSync(TEST_FILE);
  });

  it('returns the annotation when ID exists', async () => {
    const store: ReviewStore = {
      ...createEmptyStore(),
      annotations: [
        makeTextAnnotation('abc123', '/', 'hello world', 'fix this'),
      ],
    };
    await storage.write(store);

    const result = await getAnnotationHandler(storage, { id: 'abc123' });

    const data = JSON.parse(result.content[0].text);
    expect(data.id).toBe('abc123');
    expect(data.selectedText).toBe('hello world');
    expect(data.note).toBe('fix this');
  });

  it('returns isError when ID does not exist', async () => {
    const result = await getAnnotationHandler(storage, { id: 'nonexistent' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('not found');
  });

  it('finds annotation among multiple', async () => {
    const store: ReviewStore = {
      ...createEmptyStore(),
      annotations: [
        makeTextAnnotation('first', '/', 'one', 'note1'),
        makeTextAnnotation('second', '/about', 'two', 'note2'),
        makeTextAnnotation('third', '/contact', 'three', 'note3'),
      ],
    };
    await storage.write(store);

    const result = await getAnnotationHandler(storage, { id: 'second' });

    const data = JSON.parse(result.content[0].text);
    expect(data.id).toBe('second');
    expect(data.pageUrl).toBe('/about');
  });

  it('returns content as formatted JSON text', async () => {
    const store: ReviewStore = {
      ...createEmptyStore(),
      annotations: [makeTextAnnotation('abc', '/', 'hello', 'note')],
    };
    await storage.write(store);

    const result = await getAnnotationHandler(storage, { id: 'abc' });

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('\n');
  });
});
