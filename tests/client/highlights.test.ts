import { describe, it, expect, beforeEach } from 'vitest';
import {
  applyHighlight,
  removeHighlight,
  getHighlightMarks,
  HIGHLIGHT_ATTR,
} from '../../src/client/highlights.js';

describe('applyHighlight', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('wraps a text range in a <mark> element', () => {
    document.body.innerHTML = '<p>The quick brown fox</p>';
    const textNode = document.querySelector('p')!.firstChild!;

    const range = document.createRange();
    range.setStart(textNode, 10);
    range.setEnd(textNode, 15);

    applyHighlight(range, 'test-id-1');

    const marks = document.querySelectorAll('mark');
    expect(marks.length).toBe(1);
    expect(marks[0].textContent).toBe('brown');
  });

  it('sets data-air-id attribute on the mark', () => {
    document.body.innerHTML = '<p>Hello world</p>';
    const textNode = document.querySelector('p')!.firstChild!;

    const range = document.createRange();
    range.setStart(textNode, 0);
    range.setEnd(textNode, 5);

    applyHighlight(range, 'abc-123');

    const mark = document.querySelector('mark')!;
    expect(mark.getAttribute(HIGHLIGHT_ATTR)).toBe('abc-123');
  });

  it('applies inline styles for background and cursor', () => {
    document.body.innerHTML = '<p>Hello world</p>';
    const textNode = document.querySelector('p')!.firstChild!;

    const range = document.createRange();
    range.setStart(textNode, 0);
    range.setEnd(textNode, 5);

    applyHighlight(range, 'id-1');

    const mark = document.querySelector('mark')!;
    expect(mark.style.backgroundColor).toBeTruthy();
    expect(mark.style.borderRadius).toBeTruthy();
    expect(mark.style.cursor).toBe('pointer');
  });

  it('preserves surrounding text content', () => {
    document.body.innerHTML = '<p>The quick brown fox</p>';
    const textNode = document.querySelector('p')!.firstChild!;

    const range = document.createRange();
    range.setStart(textNode, 10);
    range.setEnd(textNode, 15);

    applyHighlight(range, 'id-1');

    const p = document.querySelector('p')!;
    expect(p.textContent).toBe('The quick brown fox');
  });

  it('handles cross-element selection with multiple marks', () => {
    document.body.innerHTML = '<p>Start text <strong>bold text</strong> end text</p>';
    const startText = document.querySelector('p')!.firstChild!;
    const boldText = document.querySelector('strong')!.firstChild!;

    const range = document.createRange();
    range.setStart(startText, 6);
    range.setEnd(boldText, 4);

    applyHighlight(range, 'cross-id');

    const marks = document.querySelectorAll('mark');
    // Should have marks with the same ID
    expect(marks.length).toBeGreaterThanOrEqual(1);
    for (const mark of marks) {
      expect(mark.getAttribute(HIGHLIGHT_ATTR)).toBe('cross-id');
    }
  });

  it('does not introduce extra whitespace', () => {
    document.body.innerHTML = '<p>Hello world</p>';
    const textNode = document.querySelector('p')!.firstChild!;

    const range = document.createRange();
    range.setStart(textNode, 0);
    range.setEnd(textNode, 5);

    applyHighlight(range, 'id-1');

    const p = document.querySelector('p')!;
    // Text content should be exactly preserved
    expect(p.textContent).toBe('Hello world');
    // No extra whitespace nodes
    expect(p.innerHTML).not.toMatch(/\s{2,}/);
  });
});

describe('removeHighlight', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('removes a mark and restores the original text', () => {
    document.body.innerHTML = '<p>The quick <mark data-air-id="id-1" style="background-color: rgba(217,119,6,0.3); border-radius: 2px; cursor: pointer;">brown</mark> fox</p>';

    removeHighlight('id-1');

    expect(document.querySelectorAll('mark').length).toBe(0);
    expect(document.querySelector('p')!.textContent).toBe('The quick brown fox');
  });

  it('removes multiple marks with the same ID (cross-element)', () => {
    document.body.innerHTML = `
      <p><mark data-air-id="id-1" style="">first</mark> middle <mark data-air-id="id-1" style="">second</mark></p>
    `;

    removeHighlight('id-1');

    expect(document.querySelectorAll('mark').length).toBe(0);
  });

  it('does not remove marks with different IDs', () => {
    document.body.innerHTML = `
      <p><mark data-air-id="id-1" style="">first</mark> <mark data-air-id="id-2" style="">second</mark></p>
    `;

    removeHighlight('id-1');

    expect(document.querySelectorAll('mark').length).toBe(1);
    expect(document.querySelector('mark')!.getAttribute(HIGHLIGHT_ATTR)).toBe('id-2');
  });

  it('normalises text nodes after removal', () => {
    document.body.innerHTML = '<p>before <mark data-air-id="id-1" style="">middle</mark> after</p>';

    removeHighlight('id-1');

    const p = document.querySelector('p')!;
    // After normalise(), adjacent text nodes should merge
    p.normalize();
    expect(p.childNodes.length).toBe(1);
    expect(p.textContent).toBe('before middle after');
  });
});

describe('getHighlightMarks', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('returns all marks for a given ID', () => {
    document.body.innerHTML = `
      <p><mark data-air-id="id-1" style="">one</mark> <mark data-air-id="id-1" style="">two</mark></p>
      <p><mark data-air-id="id-2" style="">three</mark></p>
    `;

    const marks = getHighlightMarks('id-1');
    expect(marks.length).toBe(2);
  });

  it('returns empty array when no marks match', () => {
    document.body.innerHTML = '<p>No marks here</p>';
    const marks = getHighlightMarks('nonexistent');
    expect(marks.length).toBe(0);
  });
});
