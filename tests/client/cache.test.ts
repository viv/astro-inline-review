import { describe, it, expect, beforeEach } from 'vitest';
import { readCache, writeCache } from '../../src/client/cache.js';

describe('cache', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when no cache exists', () => {
    expect(readCache()).toBeNull();
  });

  it('writes and reads a store', () => {
    const store = { version: 1 as const, annotations: [], pageNotes: [] };
    writeCache(store);

    const result = readCache();
    expect(result).toEqual(store);
  });

  it('returns null on corrupted localStorage data', () => {
    localStorage.setItem('astro-inline-review', 'not json!!!');

    expect(readCache()).toBeNull();
  });

  it('overwrites existing cache', () => {
    const store1 = { version: 1 as const, annotations: [{ id: '1' }] as any, pageNotes: [] };
    const store2 = { version: 1 as const, annotations: [], pageNotes: [] };

    writeCache(store1);
    writeCache(store2);

    const result = readCache();
    expect(result?.annotations.length).toBe(0);
  });
});
