import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPanel } from '../../../src/client/ui/panel.js';
import type { PanelCallbacks } from '../../../src/client/ui/panel.js';
import type { ReviewMediator } from '../../../src/client/mediator.js';

// Mock the api module to prevent real fetch calls during panel creation
vi.mock('../../../src/client/api.js', () => ({
  api: {
    getStore: vi.fn().mockResolvedValue({ version: 1, annotations: [], pageNotes: [] }),
    deleteAnnotation: vi.fn(),
    deletePageNote: vi.fn(),
  },
}));

vi.mock('../../../src/client/cache.js', () => ({
  readCache: vi.fn().mockReturnValue(null),
  writeCache: vi.fn(),
}));

describe('createPanel — export button', () => {
  let shadowRoot: ShadowRoot;
  let callbacks: PanelCallbacks;
  let mediator: ReviewMediator;

  beforeEach(() => {
    document.body.innerHTML = '';
    const host = document.createElement('div');
    document.body.appendChild(host);
    shadowRoot = host.attachShadow({ mode: 'open' });

    callbacks = {
      onAnnotationClick: vi.fn(),
      onRefreshBadge: vi.fn().mockResolvedValue(undefined),
      onExport: vi.fn().mockResolvedValue(undefined),
    };

    mediator = {
      refreshPanel: vi.fn(),
      restoreHighlights: vi.fn().mockResolvedValue(undefined),
    };
  });

  it('renders an export button with data-air-el="export"', () => {
    createPanel(shadowRoot, callbacks, mediator);

    const exportBtn = shadowRoot.querySelector('[data-air-el="export"]');
    expect(exportBtn).not.toBeNull();
    expect(exportBtn!.tagName.toLowerCase()).toBe('button');
  });

  it('export button has "Copy All" text', () => {
    createPanel(shadowRoot, callbacks, mediator);

    const exportBtn = shadowRoot.querySelector('[data-air-el="export"]');
    expect(exportBtn!.textContent).toBe('Copy All');
  });

  it('export button has descriptive title attribute', () => {
    createPanel(shadowRoot, callbacks, mediator);

    const exportBtn = shadowRoot.querySelector('[data-air-el="export"]');
    expect(exportBtn!.getAttribute('title')).toBe('Copy all annotations to clipboard as Markdown');
  });

  it('export button has accent class', () => {
    createPanel(shadowRoot, callbacks, mediator);

    const exportBtn = shadowRoot.querySelector('[data-air-el="export"]');
    expect(exportBtn!.classList.contains('air-panel__btn--export')).toBe(true);
  });

  it('calls onExport callback when clicked', () => {
    createPanel(shadowRoot, callbacks, mediator);

    const exportBtn = shadowRoot.querySelector('[data-air-el="export"]') as HTMLButtonElement;
    exportBtn.click();

    expect(callbacks.onExport).toHaveBeenCalledOnce();
  });

  it('renders buttons in order: + Note, Copy All, Clear All', () => {
    createPanel(shadowRoot, callbacks, mediator);

    const actions = shadowRoot.querySelector('.air-panel__actions');
    const buttons = actions!.querySelectorAll('button');

    expect(buttons[0].textContent).toBe('+ Note');
    expect(buttons[1].textContent).toBe('Copy All');
    expect(buttons[2].textContent).toBe('Clear All');
  });
});
