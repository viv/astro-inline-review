import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import type { ReviewStore, Annotation } from '../types.js';
import { createEmptyStore } from '../types.js';

/**
 * Simple JSON file storage with atomic writes.
 *
 * Uses a write queue to prevent concurrent writes from corrupting the file.
 * Reads are always from disk (no in-memory cache) so the file can be
 * edited externally and changes are picked up immediately.
 */
export class ReviewStorage {
  private filePath: string;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async read(): Promise<ReviewStore> {
    if (!existsSync(this.filePath)) {
      return createEmptyStore();
    }

    try {
      const raw = await readFile(this.filePath, 'utf-8');
      const data = JSON.parse(raw) as ReviewStore;

      // Basic shape validation
      if (data.version !== 1 || !Array.isArray(data.annotations) || !Array.isArray(data.pageNotes)) {
        return createEmptyStore();
      }

      // Migration: annotations without a `type` field are legacy text annotations
      data.annotations = (data.annotations as unknown[]).map((raw) => {
        const a = raw as Record<string, unknown>;
        if (!a.type) {
          return { ...a, type: 'text' } as unknown as Annotation;
        }
        return a as unknown as Annotation;
      });

      return data;
    } catch {
      return createEmptyStore();
    }
  }

  async write(store: ReviewStore): Promise<void> {
    // Queue writes to prevent concurrent file corruption
    this.writeQueue = this.writeQueue.then(async () => {
      const json = JSON.stringify(store, null, 2) + '\n';
      await writeFile(this.filePath, json, 'utf-8');
    });
    return this.writeQueue;
  }

  /**
   * Atomically read-modify-write the store.
   *
   * Serialises with the write queue so that concurrent mutations
   * are applied sequentially — no lost updates. If `fn` throws,
   * the store is not written and the error propagates.
   */
  async mutate(fn: (store: ReviewStore) => ReviewStore | Promise<ReviewStore>): Promise<ReviewStore> {
    let result!: ReviewStore;
    let error: unknown;

    this.writeQueue = this.writeQueue
      .then(async () => {
        const store = await this.read();
        const modified = await fn(store);
        const json = JSON.stringify(modified, null, 2) + '\n';
        await writeFile(this.filePath, json, 'utf-8');
        result = modified;
      })
      .catch((err) => {
        error = err;
      });

    await this.writeQueue;
    if (error !== undefined) throw error;
    return result;
  }
}
