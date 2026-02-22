import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createFab, updateBadge } from '../../../src/client/ui/fab.js';

describe('createFab', () => {
  let shadowRoot: ShadowRoot;

  beforeEach(() => {
    document.body.innerHTML = '';
    const host = document.createElement('div');
    document.body.appendChild(host);
    shadowRoot = host.attachShadow({ mode: 'open' });
  });

  it('appends a button to the shadow root', () => {
    const onToggle = vi.fn();
    createFab(shadowRoot, onToggle);

    const button = shadowRoot.querySelector('button');
    expect(button).not.toBeNull();
    expect(button!.className).toBe('air-fab');
  });

  it('has aria-label for accessibility', () => {
    const { button } = createFab(shadowRoot, vi.fn());
    expect(button.getAttribute('aria-label')).toBe('Toggle inline review panel');
  });

  it('has title attribute', () => {
    const { button } = createFab(shadowRoot, vi.fn());
    expect(button.getAttribute('title')).toBe('Inline Review');
  });

  it('calls onToggle when clicked', () => {
    const onToggle = vi.fn();
    const { button } = createFab(shadowRoot, onToggle);

    button.click();

    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('toggles open class on click', () => {
    const { button } = createFab(shadowRoot, vi.fn());

    button.click();
    expect(button.classList.contains('air-fab--open')).toBe(true);

    button.click();
    expect(button.classList.contains('air-fab--open')).toBe(false);
  });

  it('contains a badge element', () => {
    const { badge } = createFab(shadowRoot, vi.fn());
    expect(badge).not.toBeNull();
    expect(badge.className).toContain('air-fab__badge');
  });
});

describe('updateBadge', () => {
  function createBadgeWithParent(): HTMLSpanElement {
    const button = document.createElement('button');
    button.setAttribute('aria-label', 'Toggle inline review panel');
    const badge = document.createElement('span');
    badge.className = 'air-fab__badge air-fab__badge--hidden';
    button.appendChild(badge);
    return badge;
  }

  it('shows the count when > 0', () => {
    const badge = createBadgeWithParent();

    updateBadge(badge, 5);

    expect(badge.textContent).toBe('5');
    expect(badge.classList.contains('air-fab__badge--hidden')).toBe(false);
  });

  it('hides when count is 0', () => {
    const badge = createBadgeWithParent();
    badge.className = 'air-fab__badge';

    updateBadge(badge, 0);

    expect(badge.textContent).toBe('0');
    expect(badge.classList.contains('air-fab__badge--hidden')).toBe(true);
  });

  it('updates parent button aria-label with count', () => {
    const badge = createBadgeWithParent();

    updateBadge(badge, 3);

    expect(badge.parentElement!.getAttribute('aria-label')).toBe('Toggle inline review (3 annotations)');
  });

  it('uses singular "annotation" for count of 1', () => {
    const badge = createBadgeWithParent();

    updateBadge(badge, 1);

    expect(badge.parentElement!.getAttribute('aria-label')).toBe('Toggle inline review (1 annotation)');
  });

  it('resets parent button aria-label when count is 0', () => {
    const badge = createBadgeWithParent();

    updateBadge(badge, 0);

    expect(badge.parentElement!.getAttribute('aria-label')).toBe('Toggle inline review panel');
  });
});
