import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getXPath,
  resolveXPath,
  serializeRange,
  deserializeRange,
  findRangeByContext,
  longestMatchingSuffix,
  longestMatchingPrefix,
  getTextNodes,
  getBlockAncestor,
} from '../../src/client/selection.js';
import type { SerializedRange } from '../../src/shared/types.js';

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

  it('returns null when context does not match and threshold is not met', () => {
    document.body.innerHTML = '<p>the the the</p>';

    const result = findRangeByContext('the', 'nonexistent', 'context');

    // Non-matching context with maxPossibleScore > 0 falls below confidence threshold
    expect(result).toBeNull();
  });

  it('finds text across element boundaries', () => {
    document.body.innerHTML = '<p>Hello <em>beautiful</em> world</p>';

    const result = findRangeByContext('beautiful', 'Hello ', ' world');

    expect(result).not.toBeNull();
    expect(result!.toString()).toBe('beautiful');
  });
});

describe('longestMatchingSuffix', () => {
  it('returns full length when text ends with exact suffix', () => {
    expect(longestMatchingSuffix('hello world', 'world')).toBe(5);
  });

  it('returns partial length when only tail of suffix matches', () => {
    // ' world' (6 chars including space) is the longest matching suffix
    expect(longestMatchingSuffix('hello world', 'the world')).toBe(6);
  });

  it('returns 1 for single character match at end', () => {
    expect(longestMatchingSuffix('abc', 'xc')).toBe(1);
  });

  it('returns 0 when no suffix matches', () => {
    expect(longestMatchingSuffix('abc', 'xyz')).toBe(0);
  });

  it('returns 0 for empty suffix', () => {
    expect(longestMatchingSuffix('abc', '')).toBe(0);
  });

  it('returns 0 for empty text', () => {
    expect(longestMatchingSuffix('', 'abc')).toBe(0);
  });

  it('returns 0 when both are empty', () => {
    expect(longestMatchingSuffix('', '')).toBe(0);
  });

  it('returns full length when strings are identical', () => {
    expect(longestMatchingSuffix('abc', 'abc')).toBe(3);
  });

  it('matches up to text length when suffix is longer', () => {
    expect(longestMatchingSuffix('bc', 'abc')).toBe(2);
  });
});

describe('longestMatchingPrefix', () => {
  it('returns full length when text starts with exact prefix', () => {
    expect(longestMatchingPrefix('hello world', 'hello')).toBe(5);
  });

  it('returns partial length when only head of prefix matches', () => {
    // 'hello ' (6 chars including space) is the longest matching prefix
    expect(longestMatchingPrefix('hello world', 'hello there')).toBe(6);
  });

  it('returns 1 for single character match at start', () => {
    expect(longestMatchingPrefix('abc', 'ax')).toBe(1);
  });

  it('returns 0 when no prefix matches', () => {
    expect(longestMatchingPrefix('abc', 'xyz')).toBe(0);
  });

  it('returns 0 for empty prefix', () => {
    expect(longestMatchingPrefix('abc', '')).toBe(0);
  });

  it('returns 0 for empty text', () => {
    expect(longestMatchingPrefix('', 'abc')).toBe(0);
  });

  it('returns 0 when both are empty', () => {
    expect(longestMatchingPrefix('', '')).toBe(0);
  });

  it('returns full length when strings are identical', () => {
    expect(longestMatchingPrefix('abc', 'abc')).toBe(3);
  });

  it('matches up to text length when prefix is longer', () => {
    expect(longestMatchingPrefix('ab', 'abc')).toBe(2);
  });
});

