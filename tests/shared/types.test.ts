import { describe, it, expect } from 'vitest';
import { getAnnotationStatus } from '../../src/shared/types.js';
import type { BaseAnnotation } from '../../src/shared/types.js';

function makeAnnotation(overrides: Partial<BaseAnnotation> = {}): BaseAnnotation {
  return {
    id: 'ann-1',
    type: 'text',
    pageUrl: '/',
    pageTitle: 'Home',
    note: 'test note',
    createdAt: '2026-02-23T09:00:00Z',
    updatedAt: '2026-02-23T09:00:00Z',
    ...overrides,
  };
}

describe('getAnnotationStatus', () => {
  it('returns open when status is open', () => {
    const annotation = makeAnnotation({ status: 'open' });

    expect(getAnnotationStatus(annotation)).toBe('open');
  });

  it('returns addressed when status is addressed', () => {
    const annotation = makeAnnotation({ status: 'addressed' });

    expect(getAnnotationStatus(annotation)).toBe('addressed');
  });

  it('returns resolved when status is resolved', () => {
    const annotation = makeAnnotation({ status: 'resolved' });

    expect(getAnnotationStatus(annotation)).toBe('resolved');
  });

  it('returns resolved for legacy annotation with resolvedAt but no status', () => {
    const annotation = makeAnnotation({ resolvedAt: '2026-02-23T10:00:00Z' });

    expect(getAnnotationStatus(annotation)).toBe('resolved');
  });

  it('returns open for legacy annotation with no status and no resolvedAt', () => {
    const annotation = makeAnnotation();

    expect(getAnnotationStatus(annotation)).toBe('open');
  });

  it('returns in_progress when status is in_progress', () => {
    const annotation = makeAnnotation({ status: 'in_progress' });

    expect(getAnnotationStatus(annotation)).toBe('in_progress');
  });

  it('returns open when status is open even if resolvedAt is set (status takes precedence)', () => {
    const annotation = makeAnnotation({
      status: 'open',
      resolvedAt: '2026-02-23T10:00:00Z',
    });

    expect(getAnnotationStatus(annotation)).toBe('open');
  });
});
