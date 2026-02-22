import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  buildElementSelector,
  resolveElement,
  generateDescription,
} from '../../src/client/element-selector.js';
import type { ElementSelector } from '../../src/client/types.js';

// Polyfill CSS.escape if not available in happy-dom
if (typeof CSS === 'undefined' || !CSS.escape) {
  (globalThis as Record<string, unknown>).CSS = {
    escape: (value: string) => {
      // Minimal polyfill matching the CSS.escape spec for test purposes
      return value.replace(/([^\w-])/g, '\\$1');
    },
  };
}

// Mock resolveXPath — happy-dom doesn't support document.evaluate (XPath).
// getXPath is kept real since it's pure DOM traversal and works fine.
vi.mock('../../src/client/selection.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/client/selection.js')>();
  return {
    ...actual,
    resolveXPath: vi.fn(() => null),
  };
});

import { resolveXPath } from '../../src/client/selection.js';
const mockResolveXPath = resolveXPath as ReturnType<typeof vi.fn>;

describe('buildElementSelector', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('CSS selector strategies', () => {
    it('generates #id selector for element with unique ID', () => {
      document.body.innerHTML = '<div id="unique-el">Content</div>';
      const el = document.querySelector('#unique-el')!;

      const result = buildElementSelector(el);

      expect(result.cssSelector).toBe('#unique-el');
    });

    it('generates [data-testid] selector when present', () => {
      document.body.innerHTML = '<button data-testid="submit-btn">Submit</button>';
      const el = document.querySelector('[data-testid="submit-btn"]')!;

      const result = buildElementSelector(el);

      expect(result.cssSelector).toBe('[data-testid="submit-btn"]');
    });

    it('generates tag.class selector when classes are unique', () => {
      document.body.innerHTML = '<span class="highlight-text">Hello</span>';
      const el = document.querySelector('.highlight-text')!;

      const result = buildElementSelector(el);

      expect(result.cssSelector).toBe('span.highlight-text');
    });

    it('generates tag.class1.class2 selector with multiple classes', () => {
      document.body.innerHTML = '<div class="card primary">Content</div>';
      const el = document.querySelector('.card')!;

      const result = buildElementSelector(el);

      expect(result.cssSelector).toBe('div.card.primary');
    });

    it('falls back to positional selector when no unique identifier', () => {
      document.body.innerHTML = `
        <div>
          <span>First</span>
          <span>Second</span>
        </div>
      `;
      const spans = document.querySelectorAll('span');
      const result = buildElementSelector(spans[1]);

      // Should use positional selector since tag alone is not unique
      expect(result.cssSelector).toContain(':nth-child');
    });

    it('prefers ID over data-testid', () => {
      document.body.innerHTML = '<div id="my-id" data-testid="my-testid">Content</div>';
      const el = document.querySelector('#my-id')!;

      const result = buildElementSelector(el);

      expect(result.cssSelector).toBe('#my-id');
    });

    it('prefers data-testid over class selector', () => {
      document.body.innerHTML = '<div data-testid="widget" class="widget-class">Content</div>';
      const el = document.querySelector('[data-testid="widget"]')!;

      const result = buildElementSelector(el);

      expect(result.cssSelector).toBe('[data-testid="widget"]');
    });
  });

  describe('other fields', () => {
    it('captures tagName in lowercase', () => {
      document.body.innerHTML = '<DIV id="test">Content</DIV>';
      const el = document.querySelector('#test')!;

      const result = buildElementSelector(el);

      expect(result.tagName).toBe('div');
    });

    it('generates XPath', () => {
      document.body.innerHTML = '<p id="para">Hello</p>';
      const el = document.querySelector('#para')!;

      const result = buildElementSelector(el);

      expect(result.xpath).toContain('/html[1]/body[1]/p[1]');
    });

    it('generates human-readable description', () => {
      document.body.innerHTML = '<button id="save-btn">Save</button>';
      const el = document.querySelector('#save-btn')!;

      const result = buildElementSelector(el);

      expect(result.description).toBe('button#save-btn');
    });

    it('captures attributes from CAPTURED_ATTRS list', () => {
      document.body.innerHTML = '<a id="link" href="/page" role="button" aria-label="Go to page">Link</a>';
      const el = document.querySelector('#link')!;

      const result = buildElementSelector(el);

      expect(result.attributes.id).toBe('link');
      expect(result.attributes.href).toBe('/page');
      expect(result.attributes.role).toBe('button');
      expect(result.attributes['aria-label']).toBe('Go to page');
    });

    it('truncates outerHtmlPreview to 200 characters', () => {
      const longAttr = 'x'.repeat(300);
      document.body.innerHTML = `<div id="long" data-long="${longAttr}">Content</div>`;
      const el = document.querySelector('#long')!;

      const result = buildElementSelector(el);

      expect(result.outerHtmlPreview.length).toBeLessThanOrEqual(200);
    });
  });
});

