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
      onAnnotationDelete: vi.fn().mockResolvedValue(undefined),
      isAnnotationOrphaned: vi.fn().mockReturnValue(false),
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
      onAnnotationDelete: vi.fn().mockResolvedValue(undefined),
      isAnnotationOrphaned: vi.fn().mockReturnValue(false),
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

describe('annotation item — delete button', () => {
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
      onAnnotationDelete: vi.fn().mockResolvedValue(undefined),
      isAnnotationOrphaned: vi.fn().mockReturnValue(false),
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
    createPanel(shadowRoot, callbacks, mediator);
    await mediator.refreshPanel();
  }

  it('renders delete button on text annotation item', async () => {
    await renderWithStore({
      version: 1,
      annotations: [makeTextAnnotation()],
      pageNotes: [],
    });

    const deleteBtn = shadowRoot.querySelector('[data-air-el="annotation-delete"]');
    expect(deleteBtn).not.toBeNull();
    expect(deleteBtn!.tagName.toLowerCase()).toBe('button');
    expect(deleteBtn!.textContent).toBe('Delete');
  });

  it('renders delete button on element annotation item', async () => {
    await renderWithStore({
      version: 1,
      annotations: [makeElementAnnotation()],
      pageNotes: [],
    });

    const deleteBtn = shadowRoot.querySelector('[data-air-el="annotation-delete"]');
    expect(deleteBtn).not.toBeNull();
    expect(deleteBtn!.textContent).toBe('Delete');
  });

  it('calls onAnnotationDelete with annotation ID when clicked', async () => {
    await renderWithStore({
      version: 1,
      annotations: [makeTextAnnotation({ id: 'delete-me' })],
      pageNotes: [],
    });

    const deleteBtn = shadowRoot.querySelector('[data-air-el="annotation-delete"]') as HTMLButtonElement;
    deleteBtn.click();

    expect(callbacks.onAnnotationDelete).toHaveBeenCalledWith('delete-me');
  });

  it('does not trigger onAnnotationClick when delete is clicked', async () => {
    await renderWithStore({
      version: 1,
      annotations: [makeTextAnnotation()],
      pageNotes: [],
    });

    const deleteBtn = shadowRoot.querySelector('[data-air-el="annotation-delete"]') as HTMLButtonElement;
    deleteBtn.click();

    expect(callbacks.onAnnotationClick).not.toHaveBeenCalled();
  });
});

describe('annotation item — orphan indicator', () => {
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
      onAnnotationDelete: vi.fn().mockResolvedValue(undefined),
      isAnnotationOrphaned: vi.fn().mockReturnValue(false),
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
    createPanel(shadowRoot, callbacks, mediator);
    await mediator.refreshPanel();
  }

  it('shows orphan indicator when isAnnotationOrphaned returns true', async () => {
    vi.mocked(callbacks.isAnnotationOrphaned).mockReturnValue(true);

    await renderWithStore({
      version: 1,
      annotations: [makeTextAnnotation()],
      pageNotes: [],
    });

    const orphanIndicator = shadowRoot.querySelector('.air-annotation-item__orphan');
    expect(orphanIndicator).not.toBeNull();
    expect(orphanIndicator!.textContent).toBe('Could not locate on page');
  });

  it('does not show orphan indicator when isAnnotationOrphaned returns false', async () => {
    vi.mocked(callbacks.isAnnotationOrphaned).mockReturnValue(false);

    await renderWithStore({
      version: 1,
      annotations: [makeTextAnnotation()],
      pageNotes: [],
    });

    const orphanIndicator = shadowRoot.querySelector('.air-annotation-item__orphan');
    expect(orphanIndicator).toBeNull();
  });

  it('adds orphan modifier class when annotation is orphaned', async () => {
    vi.mocked(callbacks.isAnnotationOrphaned).mockReturnValue(true);

    await renderWithStore({
      version: 1,
      annotations: [makeTextAnnotation()],
      pageNotes: [],
    });

    const item = shadowRoot.querySelector('[data-air-el="annotation-item"]');
    expect(item!.classList.contains('air-annotation-item--orphan')).toBe(true);
  });

  it('does not add orphan modifier class when annotation is not orphaned', async () => {
    vi.mocked(callbacks.isAnnotationOrphaned).mockReturnValue(false);

    await renderWithStore({
      version: 1,
      annotations: [makeTextAnnotation()],
      pageNotes: [],
    });

    const item = shadowRoot.querySelector('[data-air-el="annotation-item"]');
    expect(item!.classList.contains('air-annotation-item--orphan')).toBe(false);
  });

  it('shows orphan indicator on element annotation when orphaned', async () => {
    vi.mocked(callbacks.isAnnotationOrphaned).mockReturnValue(true);

    await renderWithStore({
      version: 1,
      annotations: [makeElementAnnotation()],
      pageNotes: [],
    });

    const orphanIndicator = shadowRoot.querySelector('.air-annotation-item__orphan');
    expect(orphanIndicator).not.toBeNull();

    const item = shadowRoot.querySelector('[data-air-el="element-annotation-item"]');
    expect(item!.classList.contains('air-annotation-item--orphan')).toBe(true);
  });

  it('calls isAnnotationOrphaned with annotation id and pageUrl', async () => {
    await renderWithStore({
      version: 1,
      annotations: [makeTextAnnotation({ id: 'check-me' })],
      pageNotes: [],
    });

    expect(callbacks.isAnnotationOrphaned).toHaveBeenCalledWith('check-me', '/');
  });
});
