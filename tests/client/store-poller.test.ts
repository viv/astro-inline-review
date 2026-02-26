import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createStorePoller } from '../../src/client/store-poller.js';

describe('createStorePoller', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Mock window.location.pathname
    Object.defineProperty(window, 'location', {
      value: { pathname: '/test-page' },
      writable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function mockFetchResponse(store: object) {
    return vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(store),
    });
  }

  it('first poll sets fingerprint without triggering callback', async () => {
    const onStoreChanged = vi.fn();
    const store = {
      annotations: [{ updatedAt: '2026-01-01T00:00:00Z' }],
      pageNotes: [],
    };
    globalThis.fetch = mockFetchResponse(store);

    const poller = createStorePoller({ onStoreChanged, interval: 1000 });
    poller.start();

    // Let the first poll resolve
    await vi.advanceTimersByTimeAsync(0);

    expect(onStoreChanged).not.toHaveBeenCalled();
    poller.stop();
  });

  it('triggers callback when fingerprint changes', async () => {
    const onStoreChanged = vi.fn();
    const store1 = {
      annotations: [{ updatedAt: '2026-01-01T00:00:00Z' }],
      pageNotes: [],
    };
    const store2 = {
      annotations: [
        { updatedAt: '2026-01-01T00:00:00Z' },
        { updatedAt: '2026-01-01T01:00:00Z' },
      ],
      pageNotes: [],
    };

    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      const store = callCount === 1 ? store1 : store2;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(store),
      });
    });

    const poller = createStorePoller({ onStoreChanged, interval: 1000 });
    poller.start();

    // First poll — sets baseline
    await vi.advanceTimersByTimeAsync(0);
    expect(onStoreChanged).not.toHaveBeenCalled();

    // Second poll — fingerprint changed
    await vi.advanceTimersByTimeAsync(1000);
    expect(onStoreChanged).toHaveBeenCalledTimes(1);

    poller.stop();
  });

  it('does not trigger callback when fingerprint stays the same', async () => {
    const onStoreChanged = vi.fn();
    const store = {
      annotations: [{ updatedAt: '2026-01-01T00:00:00Z' }],
      pageNotes: [],
    };
    globalThis.fetch = mockFetchResponse(store);

    const poller = createStorePoller({ onStoreChanged, interval: 1000 });
    poller.start();

    // First poll — sets baseline
    await vi.advanceTimersByTimeAsync(0);

    // Second poll — same data
    await vi.advanceTimersByTimeAsync(1000);

    // Third poll — same data
    await vi.advanceTimersByTimeAsync(1000);

    expect(onStoreChanged).not.toHaveBeenCalled();
    poller.stop();
  });

  it('handles API errors gracefully without crashing', async () => {
    const onStoreChanged = vi.fn();
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const poller = createStorePoller({ onStoreChanged, interval: 1000 });
    poller.start();

    // Should not throw
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1000);

    expect(onStoreChanged).not.toHaveBeenCalled();
    poller.stop();
  });

  it('handles non-ok HTTP responses gracefully', async () => {
    const onStoreChanged = vi.fn();
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });

    const poller = createStorePoller({ onStoreChanged, interval: 1000 });
    poller.start();

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1000);

    expect(onStoreChanged).not.toHaveBeenCalled();
    poller.stop();
  });

  it('stop prevents further polling', async () => {
    const onStoreChanged = vi.fn();
    const store1 = {
      annotations: [{ updatedAt: '2026-01-01T00:00:00Z' }],
      pageNotes: [],
    };

    globalThis.fetch = mockFetchResponse(store1);

    const poller = createStorePoller({ onStoreChanged, interval: 1000 });
    poller.start();

    // First poll — sets baseline
    await vi.advanceTimersByTimeAsync(0);

    // Stop the poller
    poller.stop();

    // Now change the mock to return different data
    const store2 = {
      annotations: [
        { updatedAt: '2026-01-01T00:00:00Z' },
        { updatedAt: '2026-01-01T01:00:00Z' },
      ],
      pageNotes: [],
    };
    globalThis.fetch = mockFetchResponse(store2);

    // Advance time — should NOT trigger callback
    await vi.advanceTimersByTimeAsync(5000);
    expect(onStoreChanged).not.toHaveBeenCalled();
  });

  it('includes page notes in fingerprint', async () => {
    const onStoreChanged = vi.fn();
    const store1 = {
      annotations: [{ updatedAt: '2026-01-01T00:00:00Z' }],
      pageNotes: [],
    };
    const store2 = {
      annotations: [{ updatedAt: '2026-01-01T00:00:00Z' }],
      pageNotes: [{ updatedAt: '2026-01-01T02:00:00Z' }],
    };

    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      const store = callCount === 1 ? store1 : store2;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(store),
      });
    });

    const poller = createStorePoller({ onStoreChanged, interval: 1000 });
    poller.start();

    // First poll — baseline
    await vi.advanceTimersByTimeAsync(0);
    expect(onStoreChanged).not.toHaveBeenCalled();

    // Second poll — page note added, fingerprint changed
    await vi.advanceTimersByTimeAsync(1000);
    expect(onStoreChanged).toHaveBeenCalledTimes(1);

    poller.stop();
  });
});