describe('findRangeByContext — graduated scoring', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('scores partial context match proportionally', () => {
    // Two occurrences of "fox": one with good context, one without
    document.body.innerHTML = '<p>The quick brown fox jumps. A sly red fox runs.</p>';

    // Context matches the first "fox" perfectly
    const result = findRangeByContext('fox', 'quick brown ', ' jumps');

    expect(result).not.toBeNull();
    expect(result!.toString()).toBe('fox');
    // Verify it picked the first "fox" (starts at offset 16)
    // "The quick brown fox jumps..."
    //  0123456789012345678
    expect(result!.startOffset).toBe(16);
  });

  it('selects higher-scoring match when context partially differs', () => {
    // "the" appears at positions 0 and 19
    // "the cat sat on --- the mat and more text here"
    document.body.innerHTML = '<p>the cat sat on --- the mat and more text here</p>';

    // Context "on --- " matches second "the" with 7 chars suffix match
    // Context " mat" matches second "the" with 4 chars prefix match
    // First "the" has no context match
    const result = findRangeByContext('the', 'on --- ', ' mat');

    expect(result).not.toBeNull();
    expect(result!.toString()).toBe('the');
    expect(result!.startOffset).toBe(19);
  });

  it('returns null for single occurrence with low confidence', () => {
    document.body.innerHTML = '<p>some text with the word here and more padding around it</p>';

    // "word" exists once but context is completely wrong
    // maxPossibleScore = 10 + 10 = 20, threshold = 6, bestScore = 0
    const result = findRangeByContext('word', 'xxxxxxxxxx', 'yyyyyyyyyy');

    expect(result).toBeNull();
  });

  it('accepts match when empty context makes maxPossibleScore zero', () => {
    document.body.innerHTML = '<p>Hello world</p>';

    // Both contexts empty — maxPossibleScore = 0, threshold check skipped
    const result = findRangeByContext('Hello', '', '');

    expect(result).not.toBeNull();
    expect(result!.toString()).toBe('Hello');
  });

  it('picks first occurrence on tie', () => {
    // Three identical "abc" with identical surrounding context
    document.body.innerHTML = '<p>xxxabcyyy xxxabcyyy xxxabcyyy</p>';

    const result = findRangeByContext('abc', 'xxx', 'yyy');

    expect(result).not.toBeNull();
    expect(result!.toString()).toBe('abc');
    // First "abc" starts at offset 3
    expect(result!.startOffset).toBe(3);
  });

  it('works with very short context (1 char)', () => {
    document.body.innerHTML = '<p>xAy and zAw</p>';

    // "A" appears at positions 1 and 8
    // Context "x" / "y" matches first occurrence
    const result = findRangeByContext('A', 'x', 'y');

    expect(result).not.toBeNull();
    expect(result!.toString()).toBe('A');
    expect(result!.startOffset).toBe(1);
  });

  it('graduated scoring beats no match for disambiguation', () => {
    // "cat" appears twice with different surrounding text
    document.body.innerHTML = '<p>the big cat ran and the fat cat sat</p>';

    // Context mostly matches second "cat" — "fat " is 4 chars of suffix match
    // vs first "cat" where "big " is 4 chars but "sat" only matches second
    const result = findRangeByContext('cat', 'the fat ', ' sat');

    expect(result).not.toBeNull();
    expect(result!.toString()).toBe('cat');
    // Second "cat" starts at offset 27: "the big cat ran and the fat cat sat"
    //                                    0         1         2         3
    //                                    0123456789012345678901234567890123456
    expect(result!.startOffset).toBe(28);
  });
});

