import type { TextAnnotation, ElementAnnotation, PageNote } from '../../../src/shared/types.js';

export function makeTextAnnotation(
  id: string,
  pageUrl: string,
  noteOrText: string,
  note?: string,
): TextAnnotation {
  // Support both 3-arg (id, pageUrl, note) and 4-arg (id, pageUrl, selectedText, note) signatures
  const selectedText = note !== undefined ? noteOrText : 'some text';
  const actualNote = note !== undefined ? note : noteOrText;

  return {
    id,
    type: 'text',
    pageUrl,
    pageTitle: 'Test Page',
    selectedText,
    note: actualNote,
    range: { startXPath: '', startOffset: 0, endXPath: '', endOffset: 0, selectedText, contextBefore: '', contextAfter: '' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

export function makeElementAnnotation(
  id: string,
  pageUrl: string,
  note: string,
): ElementAnnotation {
  return {
    id,
    type: 'element',
    pageUrl,
    pageTitle: 'Test Page',
    note,
    elementSelector: {
      cssSelector: 'div.test',
      xpath: '/html[1]/body[1]/div[1]',
      description: 'Test element',
      tagName: 'div',
      attributes: {},
      outerHtmlPreview: '<div class="test">',
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

export function makePageNote(
  id: string,
  pageUrl: string,
  note: string,
): PageNote {
  return {
    id,
    pageUrl,
    pageTitle: 'Test Page',
    note,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}
