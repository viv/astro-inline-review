import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { OrphanTracker } from '../../src/client/orphan-tracker.js';

describe('OrphanTracker', () => {
  let tracker: OrphanTracker;

  beforeEach(() => {
    vi.useFakeTimers();
    tracker = new OrphanTracker(15_000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "anchored" when DOM highlight exists', () => {
    const state = tracker.getOrphanState('ann-1', '/', true, 'open');
    expect(state).toBe('anchored');
  });

  it('returns "checking" immediately when annotation first becomes unanchored', () => {
    const state = tracker.getOrphanState('ann-1', '/', false, 'open');
    expect(state).toBe('checking');
  });

  it('returns "checking" during grace period', () => {
    tracker.getOrphanState('ann-1', '/', false, 'open');
    vi.advanceTimersByTime(10_000); // 10s < 15s grace period
    const state = tracker.getOrphanState('ann-1', '/', false, 'open');
    expect(state).toBe('checking');
  });

  it('returns "orphaned" after grace period expires', () => {
    tracker.getOrphanState('ann-1', '/', false, 'open');
    vi.advanceTimersByTime(15_000);
    const state = tracker.getOrphanState('ann-1', '/', false, 'open');
    expect(state).toBe('orphaned');
  });

  it('returns "checking" for in_progress annotations even after grace period', () => {
    tracker.getOrphanState('ann-1', '/', false, 'in_progress');
    vi.advanceTimersByTime(60_000); // well past grace period
    const state = tracker.getOrphanState('ann-1', '/', false, 'in_progress');
    expect(state).toBe('checking');
  });

  it('clears orphan timestamp when annotation becomes anchored again', () => {
    // First seen as unanchored
    tracker.getOrphanState('ann-1', '/', false, 'open');
    vi.advanceTimersByTime(10_000);

    // Re-anchored — clears the timestamp
    tracker.getOrphanState('ann-1', '/', true, 'open');

    // Becomes unanchored again — should start fresh grace period
    vi.advanceTimersByTime(10_000);
    const state = tracker.getOrphanState('ann-1', '/', false, 'open');
    expect(state).toBe('checking');
  });

  it('onStoreChanged clears all orphan timestamps', () => {
    // Start tracking two annotations
    tracker.getOrphanState('ann-1', '/', false, 'open');
    tracker.getOrphanState('ann-2', '/', false, 'open');
    vi.advanceTimersByTime(14_000);

    // Both near expiry — clear them
    tracker.onStoreChanged();

    // After clear, they get a fresh grace period
    vi.advanceTimersByTime(5_000);
    expect(tracker.getOrphanState('ann-1', '/', false, 'open')).toBe('checking');
    expect(tracker.getOrphanState('ann-2', '/', false, 'open')).toBe('checking');
  });

  it('tracks different annotations independently', () => {
    tracker.getOrphanState('ann-1', '/', false, 'open');
    vi.advanceTimersByTime(10_000);
    tracker.getOrphanState('ann-2', '/', false, 'open');
    vi.advanceTimersByTime(5_000); // ann-1 at 15s, ann-2 at 5s

    expect(tracker.getOrphanState('ann-1', '/', false, 'open')).toBe('orphaned');
    expect(tracker.getOrphanState('ann-2', '/', false, 'open')).toBe('checking');
  });

  it('uses custom grace period', () => {
    const shortTracker = new OrphanTracker(5_000);
    shortTracker.getOrphanState('ann-1', '/', false, 'open');
    vi.advanceTimersByTime(5_000);
    expect(shortTracker.getOrphanState('ann-1', '/', false, 'open')).toBe('orphaned');
  });
});
