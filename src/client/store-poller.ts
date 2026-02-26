/**
 * Lightweight store-change poller.
 *
 * Periodically fetches the annotation store and compares a fingerprint
 * (annotation count + latest updatedAt timestamp). When the fingerprint
 * changes — e.g. after an MCP tool updates inline-review.json — fires
 * the onStoreChanged callback so the UI can re-restore highlights.
 */

const DEFAULT_INTERVAL = 2000;
const API_BASE = '/__inline-review/api';

export interface StorePollerOptions {
  /** Polling interval in milliseconds (default: 2000) */
  interval?: number;
  /** Called when the store fingerprint changes */
  onStoreChanged: () => void;
}

interface StoreShape {
  annotations: Array<{ updatedAt?: string }>;
  pageNotes?: Array<{ updatedAt?: string }>;
}

function computeFingerprint(store: StoreShape): string {
  const count = store.annotations.length + (store.pageNotes?.length ?? 0);
  let latest = '';
  for (const a of store.annotations) {
    if (a.updatedAt && a.updatedAt > latest) latest = a.updatedAt;
  }
  for (const n of store.pageNotes ?? []) {
    if (n.updatedAt && n.updatedAt > latest) latest = n.updatedAt;
  }
  return `${count}:${latest}`;
}

export interface StorePoller {
  start: () => void;
  stop: () => void;
}

export function createStorePoller(options: StorePollerOptions): StorePoller {
  const interval = options.interval ?? DEFAULT_INTERVAL;
  let timerId: ReturnType<typeof setInterval> | null = null;
  let lastFingerprint: string | null = null;

  async function poll(): Promise<void> {
    try {
      const page = encodeURIComponent(window.location.pathname);
      const res = await fetch(`${API_BASE}/annotations?page=${page}`);
      if (!res.ok) return;

      const store: StoreShape = await res.json();
      const fingerprint = computeFingerprint(store);

      if (lastFingerprint === null) {
        // First poll — set baseline without triggering callback
        lastFingerprint = fingerprint;
        return;
      }

      if (fingerprint !== lastFingerprint) {
        lastFingerprint = fingerprint;
        options.onStoreChanged();
      }
    } catch {
      // Ignore — network hiccups, dev server restart, etc.
    }
  }

  function start(): void {
    if (timerId !== null) return;
    poll();
    timerId = setInterval(poll, interval);
  }

  function stop(): void {
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  return { start, stop };
}