describe('deserializeRange', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('resolves a valid XPath to the correct range', () => {
    document.body.innerHTML = '<p>The quick brown fox</p>';
    const textNode = document.querySelector('p')!.firstChild!;

    // happy-dom does not implement document.evaluate or XPathResult,
    // so we polyfill both for this test
    const xpath = getXPath(textNode);
    const originalEvaluate = (document as any).evaluate;
    const originalXPathResult = (globalThis as any).XPathResult;

    (globalThis as any).XPathResult = { FIRST_ORDERED_NODE_TYPE: 9 };
    (document as any).evaluate = () => ({ singleNodeValue: textNode });

    try {
      const serialized: SerializedRange = {
        startXPath: xpath,
        startOffset: 10,
        endXPath: xpath,
        endOffset: 15,
        selectedText: 'brown',
        contextBefore: 'The quick ',
        contextAfter: ' fox',
      };

      const restored = deserializeRange(serialized);

      expect(restored).not.toBeNull();
      expect(restored!.toString()).toBe('brown');
      expect(restored!.startOffset).toBe(10);
      expect(restored!.endOffset).toBe(15);
    } finally {
      if (originalEvaluate) {
        (document as any).evaluate = originalEvaluate;
      } else {
        delete (document as any).evaluate;
      }
      if (originalXPathResult) {
        (globalThis as any).XPathResult = originalXPathResult;
      } else {
        delete (globalThis as any).XPathResult;
      }
    }
  });

  it('returns null for an invalid XPath', () => {
    document.body.innerHTML = '<p>Hello world</p>';

    const serialized: SerializedRange = {
      startXPath: '/html[1]/body[1]/div[99]/text()[1]',
      startOffset: 0,
      endXPath: '/html[1]/body[1]/div[99]/text()[1]',
      endOffset: 5,
      selectedText: 'Hello',
      contextBefore: '',
      contextAfter: ' world',
    };

    const result = deserializeRange(serialized);
    expect(result).toBeNull();
  });

  it('returns null when offsets do not match the expected text', () => {
    document.body.innerHTML = '<p>Hello world</p>';
    const textNode = document.querySelector('p')!.firstChild!;
    const xpath = getXPath(textNode);

    const serialized: SerializedRange = {
      startXPath: xpath,
      startOffset: 0,
      endXPath: xpath,
      endOffset: 5,
      selectedText: 'Wrong', // Text at offset 0-5 is "Hello", not "Wrong"
      contextBefore: '',
      contextAfter: ' world',
    };

    const result = deserializeRange(serialized);
    expect(result).toBeNull();
  });

  it('returns null when the target node has been removed', () => {
    document.body.innerHTML = '<p>Hello world</p>';
    const textNode = document.querySelector('p')!.firstChild!;

    const range = document.createRange();
    range.setStart(textNode, 0);
    range.setEnd(textNode, 5);

    const serialized = serializeRange(range);

    // Remove the paragraph from the DOM
    document.body.innerHTML = '<div>Different content</div>';

    const result = deserializeRange(serialized);
    expect(result).toBeNull();
  });
});

describe('getTextNodes', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('returns text nodes from regular elements', () => {
    document.body.innerHTML = '<p>Hello <strong>world</strong></p>';
    const nodes = getTextNodes(document.body);
    const texts = nodes.map(n => n.textContent);
    expect(texts).toEqual(['Hello ', 'world']);
  });

  it('ignores text inside <script> elements', () => {
    document.body.innerHTML = '<p>Visible</p><script>var x = 1;</script>';
    const nodes = getTextNodes(document.body);
    const texts = nodes.map(n => n.textContent);
    expect(texts).toEqual(['Visible']);
  });

  it('ignores text inside <style> elements', () => {
    document.body.innerHTML = '<p>Visible</p><style>.foo { color: red; }</style>';
    const nodes = getTextNodes(document.body);
    const texts = nodes.map(n => n.textContent);
    expect(texts).toEqual(['Visible']);
  });

  it('ignores text inside <noscript> elements', () => {
    document.body.innerHTML = '<p>Visible</p><noscript>Enable JS</noscript>';
    const nodes = getTextNodes(document.body);
    const texts = nodes.map(n => n.textContent);
    expect(texts).toEqual(['Visible']);
  });

  it('ignores nested text within excluded elements', () => {
    document.body.innerHTML = '<p>Before</p><script><span>nested</span></script><p>After</p>';
    const nodes = getTextNodes(document.body);
    const texts = nodes.map(n => n.textContent);
    expect(texts).toEqual(['Before', 'After']);
  });
});

