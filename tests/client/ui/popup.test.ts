import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createPopup,
  showPopup,
  showEditPopup,
  hidePopup,
  isPopupVisible,
} from '../../../src/client/ui/popup.js';
import type { PopupCallbacks, PopupElements } from '../../../src/client/ui/popup.js';

describe('popup — positioning', () => {
  let shadowRoot: ShadowRoot;
  let popup: PopupElements;
  let callbacks: PopupCallbacks;

  beforeEach(() => {
    document.body.innerHTML = '';
    const host = document.createElement('div');
    document.body.appendChild(host);
    shadowRoot = host.attachShadow({ mode: 'open' });

    popup = createPopup(shadowRoot);
    callbacks = { onSave: vi.fn(), onCancel: vi.fn() };
  });

  it('positions above the selection by default', () => {
    // Rect in the middle of the viewport — plenty of room above
    const rect = new DOMRect(200, 400, 100, 20);

    showPopup(popup, 'selected text', rect, callbacks);

    const top = parseFloat(popup.container.style.top);
    // Should be above the selection rect (top - margin)
    expect(top).toBeLessThan(rect.top);
  });

  it('falls back to below when not enough room above', () => {
    // Rect near the top of the viewport — not enough room above
    const rect = new DOMRect(200, 50, 100, 20);

    showPopup(popup, 'selected text', rect, callbacks);

    const top = parseFloat(popup.container.style.top);
    // Should be below the selection rect (rect.bottom + margin)
    expect(top).toBeGreaterThan(rect.top);
  });

  it('constrains left position to stay within viewport', () => {
    // Rect near the right edge
    const rect = new DOMRect(window.innerWidth - 10, 400, 5, 20);

    showPopup(popup, 'selected text', rect, callbacks);

    const left = parseFloat(popup.container.style.left);
    // Should not exceed viewport bounds
    expect(left).toBeLessThan(window.innerWidth);
    expect(left).toBeGreaterThanOrEqual(8); // MARGIN
  });
});

describe('popup — show and hide', () => {
  let shadowRoot: ShadowRoot;
  let popup: PopupElements;
  let callbacks: PopupCallbacks;

  beforeEach(() => {
    document.body.innerHTML = '';
    const host = document.createElement('div');
    document.body.appendChild(host);
    shadowRoot = host.attachShadow({ mode: 'open' });

    popup = createPopup(shadowRoot);
    callbacks = { onSave: vi.fn(), onCancel: vi.fn() };
  });

  it('showPopup makes popup visible', () => {
    const rect = new DOMRect(200, 400, 100, 20);

    showPopup(popup, 'hello', rect, callbacks);

    expect(isPopupVisible(popup)).toBe(true);
    expect(popup.container.getAttribute('data-air-state')).toBe('visible');
  });

  it('showPopup sets selected text preview with quotes', () => {
    const rect = new DOMRect(200, 400, 100, 20);

    showPopup(popup, 'hello world', rect, callbacks);

    expect(popup.selectedTextPreview.textContent).toBe('"hello world"');
  });

  it('showPopup truncates long selected text', () => {
    const rect = new DOMRect(200, 400, 100, 20);
    const longText = 'A'.repeat(150);

    showPopup(popup, longText, rect, callbacks);

    expect(popup.selectedTextPreview.textContent!.length).toBeLessThan(150);
    expect(popup.selectedTextPreview.textContent).toContain('…');
  });

  it('showPopup clears textarea', () => {
    const rect = new DOMRect(200, 400, 100, 20);
    popup.textarea.value = 'old content';

    showPopup(popup, 'hello', rect, callbacks);

    expect(popup.textarea.value).toBe('');
  });

  it('hidePopup clears textarea and hides element', () => {
    const rect = new DOMRect(200, 400, 100, 20);
    showPopup(popup, 'hello', rect, callbacks);
    popup.textarea.value = 'some note';

    hidePopup(popup);

    expect(isPopupVisible(popup)).toBe(false);
    expect(popup.textarea.value).toBe('');
    expect(popup.container.getAttribute('data-air-state')).toBe('hidden');
  });
});

