import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ReviewStorage } from '../../src/server/storage.js';
import { createEmptyStore } from '../../src/types.js';
import type { TextAnnotation } from '../../src/types.js';
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function makeTextAnnotation(id: string): TextAnnotation {
  return {
    id,
    type: 'text',
    pageUrl: '/',
    pageTitle: '',
    selectedText: '',
    note: '',
    range: { startXPath: '', startOffset: 0, endXPath: '', endOffset: 0, selectedText: '', contextBefore: '', contextAfter: '' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

const TEST_DIR = join(tmpdir(), 'air-test-' + Date.now());
const TEST_FILE = join(TEST_DIR, 'test-store.json');

describe('ReviewStorage', () => {
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

  describe('read', () => {
    it('returns an empty store when file does not exist', async () => {
      const storage = new ReviewStorage(TEST_FILE);
      const store = await storage.read();

      expect(store).toEqual(createEmptyStore());
      expect(store.version).toBe(1);
      expect(store.annotations).toEqual([]);
      expect(store.pageNotes).toEqual([]);
    });

    it('reads a valid store from disk', async () => {
      const data = {
        version: 1,
        annotations: [{
          id: 'test-1',
          pageUrl: '/',
          pageTitle: 'Home',
          selectedText: 'hello',
          note: 'test note',
          range: { startXPath: '', startOffset: 0, endXPath: '', endOffset: 0, selectedText: 'hello', contextBefore: '', contextAfter: '' },
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        }],
        pageNotes: [],
      };
      writeFileSync(TEST_FILE, JSON.stringify(data), 'utf-8');

      const storage = new ReviewStorage(TEST_FILE);
      const store = await storage.read();

      expect(store.annotations.length).toBe(1);
      expect(store.annotations[0].id).toBe('test-1');
    });

    it('returns empty store on corrupted JSON', async () => {
      writeFileSync(TEST_FILE, 'not valid json!!!', 'utf-8');

      const storage = new ReviewStorage(TEST_FILE);
      const store = await storage.read();

      expect(store).toEqual(createEmptyStore());
    });

    it('returns empty store on invalid schema (missing version)', async () => {
      writeFileSync(TEST_FILE, JSON.stringify({ annotations: [], pageNotes: [] }), 'utf-8');

      const storage = new ReviewStorage(TEST_FILE);
      const store = await storage.read();

      expect(store).toEqual(createEmptyStore());
    });

    it('returns empty store on invalid schema (wrong version)', async () => {
      writeFileSync(TEST_FILE, JSON.stringify({ version: 99, annotations: [], pageNotes: [] }), 'utf-8');

      const storage = new ReviewStorage(TEST_FILE);
      const store = await storage.read();

      expect(store).toEqual(createEmptyStore());
    });

    it('returns empty store on invalid schema (annotations not array)', async () => {
      writeFileSync(TEST_FILE, JSON.stringify({ version: 1, annotations: 'wrong', pageNotes: [] }), 'utf-8');

      const storage = new ReviewStorage(TEST_FILE);
      const store = await storage.read();

      expect(store).toEqual(createEmptyStore());
    });
  });

  describe('write', () => {
    it('writes store to disk as formatted JSON', async () => {
      const storage = new ReviewStorage(TEST_FILE);
      const store = createEmptyStore();
      store.annotations.push({
        id: 'w-1',
        pageUrl: '/',
        pageTitle: 'Home',
        selectedText: 'test',
        note: 'a note',
        range: { startXPath: '', startOffset: 0, endXPath: '', endOffset: 0, selectedText: 'test', contextBefore: '', contextAfter: '' },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      });

      await storage.write(store);

      const read = await storage.read();
      expect(read.annotations.length).toBe(1);
      expect(read.annotations[0].id).toBe('w-1');
    });

    it('serialises concurrent writes without corruption', async () => {
      const storage = new ReviewStorage(TEST_FILE);

      // Fire multiple writes concurrently
      const writes = Array.from({ length: 5 }, (_, i) => {
        const store = createEmptyStore();
        store.annotations.push({
          id: `concurrent-${i}`,
          pageUrl: '/',
          pageTitle: '',
          selectedText: `text-${i}`,
          note: '',
          range: { startXPath: '', startOffset: 0, endXPath: '', endOffset: 0, selectedText: '', contextBefore: '', contextAfter: '' },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        return storage.write(store);
      });

      await Promise.all(writes);

      // File should be valid JSON (last write wins)
      const result = await storage.read();
      expect(result.version).toBe(1);
      expect(result.annotations.length).toBe(1);
    });
  });

  describe('mutate', () => {
    it('serialises concurrent mutations (no lost updates)', async () => {
      const storage = new ReviewStorage(TEST_FILE);
      await storage.write(createEmptyStore());

      // Fire 5 concurrent mutations, each adding one annotation.
      // Without serialisation, only the last write would survive.
      const mutations = Array.from({ length: 5 }, (_, i) =>
        storage.mutate(store => {
          store.annotations.push(makeTextAnnotation(`mutate-${i}`));
          return store;
        })
      );

      await Promise.all(mutations);

      const result = await storage.read();
      expect(result.annotations.length).toBe(5);
    });

    it('returns the modified store', async () => {
      const storage = new ReviewStorage(TEST_FILE);
      await storage.write(createEmptyStore());

      const result = await storage.mutate(store => {
        store.annotations.push(makeTextAnnotation('returned'));
        return store;
      });

      expect(result.annotations.length).toBe(1);
      expect(result.annotations[0].id).toBe('returned');
    });

    it('does not write when callback throws', async () => {
      const storage = new ReviewStorage(TEST_FILE);
      const initial = createEmptyStore();
      initial.annotations.push(makeTextAnnotation('keep-me'));
      await storage.write(initial);

      await expect(storage.mutate(() => {
        throw new Error('abort');
      })).rejects.toThrow('abort');

      const result = await storage.read();
      expect(result.annotations.length).toBe(1);
      expect(result.annotations[0].id).toBe('keep-me');
    });

    it('continues processing after a failed mutation', async () => {
      const storage = new ReviewStorage(TEST_FILE);
      await storage.write(createEmptyStore());

      // First mutation fails
      await expect(storage.mutate(() => {
        throw new Error('fail');
      })).rejects.toThrow('fail');

      // Second mutation should succeed — queue is not broken
      const result = await storage.mutate(store => {
        store.annotations.push(makeTextAnnotation('after-error'));
        return store;
      });

      expect(result.annotations.length).toBe(1);
      expect(result.annotations[0].id).toBe('after-error');
    });

    it('supports async callbacks', async () => {
      const storage = new ReviewStorage(TEST_FILE);
      await storage.write(createEmptyStore());

      const result = await storage.mutate(async store => {
        await new Promise(resolve => setTimeout(resolve, 10));
        store.annotations.push(makeTextAnnotation('async'));
        return store;
      });

      expect(result.annotations.length).toBe(1);
      expect(result.annotations[0].id).toBe('async');
    });
  });
});
