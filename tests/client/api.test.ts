import { describe, it, expect, beforeEach, vi } from 'vitest';
import { api } from '../../src/client/api.js';

describe('api', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('getStore calls GET /annotations with page filter', async () => {
    const mockStore = { version: 1, annotations: [], pageNotes: [] };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockStore), { status: 200 }),
    );

    const result = await api.getStore('/about');

    expect(fetch).toHaveBeenCalledWith(
      '/__inline-review/api/annotations?page=%2Fabout',
      expect.objectContaining({ headers: { 'Content-Type': 'application/json' } }),
    );
    expect(result.version).toBe(1);
  });

  it('createAnnotation calls POST /annotations', async () => {
    const mockAnnotation = { id: 'new-1', selectedText: 'test', note: 'note' };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockAnnotation), { status: 201 }),
    );

    const result = await api.createAnnotation({
      pageUrl: '/',
      pageTitle: 'Home',
      selectedText: 'test',
      note: 'note',
      range: { startXPath: '', startOffset: 0, endXPath: '', endOffset: 0, selectedText: 'test', contextBefore: '', contextAfter: '' },
    });

    expect(fetch).toHaveBeenCalledWith(
      '/__inline-review/api/annotations',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result.id).toBe('new-1');
  });

  it('deleteAnnotation calls DELETE /annotations/:id', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    await api.deleteAnnotation('del-1');

    expect(fetch).toHaveBeenCalledWith(
      '/__inline-review/api/annotations/del-1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('throws on non-OK response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'Not found' }), { status: 404 }),
    );

    await expect(api.deleteAnnotation('bad-id')).rejects.toThrow('Not found');
  });

  it('getExport returns markdown text', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('# Inline Review\nExported: 2026-02-20', { status: 200 }),
    );

    const result = await api.getExport();

    expect(result).toContain('# Inline Review');
  });
});