describe('popup — edit mode', () => {
  let shadowRoot: ShadowRoot;
  let popup: PopupElements;
  let callbacks: PopupCallbacks;

  beforeEach(() => {
    document.body.innerHTML = '';
    const host = document.createElement('div');
    document.body.appendChild(host);
    shadowRoot = host.attachShadow({ mode: 'open' });

    popup = createPopup(shadowRoot);
    callbacks = { onSave: vi.fn(), onCancel: vi.fn(), onDelete: vi.fn() };
  });

  it('showEditPopup pre-fills textarea with existing note', () => {
    const rect = new DOMRect(200, 400, 100, 20);

    showEditPopup(popup, 'selected text', 'existing note content', rect, callbacks);

    expect(popup.textarea.value).toBe('existing note content');
  });

  it('showEditPopup makes popup visible', () => {
    const rect = new DOMRect(200, 400, 100, 20);

    showEditPopup(popup, 'selected text', 'note', rect, callbacks);

    expect(isPopupVisible(popup)).toBe(true);
  });
});

describe('popup — footer buttons', () => {
  let shadowRoot: ShadowRoot;
  let popup: PopupElements;

  beforeEach(() => {
    document.body.innerHTML = '';
    const host = document.createElement('div');
    document.body.appendChild(host);
    shadowRoot = host.attachShadow({ mode: 'open' });

    popup = createPopup(shadowRoot);
  });

  it('creates Cancel and Save buttons in new mode (no delete)', () => {
    const callbacks: PopupCallbacks = { onSave: vi.fn(), onCancel: vi.fn() };
    const rect = new DOMRect(200, 400, 100, 20);

    showPopup(popup, 'hello', rect, callbacks);

    const buttons = popup.container.querySelectorAll('.air-popup__footer button');
    const buttonTexts = Array.from(buttons).map(b => b.textContent);

    expect(buttonTexts).toContain('Cancel');
    expect(buttonTexts).toContain('Save');
    expect(buttonTexts).not.toContain('Delete');
  });

  it('creates Delete, Cancel, and Save buttons in edit mode', () => {
    const callbacks: PopupCallbacks = { onSave: vi.fn(), onCancel: vi.fn(), onDelete: vi.fn() };
    const rect = new DOMRect(200, 400, 100, 20);

    showEditPopup(popup, 'hello', 'existing', rect, callbacks);

    const buttons = popup.container.querySelectorAll('.air-popup__footer button');
    const buttonTexts = Array.from(buttons).map(b => b.textContent);

    expect(buttonTexts).toContain('Delete');
    expect(buttonTexts).toContain('Cancel');
    expect(buttonTexts).toContain('Save');
  });

  it('Save button passes textarea value to onSave callback', () => {
    const onSave = vi.fn();
    const callbacks: PopupCallbacks = { onSave, onCancel: vi.fn() };
    const rect = new DOMRect(200, 400, 100, 20);

    showPopup(popup, 'hello', rect, callbacks);
    popup.textarea.value = 'my note';

    const saveBtn = popup.container.querySelector('[data-air-el="popup-save"]') as HTMLButtonElement;
    saveBtn.click();

    expect(onSave).toHaveBeenCalledWith('my note');
  });

  it('Cancel button calls onCancel callback', () => {
    const onCancel = vi.fn();
    const callbacks: PopupCallbacks = { onSave: vi.fn(), onCancel };
    const rect = new DOMRect(200, 400, 100, 20);

    showPopup(popup, 'hello', rect, callbacks);

    const cancelBtn = popup.container.querySelector('[data-air-el="popup-cancel"]') as HTMLButtonElement;
    cancelBtn.click();

    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('Delete button calls onDelete callback', () => {
    const onDelete = vi.fn();
    const callbacks: PopupCallbacks = { onSave: vi.fn(), onCancel: vi.fn(), onDelete };
    const rect = new DOMRect(200, 400, 100, 20);

    showEditPopup(popup, 'hello', 'existing', rect, callbacks);

    const deleteBtn = popup.container.querySelector('[data-air-el="popup-delete"]') as HTMLButtonElement;
    deleteBtn.click();

    expect(onDelete).toHaveBeenCalledOnce();
  });
});

describe('popup — ARIA attributes', () => {
  let shadowRoot: ShadowRoot;
  let popup: PopupElements;

  beforeEach(() => {
    document.body.innerHTML = '';
    const host = document.createElement('div');
    document.body.appendChild(host);
    shadowRoot = host.attachShadow({ mode: 'open' });

    popup = createPopup(shadowRoot);
  });

  it('has role="dialog" and aria-modal="true"', () => {
    expect(popup.container.getAttribute('role')).toBe('dialog');
    expect(popup.container.getAttribute('aria-modal')).toBe('true');
  });

  it('has aria-label for accessibility', () => {
    expect(popup.container.getAttribute('aria-label')).toBe('Add annotation');
  });
});
