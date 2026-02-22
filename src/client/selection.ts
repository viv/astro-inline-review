/**
 * Text range serialisation and restoration.
 *
 * Provides three-tier fallback for restoring highlights:
 * 1. XPath + offset — primary, precise
 * 2. Text + context matching — fallback if DOM changed
 * 3. Orphaned — visible in panel with warning, no highlight
 */

import type { SerializedRange } from '../shared/types.js';

const CONTEXT_LENGTH = 30;

/**
 * Generate an XPath expression for a DOM node.
 *
 * For element nodes: /html[1]/body[1]/div[1]/p[2]
 * For text nodes: /html[1]/body[1]/p[1]/text()[1]
 */
export function getXPath(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    const parent = node.parentNode;
    if (!parent) return '';
    const parentPath = getXPath(parent);
    // Count text node position among sibling text nodes
    let textIndex = 0;
    for (const child of Array.from(parent.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        textIndex++;
      }
      if (child === node) break;
    }
    return `${parentPath}/text()[${textIndex}]`;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return '';

  const element = node as Element;
  if (element === document.documentElement) return '/html[1]';

  const parent = element.parentNode;
  if (!parent) return `/${element.tagName.toLowerCase()}[1]`;

  // Count same-tag siblings before this element
  let index = 0;
  for (const child of Array.from(parent.childNodes)) {
    if (child.nodeType === Node.ELEMENT_NODE &&
        (child as Element).tagName === element.tagName) {
      index++;
    }
    if (child === element) break;
  }

  const parentPath = parent === document ? '' : getXPath(parent);
  return `${parentPath}/${element.tagName.toLowerCase()}[${index}]`;
}

/**
 * Resolve an XPath expression back to a DOM node.
 */
export function resolveXPath(xpath: string): Node | null {
  try {
    const result = document.evaluate(
      xpath,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null,
    );
    return result.singleNodeValue;
  } catch {
    return null;
  }
}

/**
 * Serialize a browser Range into a storable object.
 */
export function serializeRange(range: Range): SerializedRange {
  const startXPath = getXPath(range.startContainer);
  const endXPath = getXPath(range.endContainer);
  const selectedText = range.toString();

  // Extract context from the text content around the selection
  const contextBefore = extractContextBefore(range);
  const contextAfter = extractContextAfter(range);

  return {
    startXPath,
    startOffset: range.startOffset,
    endXPath,
    endOffset: range.endOffset,
    selectedText,
    contextBefore,
    contextAfter,
  };
}

/**
 * Restore a Range from a serialized selection.
 * Returns null if the XPath nodes no longer exist.
 */
export function deserializeRange(serialized: SerializedRange): Range | null {
  const startNode = resolveXPath(serialized.startXPath);
  const endNode = resolveXPath(serialized.endXPath);

  if (!startNode || !endNode) return null;

  try {
    const range = document.createRange();
    range.setStart(startNode, serialized.startOffset);
    range.setEnd(endNode, serialized.endOffset);

    // Verify the range still contains the expected text
    if (range.toString() !== serialized.selectedText) {
      return null;
    }

    return range;
  } catch {
    return null;
  }
}

/**
 * Fallback: find text in the document using content + context matching.
 * Walks all text nodes and tries to find the selected text with matching context.
 */
export function findRangeByContext(
  selectedText: string,
  contextBefore: string,
  contextAfter: string,
): Range | null {
  const textNodes = getTextNodes(document.body);
  // Build a full text map: concatenated text content with node boundaries
  const segments: Array<{ node: Text; start: number }> = [];
  let fullText = '';

  for (const node of textNodes) {
    segments.push({ node, start: fullText.length });
    fullText += node.textContent ?? '';
  }

  if (fullText.length === 0) return null;

  // Find all occurrences of selectedText
  const matches: number[] = [];
  let searchFrom = 0;
  while (true) {
    const idx = fullText.indexOf(selectedText, searchFrom);
    if (idx === -1) break;
    matches.push(idx);
    searchFrom = idx + 1;
  }

  if (matches.length === 0) return null;

  // Score each match by context similarity
  let bestMatch = matches[0];
  let bestScore = -1;

  for (const matchIdx of matches) {
    let score = 0;
    const before = fullText.slice(Math.max(0, matchIdx - contextBefore.length), matchIdx);
    const after = fullText.slice(matchIdx + selectedText.length, matchIdx + selectedText.length + contextAfter.length);

    if (before.endsWith(contextBefore)) score += contextBefore.length;
    else if (before.includes(contextBefore.slice(-10))) score += 5;

    if (after.startsWith(contextAfter)) score += contextAfter.length;
    else if (after.includes(contextAfter.slice(0, 10))) score += 5;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = matchIdx;
    }
  }

  // Convert the character offset back to a Range
  return createRangeFromOffset(segments, bestMatch, bestMatch + selectedText.length);
}

// --- Helpers ---

function extractContextBefore(range: Range): string {
  const container = range.startContainer;
  if (container.nodeType === Node.TEXT_NODE) {
    const text = container.textContent ?? '';
    const start = Math.max(0, range.startOffset - CONTEXT_LENGTH);
    return text.slice(start, range.startOffset);
  }
  return '';
}

function extractContextAfter(range: Range): string {
  const container = range.endContainer;
  if (container.nodeType === Node.TEXT_NODE) {
    const text = container.textContent ?? '';
    const end = Math.min(text.length, range.endOffset + CONTEXT_LENGTH);
    return text.slice(range.endOffset, end);
  }
  return '';
}

function getTextNodes(root: Node): Text[] {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    nodes.push(node);
  }
  return nodes;
}

function createRangeFromOffset(
  segments: Array<{ node: Text; start: number }>,
  startOffset: number,
  endOffset: number,
): Range | null {
  let startNode: Text | null = null;
  let startLocal = 0;
  let endNode: Text | null = null;
  let endLocal = 0;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const nodeLen = seg.node.textContent?.length ?? 0;
    const nodeEnd = seg.start + nodeLen;

    if (!startNode && startOffset >= seg.start && startOffset <= nodeEnd) {
      startNode = seg.node;
      startLocal = startOffset - seg.start;
    }

    if (!endNode && endOffset >= seg.start && endOffset <= nodeEnd) {
      endNode = seg.node;
      endLocal = endOffset - seg.start;
    }

    if (startNode && endNode) break;
  }

  if (!startNode || !endNode) return null;

  const range = document.createRange();
  range.setStart(startNode, startLocal);
  range.setEnd(endNode, endLocal);
  return range;
}
