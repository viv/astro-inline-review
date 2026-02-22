import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { ReviewStorage } from '../../../src/server/storage.js';
import { createEmptyStore } from '../../../src/shared/types.js';
import type { ReviewStore } from '../../../src/shared/types.js';
import { addAgentReplyHandler } from '../../../src/mcp/tools/add-agent-reply.js';

const TEST_DIR = join(tmpdir(), 'air-mcp-reply-' + Date.now());
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

describe('add_agent_reply handler', () => {
  let storage: ReviewStorage;

  beforeEach(() => {
    if (!existsSync(TEST_DIR)) mkdirSync(TEST_DIR, { recursive: true });
    if (existsSync(TEST_FILE)) unlinkSync(TEST_FILE);
    storage = new ReviewStorage(TEST_FILE);
  });

  afterEach(() => {
    if (existsSync(TEST_FILE)) unlinkSync(TEST_FILE);
  });

  it('creates the replies array when annotation has no replies', async () => {
    const store: ReviewStore = {
      ...createEmptyStore(),
      annotations: [makeTextAnnotation('ann1', '/', 'fix this')],
    };
    await storage.write(store);

    const result = await addAgentReplyHandler(storage, { id: 'ann1', message: 'Fixed the typo' });

    const data = JSON.parse(result.content[0].text);
    expect(data.replies).toHaveLength(1);
    expect(data.replies[0].message).toBe('Fixed the typo');
  });

  it('appends to existing replies', async () => {
    const store: ReviewStore = {
      ...createEmptyStore(),
      annotations: [{
        ...makeTextAnnotation('ann1', '/', 'fix this'),
        replies: [{ message: 'First reply', createdAt: '2026-01-01T00:00:00.000Z' }],
      }],
    };
    await storage.write(store);

    const result = await addAgentReplyHandler(storage, { id: 'ann1', message: 'Second reply' });

    const data = JSON.parse(result.content[0].text);
    expect(data.replies).toHaveLength(2);
    expect(data.replies[0].message).toBe('First reply');
    expect(data.replies[1].message).toBe('Second reply');
  });

  it('returns error for non-existent ID', async () => {
    const result = await addAgentReplyHandler(storage, { id: 'nonexistent', message: 'hello' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('not found');
  });

  it('sets createdAt to a valid ISO 8601 timestamp', async () => {
    const store: ReviewStore = {
      ...createEmptyStore(),
      annotations: [makeTextAnnotation('ann1', '/', 'fix this')],
    };
    await storage.write(store);

    const result = await addAgentReplyHandler(storage, { id: 'ann1', message: 'Done' });

    const data = JSON.parse(result.content[0].text);
    const createdAt = data.replies[0].createdAt;
    expect(new Date(createdAt).toISOString()).toBe(createdAt);
  });

  it('persists the reply to the JSON file', async () => {
    const store: ReviewStore = {
      ...createEmptyStore(),
      annotations: [makeTextAnnotation('ann1', '/', 'fix this')],
    };
    await storage.write(store);

    await addAgentReplyHandler(storage, { id: 'ann1', message: 'Done' });

    const persisted = await storage.read();
    expect(persisted.annotations[0].replies).toHaveLength(1);
    expect(persisted.annotations[0].replies![0].message).toBe('Done');
  });

  it('rejects an empty message', async () => {
    const store: ReviewStore = {
      ...createEmptyStore(),
      annotations: [makeTextAnnotation('ann1', '/', 'fix this')],
    };
    await storage.write(store);

    const result = await addAgentReplyHandler(storage, { id: 'ann1', message: '' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('empty');
  });

  it('updates the updatedAt timestamp on the annotation', async () => {
    const store: ReviewStore = {
      ...createEmptyStore(),
      annotations: [makeTextAnnotation('ann1', '/', 'fix this')],
    };
    await storage.write(store);

    const result = await addAgentReplyHandler(storage, { id: 'ann1', message: 'Done' });

    const data = JSON.parse(result.content[0].text);
    expect(data.updatedAt).not.toBe('2026-01-01T00:00:00.000Z');
  });
});
