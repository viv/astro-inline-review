import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { ReviewStorage } from '../../../src/server/storage.js';
import { createEmptyStore } from '../../../src/shared/types.js';
import type { ReviewStore } from '../../../src/shared/types.js';
import { resolveAnnotationHandler } from '../../../src/mcp/tools/resolve-annotation.js';
import { makeTextAnnotation, makeElementAnnotation } from '../helpers/fixtures.js';

const TEST_DIR = join(tmpdir(), 'air-mcp-resolve-' + Date.now());
const TEST_FILE = join(TEST_DIR, 'store.json');

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

  describe('default behaviour (no autoResolve)', () => {
    it('sets status to "addressed" and addressedAt to a valid ISO 8601 timestamp', async () => {
      const store: ReviewStore = {
        ...createEmptyStore(),
        annotations: [makeTextAnnotation('ann1', '/', 'fix this')],
      };
      await storage.write(store);

      const result = await resolveAnnotationHandler(storage, { id: 'ann1' });

      const data = JSON.parse(result.content[0].text);
      expect(data.status).toBe('addressed');
      expect(data.addressedAt).toBeDefined();
      expect(new Date(data.addressedAt).toISOString()).toBe(data.addressedAt);
    });

    it('does not set resolvedAt', async () => {
      const store: ReviewStore = {
        ...createEmptyStore(),
        annotations: [makeTextAnnotation('ann1', '/', 'fix this')],
      };
      await storage.write(store);

      const result = await resolveAnnotationHandler(storage, { id: 'ann1' });

      const data = JSON.parse(result.content[0].text);
      expect(data.resolvedAt).toBeUndefined();
    });

    it('persists status and addressedAt to the JSON file', async () => {
      const store: ReviewStore = {
        ...createEmptyStore(),
        annotations: [makeTextAnnotation('ann1', '/', 'fix this')],
      };
      await storage.write(store);

      await resolveAnnotationHandler(storage, { id: 'ann1' });

      const persisted = await storage.read();
      expect(persisted.annotations[0].status).toBe('addressed');
      expect(persisted.annotations[0].addressedAt).toBeDefined();
      expect(new Date(persisted.annotations[0].addressedAt!).toISOString()).toBe(
        persisted.annotations[0].addressedAt,
      );
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

  describe('autoResolve: true', () => {
    it('sets status to "resolved" and resolvedAt to a valid ISO 8601 timestamp', async () => {
      const store: ReviewStore = {
        ...createEmptyStore(),
        annotations: [makeTextAnnotation('ann1', '/', 'fix this')],
      };
      await storage.write(store);

      const result = await resolveAnnotationHandler(storage, { id: 'ann1', autoResolve: true });

      const data = JSON.parse(result.content[0].text);
      expect(data.status).toBe('resolved');
      expect(data.resolvedAt).toBeDefined();
      expect(new Date(data.resolvedAt).toISOString()).toBe(data.resolvedAt);
    });

    it('updates resolvedAt when the annotation already has one', async () => {
      const store: ReviewStore = {
        ...createEmptyStore(),
        annotations: [{
          ...makeTextAnnotation('ann1', '/', 'fix this'),
          resolvedAt: '2026-01-01T00:00:00.000Z',
        }],
      };
      await storage.write(store);

      const result = await resolveAnnotationHandler(storage, { id: 'ann1', autoResolve: true });

      const data = JSON.parse(result.content[0].text);
      expect(data.resolvedAt).toBeDefined();
      expect(data.resolvedAt).not.toBe('2026-01-01T00:00:00.000Z');
    });

    it('does not set addressedAt', async () => {
      const store: ReviewStore = {
        ...createEmptyStore(),
        annotations: [makeTextAnnotation('ann1', '/', 'fix this')],
      };
      await storage.write(store);

      const result = await resolveAnnotationHandler(storage, { id: 'ann1', autoResolve: true });

      const data = JSON.parse(result.content[0].text);
      expect(data.addressedAt).toBeUndefined();
    });

    it('persists status and resolvedAt to the JSON file', async () => {
      const store: ReviewStore = {
        ...createEmptyStore(),
        annotations: [makeTextAnnotation('ann1', '/', 'fix this')],
      };
      await storage.write(store);

      await resolveAnnotationHandler(storage, { id: 'ann1', autoResolve: true });

      const persisted = await storage.read();
      expect(persisted.annotations[0].status).toBe('resolved');
      expect(persisted.annotations[0].resolvedAt).toBeDefined();
      expect(new Date(persisted.annotations[0].resolvedAt!).toISOString()).toBe(
        persisted.annotations[0].resolvedAt,
      );
    });
  });

  describe('replacedText parameter', () => {
    it('sets replacedText on the annotation when provided', async () => {
      const store: ReviewStore = {
        ...createEmptyStore(),
        annotations: [makeTextAnnotation('ann1', '/', 'update this text')],
      };
      await storage.write(store);

      const result = await resolveAnnotationHandler(storage, {
        id: 'ann1',
        replacedText: 'updated text',
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.replacedText).toBe('updated text');
      expect(data.status).toBe('addressed');
    });

    it('sets replacedText with autoResolve', async () => {
      const store: ReviewStore = {
        ...createEmptyStore(),
        annotations: [makeTextAnnotation('ann1', '/', 'update this text')],
      };
      await storage.write(store);

      const result = await resolveAnnotationHandler(storage, {
        id: 'ann1',
        replacedText: 'updated text',
        autoResolve: true,
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.replacedText).toBe('updated text');
      expect(data.status).toBe('resolved');
    });

    it('persists replacedText to the JSON file', async () => {
      const store: ReviewStore = {
        ...createEmptyStore(),
        annotations: [makeTextAnnotation('ann1', '/', 'update this text')],
      };
      await storage.write(store);

      await resolveAnnotationHandler(storage, { id: 'ann1', replacedText: 'updated text' });

      const persisted = await storage.read();
      expect(persisted.annotations[0].replacedText).toBe('updated text');
    });

    it('returns error when replacedText is an empty string', async () => {
      const store: ReviewStore = {
        ...createEmptyStore(),
        annotations: [makeTextAnnotation('ann1', '/', 'fix this')],
      };
      await storage.write(store);

      const result = await resolveAnnotationHandler(storage, { id: 'ann1', replacedText: '' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('must not be empty');
    });

    it('returns error when replacedText is whitespace only', async () => {
      const store: ReviewStore = {
        ...createEmptyStore(),
        annotations: [makeTextAnnotation('ann1', '/', 'fix this')],
      };
      await storage.write(store);

      const result = await resolveAnnotationHandler(storage, { id: 'ann1', replacedText: '   ' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('must not be empty');
    });

    it('returns error when replacedText is used on an element annotation', async () => {
      const store: ReviewStore = {
        ...createEmptyStore(),
        annotations: [makeElementAnnotation('ann1', '/', 'fix this element')],
      };
      await storage.write(store);

      const result = await resolveAnnotationHandler(storage, {
        id: 'ann1',
        replacedText: 'some text',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('not a text annotation');
    });

    it('does not set replacedText when the parameter is omitted', async () => {
      const store: ReviewStore = {
        ...createEmptyStore(),
        annotations: [makeTextAnnotation('ann1', '/', 'fix this')],
      };
      await storage.write(store);

      const result = await resolveAnnotationHandler(storage, { id: 'ann1' });

      const data = JSON.parse(result.content[0].text);
      expect(data.replacedText).toBeUndefined();
    });
  });

  it('returns error for non-existent ID', async () => {
    const result = await resolveAnnotationHandler(storage, { id: 'nonexistent' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('not found');
  });
});
