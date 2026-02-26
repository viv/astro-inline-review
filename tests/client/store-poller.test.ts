import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createStorePoller } from '../../src/client/store-poller.js';

describe('createStorePoller', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function mockVersionResponse(fingerprint: string) {
    return vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ fingerprint }),
    });
  }

  it('first poll sets fingerprint without triggering callback', async () => {
    const onStoreChanged = vi.fn();
    globalThis.fetch = mockVersionResponse('1:2026-01-01T00:00:00Z');

    const poller = createStorePoller({ onStoreChanged, interval: 1000 });
    poller.start();

    // Let the first poll resolve
    await vi.advanceTimersByTimeAsync(0);

    expect(onStoreChanged).not.toHaveBeenCalled();
    expect(globalThis.fetch).toHaveBeenCalledWith('/__inline-review/api/version');
    poller.stop();
  });

  it('triggers callback when fingerprint changes', async () => {
    const onStoreChanged = vi.fn();
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      const fingerprint = callCount === 1
        ? '1:2026-01-01T00:00:00Z'
        : '2:2026-01-01T01:00:00Z';
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ fingerprint }),
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
    globalThis.fetch = mockVersionResponse('1:2026-01-01T00:00:00Z');

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
    globalThis.fetch = mockVersionResponse('1:2026-01-01T00:00:00Z');

    const poller = createStorePoller({ onStoreChanged, interval: 1000 });
    poller.start();

    // First poll — sets baseline
    await vi.advanceTimersByTimeAsync(0);

    // Stop the poller
    poller.stop();

    // Now change the mock to return a different fingerprint
    globalThis.fetch = mockVersionResponse('2:2026-01-01T01:00:00Z');

    // Advance time — should NOT trigger callback
    await vi.advanceTimersByTimeAsync(5000);
    expect(onStoreChanged).not.toHaveBeenCalled();
  });

  it('detects changes from page note additions via fingerprint', async () => {
    const onStoreChanged = vi.fn();
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      // Fingerprint changes: count goes from 1 to 2 (page note added)
      const fingerprint = callCount === 1
        ? '1:2026-01-01T00:00:00Z'
        : '2:2026-01-01T02:00:00Z';
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ fingerprint }),
      });
    });

    const poller = createStorePoller({ onStoreChanged, interval: 1000 });
    poller.start();

    // First poll — baseline
    await vi.advanceTimersByTimeAsync(0);
    expect(onStoreChanged).not.toHaveBeenCalled();

    // Second poll — fingerprint changed (page note added)
    await vi.advanceTimersByTimeAsync(1000);
    expect(onStoreChanged).toHaveBeenCalledTimes(1);

    poller.stop();
  });

  it('uses default interval of 2000ms', async () => {
    const onStoreChanged = vi.fn();
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ fingerprint: `${callCount}:ts` }),
      });
    });

    const poller = createStorePoller({ onStoreChanged });
    poller.start();

    // First poll fires immediately
    await vi.advanceTimersByTimeAsync(0);
    expect(callCount).toBe(1);

    // At 1000ms — no second poll yet (default is 2000ms)
    await vi.advanceTimersByTimeAsync(1000);
    expect(callCount).toBe(1);

    // At 2000ms — second poll fires
    await vi.advanceTimersByTimeAsync(1000);
    expect(callCount).toBe(2);

    poller.stop();
  });

  it('start is idempotent — calling start twice does not create duplicate timers', async () => {
    const onStoreChanged = vi.fn();
    globalThis.fetch = mockVersionResponse('1:2026-01-01T00:00:00Z');

    const poller = createStorePoller({ onStoreChanged, interval: 1000 });
    poller.start();
    poller.start(); // Second call should be no-op

    await vi.advanceTimersByTimeAsync(0);

    // Should have been called once, not twice
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    poller.stop();
  });
});
