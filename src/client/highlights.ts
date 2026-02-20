/**
 * Highlight injection and removal.
 *
 * Wraps selected text in <mark> elements in the light DOM with inline styles.
 * Supports cross-element selections (multiple marks with same data-air-id).
 */

export const HIGHLIGHT_ATTR = 'data-air-id';

const HIGHLIGHT_STYLE = 'background-color: rgba(217,119,6,0.3); border-radius: 2px; cursor: pointer;';

/**
 * Apply a highlight to a Range by wrapping text nodes in <mark> elements.
 * For cross-element ranges, creates multiple marks all sharing the same ID.
 */
export function applyHighlight(range: Range, id: string): void {
  // Collect all text nodes within the range
  const textNodes = getTextNodesInRange(range);

  if (textNodes.length === 0) return;

  // For single text node, use surroundContents for simplicity
  if (textNodes.length === 1 &&
      range.startContainer === range.endContainer &&
      range.startContainer.nodeType === Node.TEXT_NODE) {
    const mark = createMark(id);
    range.surroundContents(mark);
    return;
  }

  // For cross-element or multi-node ranges, wrap each text node segment
  for (const { node, startOffset, endOffset } of textNodes) {
    const text = node.textContent ?? '';
    if (startOffset >= endOffset || startOffset >= text.length) continue;

    // Split the text node to isolate the highlighted portion
    const workNode = startOffset > 0 ? node.splitText(startOffset) : node;
    const actualEnd = endOffset - startOffset;

    if (actualEnd < (workNode.textContent?.length ?? 0)) {
      workNode.splitText(actualEnd);
    }

    // Wrap the isolated portion
    const mark = createMark(id);
    workNode.parentNode?.insertBefore(mark, workNode);
    mark.appendChild(workNode);
  }
}

/**
 * Remove all highlight marks for a given annotation ID.
 * Restores the original text content and normalises adjacent text nodes.
 */
export function removeHighlight(id: string): void {
  const marks = getHighlightMarks(id);

  for (const mark of marks) {
    const parent = mark.parentNode;
    if (!parent) continue;

    // Move all children out of the mark
    while (mark.firstChild) {
      parent.insertBefore(mark.firstChild, mark);
    }

    parent.removeChild(mark);
    parent.normalize();
  }
}

/**
 * Get all <mark> elements for a given annotation ID.
 */
export function getHighlightMarks(id: string): Element[] {
  return Array.from(document.querySelectorAll(`mark[${HIGHLIGHT_ATTR}="${id}"]`));
}

/**
 * Add a pulse animation to a highlight (used when scrolling to it from the panel).
 */
export function pulseHighlight(id: string): void {
  const marks = getHighlightMarks(id);
  for (const mark of marks) {
    const el = mark as HTMLElement;
    el.style.transition = 'background-color 0.3s ease';
    el.style.backgroundColor = 'rgba(217,119,6,0.6)';
    setTimeout(() => {
      el.style.backgroundColor = 'rgba(217,119,6,0.3)';
    }, 600);
    setTimeout(() => {
      el.style.transition = '';
    }, 900);
  }
}

// --- Helpers ---

function createMark(id: string): HTMLElement {
  const mark = document.createElement('mark');
  mark.setAttribute(HIGHLIGHT_ATTR, id);
  mark.setAttribute('style', HIGHLIGHT_STYLE);
  return mark;
}

interface TextNodeSegment {
  node: Text;
  startOffset: number;
  endOffset: number;
}

/**
 * Collect all text nodes within a Range, along with the offsets within each node.
 */
function getTextNodesInRange(range: Range): TextNodeSegment[] {
  const segments: TextNodeSegment[] = [];

  // If range is within a single text node
  if (range.startContainer === range.endContainer &&
      range.startContainer.nodeType === Node.TEXT_NODE) {
    segments.push({
      node: range.startContainer as Text,
      startOffset: range.startOffset,
      endOffset: range.endOffset,
    });
    return segments;
  }

  // Walk all text nodes between start and end
  const walker = document.createTreeWalker(
    range.commonAncestorContainer,
    NodeFilter.SHOW_TEXT,
  );

  let node: Text | null;
  let inRange = false;

  while ((node = walker.nextNode() as Text | null)) {
    if (node === range.startContainer) {
      inRange = true;
      segments.push({
        node,
        startOffset: range.startOffset,
        endOffset: node.textContent?.length ?? 0,
      });
      continue;
    }

    if (inRange) {
      if (node === range.endContainer) {
        segments.push({
          node,
          startOffset: 0,
          endOffset: range.endOffset,
        });
        break;
      }

      segments.push({
        node,
        startOffset: 0,
        endOffset: node.textContent?.length ?? 0,
      });
    }
  }

  return segments;
}