describe('serializeRange — cross-node context', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('extracts context across inline element boundaries', () => {
    document.body.innerHTML = '<p>Before <strong>bold</strong> after</p>';
    const strongText = document.querySelector('strong')!.firstChild!;

    const range = document.createRange();
    range.setStart(strongText, 0);
    range.setEnd(strongText, 4);

    const result = serializeRange(range);

    expect(result.selectedText).toBe('bold');
    expect(result.contextBefore).toBe('Before ');
    expect(result.contextAfter).toBe(' after');
  });

  it('extracts context across multiple inline elements', () => {
    document.body.innerHTML = '<p>Start <em>italic</em> middle <strong>bold</strong> end</p>';
    const emText = document.querySelector('em')!.firstChild!;

    const range = document.createRange();
    range.setStart(emText, 0);
    range.setEnd(emText, 6);

    const result = serializeRange(range);

    expect(result.selectedText).toBe('italic');
    expect(result.contextBefore).toBe('Start ');
    expect(result.contextAfter).toBe(' middle bold end');
  });

  it('does not cross block-level boundaries for context', () => {
    document.body.innerHTML = '<p>First paragraph content</p><p>Second <strong>target</strong> content</p>';
    const strongText = document.querySelectorAll('strong')[0].firstChild!;

    const range = document.createRange();
    range.setStart(strongText, 0);
    range.setEnd(strongText, 6);

    const result = serializeRange(range);

    expect(result.selectedText).toBe('target');
    // Context should come from within the second <p>, not from the first
    expect(result.contextBefore).toBe('Second ');
    expect(result.contextAfter).toBe(' content');
  });

  it('handles annotation at start of block (empty context before)', () => {
    document.body.innerHTML = '<p><strong>bold</strong> text after</p>';
    const strongText = document.querySelector('strong')!.firstChild!;

    const range = document.createRange();
    range.setStart(strongText, 0);
    range.setEnd(strongText, 4);

    const result = serializeRange(range);

    expect(result.selectedText).toBe('bold');
    expect(result.contextBefore).toBe('');
    expect(result.contextAfter).toBe(' text after');
  });

  it('handles annotation at end of block (empty context after)', () => {
    document.body.innerHTML = '<p>text before <strong>bold</strong></p>';
    const strongText = document.querySelector('strong')!.firstChild!;

    const range = document.createRange();
    range.setStart(strongText, 0);
    range.setEnd(strongText, 4);

    const result = serializeRange(range);

    expect(result.selectedText).toBe('bold');
    expect(result.contextBefore).toBe('text before ');
    expect(result.contextAfter).toBe('');
  });
});

describe('getBlockAncestor', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('returns the nearest block ancestor', () => {
    document.body.innerHTML = '<div><p>Hello <strong>world</strong></p></div>';
    const strongText = document.querySelector('strong')!.firstChild!;

    const block = getBlockAncestor(strongText);
    expect(block.tagName).toBe('P');
  });

  it('returns body when no block ancestor exists', () => {
    document.body.innerHTML = '<span><em>inline only</em></span>';
    const emText = document.querySelector('em')!.firstChild!;

    const block = getBlockAncestor(emText);
    expect(block).toBe(document.body);
  });

  it('returns the element itself if it is a block element', () => {
    document.body.innerHTML = '<div><p>content</p></div>';
    const p = document.querySelector('p')!;

    const block = getBlockAncestor(p);
    expect(block.tagName).toBe('P');
  });
});

describe('findRangeByContext — Tier 2.5 round-trip with inline context', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('re-finds text after DOM change using cross-node context', () => {
    // Step 1: Original DOM — serialize annotation on "bold"
    document.body.innerHTML = '<p>Before <strong>bold</strong> after</p>';
    const strongText = document.querySelector('strong')!.firstChild!;

    const range = document.createRange();
    range.setStart(strongText, 0);
    range.setEnd(strongText, 4);

    const serialized = serializeRange(range);

    // Verify cross-node context was captured
    expect(serialized.contextBefore).toBe('Before ');
    expect(serialized.contextAfter).toBe(' after');

    // Step 2: Simulate agent edit — replace "bold" with "updated"
    document.body.innerHTML = '<p>Before <strong>updated</strong> after</p>';

    // Step 3: Tier 2.5 — find replacement text using original context
    const found = findRangeByContext(
      'updated',
      serialized.contextBefore,
      serialized.contextAfter,
    );

    expect(found).not.toBeNull();
    expect(found!.toString()).toBe('updated');
  });

  it('disambiguates replacement text using cross-node context', () => {
    // Two paragraphs with the same replacement text
    document.body.innerHTML =
      '<p>Unrelated <strong>updated</strong> stuff</p>' +
      '<p>Before <strong>updated</strong> after</p>';

    // Context matches the second paragraph
    const found = findRangeByContext(
      'updated',
      'Before ',
      ' after',
    );

    expect(found).not.toBeNull();
    expect(found!.toString()).toBe('updated');

    // Verify it picked the second occurrence (in the second <p>)
    // Full text: "Unrelated updated stuffBefore updated after"
    //             0         1         2         3         4
    //             0123456789012345678901234567890123456789012345
    // Second "updated" starts at index 30
    const fullText = document.body.textContent ?? '';
    const secondIdx = fullText.indexOf('updated', fullText.indexOf('updated') + 1);
    expect(secondIdx).toBeGreaterThan(0);
  });
});
