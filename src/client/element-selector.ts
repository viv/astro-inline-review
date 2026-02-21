/**
 * Element selector generation and resolution.
 *
 * Generates a CSS selector for a DOM element using a tiered strategy:
 * 1. #id (if unique)
 * 2. [data-testid="..."] (if present)
 * 3. tag.class combo (if unique)
 * 4. Positional: parent > tag:nth-child(n)
 *
 * Also provides XPath (via selection.ts), element resolution, and
 * human-readable description generation.
 */

import { getXPath, resolveXPath } from './selection.js';
import type { ElementSelector } from './types.js';

/** Attributes worth capturing for identification and display */
const CAPTURED_ATTRS = ['id', 'class', 'data-testid', 'src', 'alt', 'href', 'role', 'aria-label', 'type', 'name'] as const;

/**
 * Build an ElementSelector for a DOM element.
 */
export function buildElementSelector(element: Element): ElementSelector {
  return {
    cssSelector: generateCssSelector(element),
    xpath: getXPath(element),
    description: generateDescription(element),
    tagName: element.tagName.toLowerCase(),
    attributes: captureAttributes(element),
    outerHtmlPreview: element.outerHTML.slice(0, 200),
  };
}

/**
 * Resolve an ElementSelector back to a DOM element.
 * Tier 1: CSS selector, Tier 2: XPath, Tier 3: null (orphaned).
 */
export function resolveElement(selector: ElementSelector): Element | null {
  // Tier 1: CSS selector
  try {
    const el = document.querySelector(selector.cssSelector);
    if (el) return el;
  } catch {
    // Invalid selector — fall through
  }

  // Tier 2: XPath
  const node = resolveXPath(selector.xpath);
  if (node && node.nodeType === Node.ELEMENT_NODE) {
    return node as Element;
  }

  // Tier 3: Orphaned
  return null;
}

// --- CSS Selector Generation ---

/**
 * Generate a unique CSS selector for an element, trying strategies in order:
 * 1. #id
 * 2. [data-testid]
 * 3. tag.class combo
 * 4. Positional: parent > tag:nth-child(n)
 */
function generateCssSelector(element: Element): string {
  // Strategy 1: ID
  if (element.id) {
    const selector = `#${CSS.escape(element.id)}`;
    if (isUnique(selector)) return selector;
  }

  // Strategy 2: data-testid
  const testId = element.getAttribute('data-testid');
  if (testId) {
    const selector = `[data-testid="${CSS.escape(testId)}"]`;
    if (isUnique(selector)) return selector;
  }

  // Strategy 3: tag + classes
  const tag = element.tagName.toLowerCase();
  if (element.classList.length > 0) {
    const classSelector = `${tag}.${Array.from(element.classList).map(c => CSS.escape(c)).join('.')}`;
    if (isUnique(classSelector)) return classSelector;
  }

  // Strategy 4: Positional with parent context
  return generatePositionalSelector(element);
}

/**
 * Generate a positional selector: parent > tag:nth-child(n)
 * Walks up the tree until the selector is unique.
 */
function generatePositionalSelector(element: Element): string {
  const parts: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.documentElement) {
    const part = getElementPart(current);
    parts.unshift(part);

    // Test if accumulated selector is unique
    const selector = parts.join(' > ');
    if (isUnique(selector)) return selector;

    current = current.parentElement;
  }

  // If we reached the root, the full path should be unique
  return parts.join(' > ');
}

/**
 * Get a selector part for a single element.
 * Uses id or data-testid if available, otherwise tag:nth-child.
 */
function getElementPart(element: Element): string {
  if (element.id) return `#${CSS.escape(element.id)}`;

  const testId = element.getAttribute('data-testid');
  if (testId) return `[data-testid="${CSS.escape(testId)}"]`;

  const tag = element.tagName.toLowerCase();
  const parent = element.parentElement;
  if (!parent) return tag;

  // Count position among same-tag siblings
  const siblings = Array.from(parent.children).filter(
    child => child.tagName === element.tagName,
  );

  if (siblings.length === 1) return tag;

  const index = siblings.indexOf(element) + 1;
  return `${tag}:nth-child(${getChildIndex(element)})`;
}

/**
 * Get the 1-based child index of an element among all siblings.
 */
function getChildIndex(element: Element): number {
  const parent = element.parentElement;
  if (!parent) return 1;
  return Array.from(parent.children).indexOf(element) + 1;
}

/**
 * Check if a CSS selector matches exactly one element.
 */
function isUnique(selector: string): boolean {
  try {
    return document.querySelectorAll(selector).length === 1;
  } catch {
    return false;
  }
}

// --- Description ---

/**
 * Generate a human-readable description of an element.
 * Format: "tagName" or "tagName#id" or "tagName.class"
 * Followed by key attributes in parentheses.
 */
export function generateDescription(element: Element): string {
  const tag = element.tagName.toLowerCase();
  let base = tag;

  if (element.id) {
    base = `${tag}#${element.id}`;
  } else if (element.classList.length > 0) {
    base = `${tag}.${Array.from(element.classList)[0]}`;
  }

  // Collect key display attributes (excluding id and class, already shown)
  const displayAttrs: string[] = [];
  for (const attr of CAPTURED_ATTRS) {
    if (attr === 'id' || attr === 'class') continue;
    const val = element.getAttribute(attr);
    if (val) {
      // Truncate long values
      const truncated = val.length > 40 ? val.slice(0, 37) + '...' : val;
      displayAttrs.push(`${attr}=${truncated}`);
    }
  }

  if (displayAttrs.length > 0) {
    return `${base} (${displayAttrs.join(', ')})`;
  }

  return base;
}

// --- Attribute Capture ---

/**
 * Capture key attributes from an element.
 */
function captureAttributes(element: Element): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const attr of CAPTURED_ATTRS) {
    const val = element.getAttribute(attr);
    if (val !== null) {
      attrs[attr] = val;
    }
  }
  return attrs;
}
