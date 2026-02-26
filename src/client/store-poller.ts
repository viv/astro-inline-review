/**
 * Lightweight store-change poller.
 *
 * Periodically fetches a fingerprint from the server's /version endpoint
 * and compares it to the last known value. When the fingerprint changes —
 * e.g. after an MCP tool updates inline-review.json — fires the
 * onStoreChanged callback so the UI can re-restore highlights.
 */

const DEFAULT_INTERVAL = 2000;
const API_BASE = '/__inline-review/api';

export interface StorePollerOptions {
  /** Polling interval in milliseconds (default: 2000) */
  interval?: number;
  /** Called when the store fingerprint changes */
  onStoreChanged: () => void;
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
      const res = await fetch(`${API_BASE}/version`);
      if (!res.ok) return;

      const data: { fingerprint: string } = await res.json();

      if (lastFingerprint === null) {
        // First poll — set baseline without triggering callback
        lastFingerprint = data.fingerprint;
        return;
      }

      if (data.fingerprint !== lastFingerprint) {
        lastFingerprint = data.fingerprint;
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