describe('resolveElement', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    mockResolveXPath.mockReset();
    // Default: XPath returns null (simulating no match)
    mockResolveXPath.mockReturnValue(null);
  });

  it('resolves by CSS selector (primary)', () => {
    document.body.innerHTML = '<div id="target">Found me</div>';
    const selector: ElementSelector = {
      cssSelector: '#target',
      xpath: '/html[1]/body[1]/div[1]',
      description: 'div#target',
      tagName: 'div',
      attributes: { id: 'target' },
      outerHtmlPreview: '<div id="target">Found me</div>',
    };

    const result = resolveElement(selector);

    expect(result).not.toBeNull();
    expect(result!.id).toBe('target');
  });

  it('falls back to XPath when CSS selector fails', () => {
    document.body.innerHTML = '<div><p>Paragraph</p></div>';
    const el = document.querySelector('p')!;

    // Mock resolveXPath to return the element (simulating XPath success)
    mockResolveXPath.mockReturnValueOnce(el);

    const selector: ElementSelector = {
      cssSelector: '#nonexistent', // CSS won't match
      xpath: '/html[1]/body[1]/div[1]/p[1]',
      description: 'p',
      tagName: 'p',
      attributes: {},
      outerHtmlPreview: '<p>Paragraph</p>',
    };

    const result = resolveElement(selector);

    expect(result).not.toBeNull();
    expect(result!.tagName.toLowerCase()).toBe('p');
    expect(mockResolveXPath).toHaveBeenCalledWith('/html[1]/body[1]/div[1]/p[1]');
  });

  it('returns null when neither CSS nor XPath resolves', () => {
    document.body.innerHTML = '<div>Some content</div>';

    const selector: ElementSelector = {
      cssSelector: '#gone',
      xpath: '/html[1]/body[1]/section[1]/article[1]',
      description: 'article',
      tagName: 'article',
      attributes: {},
      outerHtmlPreview: '<article>Missing</article>',
    };

    const result = resolveElement(selector);

    expect(result).toBeNull();
  });

  it('handles invalid CSS selector gracefully', () => {
    document.body.innerHTML = '<div><p>Content</p></div>';
    const el = document.querySelector('p')!;

    // Mock resolveXPath to return the element (simulating XPath success after CSS failure)
    mockResolveXPath.mockReturnValueOnce(el);

    const selector: ElementSelector = {
      cssSelector: '[invalid===', // Malformed CSS selector
      xpath: '/html[1]/body[1]/div[1]/p[1]',
      description: 'p',
      tagName: 'p',
      attributes: {},
      outerHtmlPreview: '<p>Content</p>',
    };

    // Should not throw, should fall through to XPath
    const result = resolveElement(selector);

    expect(result).not.toBeNull();
    expect(result!.tagName.toLowerCase()).toBe('p');
  });
});

describe('generateDescription', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('returns tag name for plain element', () => {
    document.body.innerHTML = '<div>Plain</div>';
    const el = document.querySelector('div')!;

    expect(generateDescription(el)).toBe('div');
  });

  it('includes ID when present', () => {
    document.body.innerHTML = '<section id="main">Content</section>';
    const el = document.querySelector('#main')!;

    expect(generateDescription(el)).toBe('section#main');
  });

  it('includes first class when no ID', () => {
    document.body.innerHTML = '<div class="card featured">Content</div>';
    const el = document.querySelector('.card')!;

    expect(generateDescription(el)).toBe('div.card');
  });

  it('prefers ID over class', () => {
    document.body.innerHTML = '<div id="unique" class="styled">Content</div>';
    const el = document.querySelector('#unique')!;

    expect(generateDescription(el)).toBe('div#unique');
  });

  it('includes key attributes in parentheses', () => {
    document.body.innerHTML = '<a id="link" href="/about">About</a>';
    const el = document.querySelector('#link')!;

    const desc = generateDescription(el);

    expect(desc).toContain('a#link');
    expect(desc).toContain('href=/about');
  });

  it('includes data-testid in attributes', () => {
    document.body.innerHTML = '<button data-testid="submit">Go</button>';
    const el = document.querySelector('button')!;

    const desc = generateDescription(el);

    expect(desc).toContain('data-testid=submit');
  });

  it('truncates long attribute values', () => {
    const longValue = 'a'.repeat(50);
    document.body.innerHTML = `<img id="pic" src="${longValue}" />`;
    const el = document.querySelector('#pic')!;

    const desc = generateDescription(el);

    // Long values should be truncated to 37 chars + '...'
    expect(desc).toContain('...');
    expect(desc.length).toBeLessThan(100);
  });

  it('excludes id and class from display attributes', () => {
    document.body.innerHTML = '<div id="my-id" class="my-class">Content</div>';
    const el = document.querySelector('#my-id')!;

    const desc = generateDescription(el);

    // ID shown in base, class not in parentheses
    expect(desc).toBe('div#my-id');
    expect(desc).not.toContain('id=');
    expect(desc).not.toContain('class=');
  });
});

