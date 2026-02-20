import { describe, it, expect, beforeEach } from 'vitest';
import {
  getXPath,
  serializeRange,
  findRangeByContext,
  type SerializedSelection,
} from '../../src/client/selection.js';

describe('getXPath', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('returns /html[1]/body[1] for body itself', () => {
    expect(getXPath(document.body)).toBe('/html[1]/body[1]');
  });

  it('generates correct XPath for a simple paragraph', () => {
    document.body.innerHTML = '<p>Hello</p>';
    const p = document.querySelector('p')!;
    expect(getXPath(p)).toBe('/html[1]/body[1]/p[1]');
  });

  it('differentiates siblings of the same tag', () => {
    document.body.innerHTML = '<p>First</p><p>Second</p>';
    const paragraphs = document.querySelectorAll('p');
    expect(getXPath(paragraphs[0])).toBe('/html[1]/body[1]/p[1]');
    expect(getXPath(paragraphs[1])).toBe('/html[1]/body[1]/p[2]');
  });

  it('handles nested elements', () => {
    document.body.innerHTML = '<div><span><em>Deep</em></span></div>';
    const em = document.querySelector('em')!;
    expect(getXPath(em)).toBe('/html[1]/body[1]/div[1]/span[1]/em[1]');
  });

  it('handles text nodes by referencing their parent element', () => {
    document.body.innerHTML = '<p>Hello world</p>';
    const textNode = document.querySelector('p')!.firstChild!;
    // Text nodes get referenced as parent + text() position
    const xpath = getXPath(textNode);
    expect(xpath).toContain('/p[1]');
    expect(xpath).toContain('text()');
  });

  it('handles mixed element and text node children', () => {
    document.body.innerHTML = '<p>Before <strong>bold</strong> after</p>';
    const p = document.querySelector('p')!;
    // "Before " is the first text node
    const firstText = p.childNodes[0];
    const xpath1 = getXPath(firstText);
    expect(xpath1).toMatch(/text\(\)\[1\]$/);

    // "bold" is inside <strong>
    const strongText = p.querySelector('strong')!.firstChild!;
    const xpath2 = getXPath(strongText);
    expect(xpath2).toContain('/strong[1]');

    // " after" is the third child
    const afterText = p.childNodes[2];
    const xpath3 = getXPath(afterText);
    expect(xpath3).toMatch(/text\(\)\[2\]$/);
  });
});

describe('serializeRange', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('serialises a simple same-node range', () => {
    document.body.innerHTML = '<p>The quick brown fox jumps over the lazy dog</p>';
    const textNode = document.querySelector('p')!.firstChild!;

    const range = document.createRange();
    range.setStart(textNode, 10); // "brown"
    range.setEnd(textNode, 15);

    const result = serializeRange(range);

    expect(result.selectedText).toBe('brown');
    expect(result.startOffset).toBe(10);
    expect(result.endOffset).toBe(15);
    expect(result.startXPath).toContain('/p[1]');
    expect(result.endXPath).toContain('/p[1]');
  });

  it('captures context before and after the selection', () => {
    document.body.innerHTML = '<p>The quick brown fox jumps over the lazy dog</p>';
    const textNode = document.querySelector('p')!.firstChild!;

    const range = document.createRange();
    range.setStart(textNode, 10);
    range.setEnd(textNode, 15);

    const result = serializeRange(range);

    // Context should be ~30 chars before and after
    expect(result.contextBefore).toBe('The quick ');
    expect(result.contextAfter).toBe(' fox jumps over the lazy dog');
  });

  it('handles context at the start of text (no context before)', () => {
    document.body.innerHTML = '<p>Hello world</p>';
    const textNode = document.querySelector('p')!.firstChild!;

    const range = document.createRange();
    range.setStart(textNode, 0);
    range.setEnd(textNode, 5);

    const result = serializeRange(range);

    expect(result.selectedText).toBe('Hello');
    expect(result.contextBefore).toBe('');
    expect(result.contextAfter).toBe(' world');
  });

  it('handles context at the end of text (no context after)', () => {
    document.body.innerHTML = '<p>Hello world</p>';
    const textNode = document.querySelector('p')!.firstChild!;

    const range = document.createRange();
    range.setStart(textNode, 6);
    range.setEnd(textNode, 11);

    const result = serializeRange(range);

    expect(result.selectedText).toBe('world');
    expect(result.contextBefore).toBe('Hello ');
    expect(result.contextAfter).toBe('');
  });

  it('truncates long context to ~30 characters', () => {
    const longText = 'A'.repeat(50) + 'TARGET' + 'B'.repeat(50);
    document.body.innerHTML = `<p>${longText}</p>`;
    const textNode = document.querySelector('p')!.firstChild!;

    const range = document.createRange();
    range.setStart(textNode, 50);
    range.setEnd(textNode, 56);

    const result = serializeRange(range);

    expect(result.selectedText).toBe('TARGET');
    expect(result.contextBefore.length).toBeLessThanOrEqual(30);
    expect(result.contextAfter.length).toBeLessThanOrEqual(30);
  });

  it('handles cross-element ranges', () => {
    document.body.innerHTML = '<p>Start text <strong>bold text</strong> end text</p>';
    const startText = document.querySelector('p')!.firstChild!;
    const endText = document.querySelector('strong')!.firstChild!;

    const range = document.createRange();
    range.setStart(startText, 6); // "text "
    range.setEnd(endText, 4); // "bold"

    const result = serializeRange(range);

    expect(result.selectedText).toBe('text bold');
    expect(result.startXPath).not.toBe(result.endXPath);
  });
});

describe('findRangeByContext', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('finds text by exact match with context', () => {
    document.body.innerHTML = '<p>The quick brown fox jumps over the lazy dog</p>';

    const result = findRangeByContext(
      'brown fox',
      'The quick ',
      ' jumps over',
    );

    expect(result).not.toBeNull();
    expect(result!.toString()).toBe('brown fox');
  });

  it('returns null when text is not found', () => {
    document.body.innerHTML = '<p>Hello world</p>';

    const result = findRangeByContext('nonexistent', '', '');
    expect(result).toBeNull();
  });

  it('disambiguates repeated text using context', () => {
    document.body.innerHTML = '<p>the cat sat on the mat</p>';

    // "the" appears twice — use context to pick the second one
    const result = findRangeByContext('the', 'on ', ' mat');

    expect(result).not.toBeNull();
    expect(result!.toString()).toBe('the');
    // "the cat sat on the mat" — second "the" starts at character 15
    expect(result!.startOffset).toBe(15);
  });

  it('falls back to first match when context does not disambiguate', () => {
    document.body.innerHTML = '<p>the the the</p>';

    const result = findRangeByContext('the', 'nonexistent', 'context');

    // Should still find "the" even though context doesn't match
    expect(result).not.toBeNull();
    expect(result!.toString()).toBe('the');
  });

  it('finds text across element boundaries', () => {
    document.body.innerHTML = '<p>Hello <em>beautiful</em> world</p>';

    const result = findRangeByContext('beautiful', 'Hello ', ' world');

    expect(result).not.toBeNull();
    expect(result!.toString()).toBe('beautiful');
  });
});
