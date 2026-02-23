import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { ReviewStorage } from '../../../src/server/storage.js';
import { createEmptyStore } from '../../../src/shared/types.js';
import type { ReviewStore } from '../../../src/shared/types.js';
import { updateAnnotationTargetHandler } from '../../../src/mcp/tools/update-annotation-target.js';
import { makeTextAnnotation, makeElementAnnotation } from '../helpers/fixtures.js';

const TEST_DIR = join(tmpdir(), 'air-mcp-update-target-' + Date.now());
const TEST_FILE = join(TEST_DIR, 'store.json');

describe('update_annotation_target handler', () => {
  let storage: ReviewStorage;

  beforeEach(() => {
    if (!existsSync(TEST_DIR)) mkdirSync(TEST_DIR, { recursive: true });
    if (existsSync(TEST_FILE)) unlinkSync(TEST_FILE);
    storage = new ReviewStorage(TEST_FILE);
  });

  afterEach(() => {
    if (existsSync(TEST_FILE)) unlinkSync(TEST_FILE);
  });

  it('sets replacedText on a text annotation and returns the updated annotation', async () => {
    const store: ReviewStore = {
      ...createEmptyStore(),
      annotations: [makeTextAnnotation('ann1', '/', 'fix this')],
    };
    await storage.write(store);

    const result = await updateAnnotationTargetHandler(storage, { id: 'ann1', replacedText: 'updated text' });

    const data = JSON.parse(result.content[0].text);
    expect(data.replacedText).toBe('updated text');
    expect(data.id).toBe('ann1');
    expect(data.type).toBe('text');
  });

  it('returns error for non-existent ID', async () => {
    const result = await updateAnnotationTargetHandler(storage, { id: 'nonexistent', replacedText: 'some text' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('not found');
  });

  it('returns error for element annotations (not a text annotation)', async () => {
    const store: ReviewStore = {
      ...createEmptyStore(),
      annotations: [makeElementAnnotation('elem1', '/', 'fix this element')],
    };
    await storage.write(store);

    const result = await updateAnnotationTargetHandler(storage, { id: 'elem1', replacedText: 'some text' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('not a text annotation');
  });

  it('returns error for empty replacedText (whitespace-only)', async () => {
    const store: ReviewStore = {
      ...createEmptyStore(),
      annotations: [makeTextAnnotation('ann1', '/', 'fix this')],
    };
    await storage.write(store);

    const result = await updateAnnotationTargetHandler(storage, { id: 'ann1', replacedText: '   ' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('replacedText must not be empty');
  });

  it('persists the change to the JSON file', async () => {
    const store: ReviewStore = {
      ...createEmptyStore(),
      annotations: [makeTextAnnotation('ann1', '/', 'fix this')],
    };
    await storage.write(store);

    await updateAnnotationTargetHandler(storage, { id: 'ann1', replacedText: 'persisted text' });

    // Read back from disk
    const persisted = await storage.read();
    const annotation = persisted.annotations.find(a => a.id === 'ann1');
    expect(annotation).toBeDefined();
    expect((annotation as { replacedText?: string }).replacedText).toBe('persisted text');
  });

  it('updates the updatedAt timestamp', async () => {
    const store: ReviewStore = {
      ...createEmptyStore(),
      annotations: [makeTextAnnotation('ann1', '/', 'fix this')],
    };
    await storage.write(store);

    const result = await updateAnnotationTargetHandler(storage, { id: 'ann1', replacedText: 'new text' });

    const data = JSON.parse(result.content[0].text);
    expect(data.updatedAt).not.toBe('2026-01-01T00:00:00.000Z');
    expect(new Date(data.updatedAt).toISOString()).toBe(data.updatedAt);
  });

  it('overwrites previous replacedText value when called again', async () => {
    const store: ReviewStore = {
      ...createEmptyStore(),
      annotations: [{
        ...makeTextAnnotation('ann1', '/', 'fix this'),
        replacedText: 'first replacement',
      }],
    };
    await storage.write(store);

    const result = await updateAnnotationTargetHandler(storage, { id: 'ann1', replacedText: 'second replacement' });

    const data = JSON.parse(result.content[0].text);
    expect(data.replacedText).toBe('second replacement');
  });
});
