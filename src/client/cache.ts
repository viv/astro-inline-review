import type { ReviewStore } from './types.js';

const STORAGE_KEY = 'review-loop';

/** Read cached store from localStorage (fast, may be stale) */
export function readCache(): ReviewStore | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ReviewStore;
  } catch {
    return null;
  }
}

/** Write store to localStorage cache */
export function writeCache(store: ReviewStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // localStorage full or unavailable — ignore
  }
}
