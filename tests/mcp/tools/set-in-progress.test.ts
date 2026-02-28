import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { ReviewStorage } from '../../../src/server/storage.js';
import { createEmptyStore } from '../../../src/shared/types.js';
import type { ReviewStore } from '../../../src/shared/types.js';
import { setInProgressHandler } from '../../../src/mcp/tools/set-in-progress.js';
import { makeTextAnnotation, makeElementAnnotation } from '../helpers/fixtures.js';

const TEST_DIR = join(tmpdir(), 'air-mcp-in-progress-' + Date.now());
const TEST_FILE = join(TEST_DIR, 'store.json');

describe('set_in_progress handler', () => {
  let storage: ReviewStorage;

  beforeEach(() => {
    if (!existsSync(TEST_DIR)) mkdirSync(TEST_DIR, { recursive: true });
    if (existsSync(TEST_FILE)) unlinkSync(TEST_FILE);
    storage = new ReviewStorage(TEST_FILE);
  });

  afterEach(() => {
    if (existsSync(TEST_FILE)) unlinkSync(TEST_FILE);
  });

  it('sets status to "in_progress" and inProgressAt to a valid ISO 8601 timestamp', async () => {
    const store: ReviewStore = {
      ...createEmptyStore(),
      annotations: [makeTextAnnotation('ann1', '/', 'fix this')],
    };
    await storage.write(store);

    const result = await setInProgressHandler(storage, { id: 'ann1' });

    const data = JSON.parse(result.content[0].text);
    expect(data.status).toBe('in_progress');
    expect(data.inProgressAt).toBeDefined();
    expect(new Date(data.inProgressAt).toISOString()).toBe(data.inProgressAt);
  });

  it('updates the updatedAt timestamp', async () => {
    const store: ReviewStore = {
      ...createEmptyStore(),
      annotations: [makeTextAnnotation('ann1', '/', 'fix this')],
    };
    await storage.write(store);

    const result = await setInProgressHandler(storage, { id: 'ann1' });

    const data = JSON.parse(result.content[0].text);
    expect(data.updatedAt).not.toBe('2026-01-01T00:00:00.000Z');
  });

  it('persists status and inProgressAt to the JSON file', async () => {
    const store: ReviewStore = {
      ...createEmptyStore(),
      annotations: [makeTextAnnotation('ann1', '/', 'fix this')],
    };
    await storage.write(store);

    await setInProgressHandler(storage, { id: 'ann1' });

    const persisted = await storage.read();
    expect(persisted.annotations[0].status).toBe('in_progress');
    expect(persisted.annotations[0].inProgressAt).toBeDefined();
    expect(new Date(persisted.annotations[0].inProgressAt!).toISOString()).toBe(
      persisted.annotations[0].inProgressAt,
    );
  });

  it('works on element annotations', async () => {
    const store: ReviewStore = {
      ...createEmptyStore(),
      annotations: [makeElementAnnotation('ann1', '/', 'fix this element')],
    };
    await storage.write(store);

    const result = await setInProgressHandler(storage, { id: 'ann1' });

    const data = JSON.parse(result.content[0].text);
    expect(data.status).toBe('in_progress');
    expect(data.inProgressAt).toBeDefined();
  });

  it('returns error for non-existent ID', async () => {
    const result = await setInProgressHandler(storage, { id: 'nonexistent' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('not found');
  });
});
