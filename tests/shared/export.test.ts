import { describe, it, expect } from 'vitest';
import { generateExport } from '../../src/shared/export.js';
import type { ReviewStore, TextAnnotation, ElementAnnotation } from '../../src/shared/types.js';

function makeTextAnnotation(overrides: Partial<TextAnnotation> = {}): TextAnnotation {
  return {
    id: 'txt-1',
    type: 'text',
    pageUrl: '/',
    pageTitle: 'Home',
    selectedText: 'hello world',
    note: 'fix this',
    range: { startXPath: '', startOffset: 0, endXPath: '', endOffset: 0, selectedText: 'hello world', contextBefore: '', contextAfter: '' },
    createdAt: '2026-02-22T09:00:00Z',
    updatedAt: '2026-02-22T09:00:00Z',
    ...overrides,
  };
}

function makeElementAnnotation(overrides: Partial<ElementAnnotation> = {}): ElementAnnotation {
  return {
    id: 'elem-1',
    type: 'element',
    pageUrl: '/',
    pageTitle: 'Home',
    note: 'fix element',
    elementSelector: {
      cssSelector: 'div.hero',
      xpath: '/html[1]/body[1]/div[1]',
      description: 'Hero section',
      tagName: 'div',
      attributes: {},
      outerHtmlPreview: '<div class="hero">',
    },
    createdAt: '2026-02-22T09:00:00Z',
    updatedAt: '2026-02-22T09:00:00Z',
    ...overrides,
  };
}

describe('generateExport', () => {
  it('produces minimal markdown for empty store', () => {
    const store: ReviewStore = { version: 1, annotations: [], pageNotes: [] };

    const result = generateExport(store);

    expect(result).toContain('# Inline Review');
    expect(result).toContain('No annotations or notes yet.');
    expect(result).not.toContain('---');
  });

  it('groups text annotations by page URL', () => {
    const store: ReviewStore = {
      version: 1,
      annotations: [
        makeTextAnnotation({ id: '1', pageUrl: '/', pageTitle: 'Home', selectedText: 'hello', note: 'fix home' }),
        makeTextAnnotation({ id: '2', pageUrl: '/about', pageTitle: 'About', selectedText: 'world', note: 'fix about' }),
      ],
      pageNotes: [],
    };

    const result = generateExport(store);

    expect(result).toContain('## / — Home');
    expect(result).toContain('## /about — About');
    expect(result).toContain('### Text Annotations');
    expect(result).toContain('**"hello"**');
    expect(result).toContain('> fix home');
    expect(result).toContain('**"world"**');
    expect(result).toContain('> fix about');
  });

  it('includes element annotations with selector and preview', () => {
    const store: ReviewStore = {
      version: 1,
      annotations: [makeElementAnnotation()],
      pageNotes: [],
    };

    const result = generateExport(store);

    expect(result).toContain('### Element Annotations');
    expect(result).toContain('`div.hero`');
    expect(result).toContain('`<div class="hero">`');
    expect(result).toContain('> fix element');
  });

  it('shows checkmark for resolved annotations', () => {
    const store: ReviewStore = {
      version: 1,
      annotations: [
        makeTextAnnotation({ resolvedAt: '2026-02-22T10:00:00Z' }),
      ],
      pageNotes: [],
    };

    const result = generateExport(store);

    expect(result).toContain('[Resolved]');
  });

  it('does not show checkmark for unresolved annotations', () => {
    const store: ReviewStore = {
      version: 1,
      annotations: [makeTextAnnotation()],
      pageNotes: [],
    };

    const result = generateExport(store);

    expect(result).not.toContain('[Resolved]');
  });

  it('includes agent replies in the export', () => {
    const store: ReviewStore = {
      version: 1,
      annotations: [
        makeTextAnnotation({
          replies: [
            { message: 'Fixed the typo', createdAt: '2026-02-22T10:00:00Z' },
            { message: 'Also updated tests', createdAt: '2026-02-22T11:00:00Z' },
          ],
        }),
      ],
      pageNotes: [],
    };

    const result = generateExport(store);

    expect(result).toContain('**Agent:** Fixed the typo');
    expect(result).toContain('**Agent:** Also updated tests');
  });

  it('includes page notes in the export', () => {
    const store: ReviewStore = {
      version: 1,
      annotations: [],
      pageNotes: [
        { id: 'pn-1', pageUrl: '/', pageTitle: 'Home', note: 'General feedback', createdAt: '', updatedAt: '' },
      ],
    };

    const result = generateExport(store);

    expect(result).toContain('### Page Notes');
    expect(result).toContain('- General feedback');
  });

  it('escapes backticks in element selectors and previews', () => {
    const store: ReviewStore = {
      version: 1,
      annotations: [
        makeElementAnnotation({
          elementSelector: {
            cssSelector: 'code.`highlight`',
            xpath: '',
            description: 'Code block',
            tagName: 'code',
            attributes: {},
            outerHtmlPreview: '<code class="`highlight`">',
          },
        }),
      ],
      pageNotes: [],
    };

    const result = generateExport(store);

    // Backticks should be escaped
    expect(result).toContain('\\`');
  });

  it('shows addressed label for addressed annotations', () => {
    const store: ReviewStore = {
      version: 1,
      annotations: [
        makeTextAnnotation({ status: 'addressed', addressedAt: '2026-02-22T10:00:00Z' }),
      ],
      pageNotes: [],
    };

    const result = generateExport(store);

    expect(result).toContain('🔧 [Addressed]');
    expect(result).not.toContain('[Resolved]');
  });

  it('shows resolved label for resolved annotations (via status field)', () => {
    const store: ReviewStore = {
      version: 1,
      annotations: [
        makeTextAnnotation({ status: 'resolved', resolvedAt: '2026-02-22T10:00:00Z' }),
      ],
      pageNotes: [],
    };

    const result = generateExport(store);

    expect(result).toContain('✅ [Resolved]');
    expect(result).not.toContain('[Addressed]');
  });

  it('shows no status label for open annotations', () => {
    const store: ReviewStore = {
      version: 1,
      annotations: [
        makeTextAnnotation({ status: 'open' }),
      ],
      pageNotes: [],
    };

    const result = generateExport(store);

    expect(result).not.toContain('[Resolved]');
    expect(result).not.toContain('[Addressed]');
  });

  it('shows no status label for annotations with no status field', () => {
    const store: ReviewStore = {
      version: 1,
      annotations: [makeTextAnnotation()],
      pageNotes: [],
    };

    const result = generateExport(store);

    expect(result).not.toContain('[Resolved]');
    expect(result).not.toContain('[Addressed]');
  });

  it('handles annotations without notes', () => {
    const store: ReviewStore = {
      version: 1,
      annotations: [makeTextAnnotation({ note: '' })],
      pageNotes: [],
    };

    const result = generateExport(store);

    expect(result).toContain('**"hello world"**');
    // Should not contain a blockquote for empty notes
    const lines = result.split('\n');
    const textLine = lines.findIndex(l => l.includes('**"hello world"**'));
    // Next non-empty line should not be a blockquote
    expect(lines[textLine + 1]?.trim().startsWith('>')).toBe(false);
  });
});