describe('edge cases', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('handles elements with special characters in class names', () => {
    document.body.innerHTML = '<div class="foo:bar baz/qux">Content</div>';
    const el = document.querySelector('div')!;

    // Should not throw — CSS.escape handles special chars
    const result = buildElementSelector(el);

    expect(result.cssSelector).toBeTruthy();
    expect(result.tagName).toBe('div');
  });

  it('handles element with no ID, no testid, no classes', () => {
    document.body.innerHTML = '<div><p>Only child</p></div>';
    const el = document.querySelector('p')!;

    const result = buildElementSelector(el);

    // Should fall through to either tag (if unique) or positional
    expect(result.cssSelector).toBeTruthy();
    // p is unique in this document, so might just be 'p'
    expect(document.querySelectorAll(result.cssSelector).length).toBe(1);
  });

  it('handles deeply nested elements', () => {
    document.body.innerHTML = `
      <div>
        <section>
          <article>
            <div>
              <p>
                <span>Deep</span>
              </p>
            </div>
          </article>
        </section>
      </div>
    `;
    const el = document.querySelector('span')!;

    const result = buildElementSelector(el);

    // Should generate a valid selector that resolves back
    expect(result.cssSelector).toBeTruthy();
    expect(document.querySelector(result.cssSelector)).toBe(el);
  });

  it('handles SVG elements', () => {
    document.body.innerHTML = `
      <svg id="icon" viewBox="0 0 24 24">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
      </svg>
    `;
    const svg = document.querySelector('svg')!;

    const result = buildElementSelector(svg);

    expect(result.cssSelector).toBe('#icon');
    expect(result.tagName).toBe('svg');
    expect(result.description).toContain('svg#icon');
  });

  it('handles SVG child elements', () => {
    document.body.innerHTML = `
      <svg id="icon" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 2L2 7"/>
      </svg>
    `;
    const path = document.querySelector('path')!;

    const result = buildElementSelector(path);

    expect(result.cssSelector).toBeTruthy();
    expect(result.tagName).toBe('path');
  });

  it('handles element whose ID is not unique in the document', () => {
    // Non-unique IDs are invalid HTML but happen in practice
    document.body.innerHTML = `
      <div id="dupe">First</div>
      <div id="dupe">Second</div>
    `;
    const els = document.querySelectorAll('[id="dupe"]');
    const second = els[1];

    const result = buildElementSelector(second);

    // Should not use #dupe since it's not unique
    // Falls through to positional or class-based
    expect(result.cssSelector).not.toBe('#dupe');
  });

  it('round-trips: buildElementSelector → resolveElement returns same element', () => {
    document.body.innerHTML = `
      <nav>
        <ul>
          <li><a href="/home">Home</a></li>
          <li><a href="/about">About</a></li>
          <li><a href="/contact">Contact</a></li>
        </ul>
      </nav>
    `;
    const aboutLink = document.querySelector('a[href="/about"]')!;

    const selector = buildElementSelector(aboutLink);
    const resolved = resolveElement(selector);

    expect(resolved).toBe(aboutLink);
  });

  it('handles element with only role and aria-label attributes', () => {
    document.body.innerHTML = '<div role="alert" aria-label="Error notification">Error!</div>';
    const el = document.querySelector('[role="alert"]')!;

    const result = buildElementSelector(el);

    expect(result.description).toContain('role=alert');
    expect(result.description).toContain('aria-label=Error notification');
    expect(result.attributes.role).toBe('alert');
    expect(result.attributes['aria-label']).toBe('Error notification');
  });

  it('handles multiple siblings of the same type with no distinguishing attributes', () => {
    document.body.innerHTML = `
      <ul>
        <li>Item 1</li>
        <li>Item 2</li>
        <li>Item 3</li>
      </ul>
    `;
    const items = document.querySelectorAll('li');

    // Each should get a unique positional selector
    const selector0 = buildElementSelector(items[0]);
    const selector1 = buildElementSelector(items[1]);
    const selector2 = buildElementSelector(items[2]);

    expect(selector0.cssSelector).not.toBe(selector1.cssSelector);
    expect(selector1.cssSelector).not.toBe(selector2.cssSelector);

    // Each should resolve back to the correct element
    expect(document.querySelector(selector0.cssSelector)).toBe(items[0]);
    expect(document.querySelector(selector1.cssSelector)).toBe(items[1]);
    expect(document.querySelector(selector2.cssSelector)).toBe(items[2]);
  });
});
