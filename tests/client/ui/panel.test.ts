import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPanel } from '../../../src/client/ui/panel.js';
import type { PanelCallbacks } from '../../../src/client/ui/panel.js';
import type { ReviewMediator } from '../../../src/client/mediator.js';
import type { ReviewStore } from '../../../src/client/types.js';
import { api } from '../../../src/client/api.js';

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

describe('createPanel — resolved annotations and agent replies', () => {
  let shadowRoot: ShadowRoot;
  let callbacks: PanelCallbacks;
  let mediator: ReviewMediator;

  function makeTextAnnotation(overrides: Record<string, unknown> = {}) {
    return {
      id: 'ann-1', type: 'text' as const, pageUrl: '/', pageTitle: 'Home',
      selectedText: 'hello world', note: 'fix this',
      range: { startXPath: '', startOffset: 0, endXPath: '', endOffset: 0, selectedText: 'hello world', contextBefore: '', contextAfter: '' },
      createdAt: '2026-02-22T09:00:00Z', updatedAt: '2026-02-22T09:00:00Z',
      ...overrides,
    };
  }

  function makeElementAnnotation(overrides: Record<string, unknown> = {}) {
    return {
      id: 'ann-2', type: 'element' as const, pageUrl: '/', pageTitle: 'Home',
      note: 'fix element',
      elementSelector: { cssSelector: 'div.hero', xpath: '', description: 'Hero section', tagName: 'div', attributes: {}, outerHtmlPreview: '<div class="hero">' },
      createdAt: '2026-02-22T09:00:00Z', updatedAt: '2026-02-22T09:00:00Z',
      ...overrides,
    };
  }

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

  async function renderWithStore(store: ReviewStore) {
    vi.mocked(api.getStore).mockResolvedValue(store);
    const panel = createPanel(shadowRoot, callbacks, mediator);
    // mediator.refreshPanel is wired up by createPanel — call it
    await mediator.refreshPanel();
    return panel;
  }

  it('shows resolved badge for resolved text annotation', async () => {
    await renderWithStore({
      version: 1,
      annotations: [makeTextAnnotation({ resolvedAt: '2026-02-22T10:00:00Z' })],
      pageNotes: [],
    });

    const badge = shadowRoot.querySelector('[data-air-el="resolved-badge"]');
    expect(badge).not.toBeNull();
    expect(badge!.textContent).toContain('Resolved');
  });

  it('adds resolved class to resolved annotation item', async () => {
    await renderWithStore({
      version: 1,
      annotations: [makeTextAnnotation({ resolvedAt: '2026-02-22T10:00:00Z' })],
      pageNotes: [],
    });

    const item = shadowRoot.querySelector('[data-air-el="annotation-item"]');
    expect(item!.classList.contains('air-annotation-item--resolved')).toBe(true);
  });

  it('does not show resolved badge for unresolved annotation', async () => {
    await renderWithStore({
      version: 1,
      annotations: [makeTextAnnotation()],
      pageNotes: [],
    });

    const badge = shadowRoot.querySelector('[data-air-el="resolved-badge"]');
    expect(badge).toBeNull();
  });

  it('does not add resolved class for unresolved annotation', async () => {
    await renderWithStore({
      version: 1,
      annotations: [makeTextAnnotation()],
      pageNotes: [],
    });

    const item = shadowRoot.querySelector('[data-air-el="annotation-item"]');
    expect(item!.classList.contains('air-annotation-item--resolved')).toBe(false);
  });

  it('shows resolved badge for resolved element annotation', async () => {
    await renderWithStore({
      version: 1,
      annotations: [makeElementAnnotation({ resolvedAt: '2026-02-22T10:00:00Z' })],
      pageNotes: [],
    });

    const badge = shadowRoot.querySelector('[data-air-el="resolved-badge"]');
    expect(badge).not.toBeNull();
  });

  it('displays agent reply with Agent: prefix', async () => {
    await renderWithStore({
      version: 1,
      annotations: [makeTextAnnotation({
        replies: [{ message: 'Fixed the typo', createdAt: '2026-02-22T10:30:00Z' }],
      })],
      pageNotes: [],
    });

    const reply = shadowRoot.querySelector('[data-air-el="agent-reply"]');
    expect(reply).not.toBeNull();
    expect(reply!.textContent).toContain('Agent:');
    expect(reply!.textContent).toContain('Fixed the typo');
  });

  it('displays multiple agent replies in order', async () => {
    await renderWithStore({
      version: 1,
      annotations: [makeTextAnnotation({
        replies: [
          { message: 'First fix', createdAt: '2026-02-22T10:00:00Z' },
          { message: 'Second fix', createdAt: '2026-02-22T11:00:00Z' },
        ],
      })],
      pageNotes: [],
    });

    const replies = shadowRoot.querySelectorAll('[data-air-el="agent-reply"]');
    expect(replies.length).toBe(2);
    expect(replies[0].textContent).toContain('First fix');
    expect(replies[1].textContent).toContain('Second fix');
  });

  it('does not render replies section when no replies exist', async () => {
    await renderWithStore({
      version: 1,
      annotations: [makeTextAnnotation()],
      pageNotes: [],
    });

    const reply = shadowRoot.querySelector('[data-air-el="agent-reply"]');
    expect(reply).toBeNull();
  });

  it('shows resolved timestamp in human-readable format', async () => {
    await renderWithStore({
      version: 1,
      annotations: [makeTextAnnotation({ resolvedAt: '2026-02-22T10:00:00Z' })],
      pageNotes: [],
    });

    const badge = shadowRoot.querySelector('[data-air-el="resolved-badge"]');
    const timeSpan = badge!.querySelector('.air-annotation-item__resolved-time');
    expect(timeSpan).not.toBeNull();
    // Should contain some formatted date text (locale-dependent)
    expect(timeSpan!.textContent!.length).toBeGreaterThan(0);
  });
});
