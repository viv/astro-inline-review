/**
 * Review panel — slide-in sidebar.
 *
 * Two tabs: "This Page" and "All Pages".
 * Shows annotations with click-to-scroll, page notes with CRUD,
 * and export/clear-all actions.
 */

import { api } from '../api.js';
import { writeCache, readCache } from '../cache.js';
import type { Annotation, TextAnnotation, PageNote, ReviewStore } from '../types.js';
import { isTextAnnotation } from '../types.js';
import type { ReviewMediator } from '../mediator.js';

export interface PanelElements {
  container: HTMLDivElement;
  thisPageTab: HTMLButtonElement;
  allPagesTab: HTMLButtonElement;
  content: HTMLDivElement;
  addNoteBtn: HTMLButtonElement;
  mediator: ReviewMediator;
}

export interface PanelCallbacks {
  onAnnotationClick: (annotationId: string) => void;
  onRefreshBadge: () => Promise<void>;
  onExport: () => Promise<void>;
}

type ActiveTab = 'this-page' | 'all-pages';

/**
 * Create the panel and append to shadow root.
 */
export function createPanel(
  shadowRoot: ShadowRoot,
  callbacks: PanelCallbacks,
  mediator: ReviewMediator,
): PanelElements {
  const container = document.createElement('div');
  container.className = 'air-panel';
  container.setAttribute('data-air-el', 'panel');
  container.setAttribute('data-air-state', 'closed');

  // Header
  const header = document.createElement('div');
  header.className = 'air-panel__header';

  const title = document.createElement('h2');
  title.className = 'air-panel__title';
  title.textContent = 'Inline Review';
  header.appendChild(title);

  const actions = document.createElement('div');
  actions.className = 'air-panel__actions';

  const addNoteBtn = document.createElement('button');
  addNoteBtn.className = 'air-panel__btn';
  addNoteBtn.setAttribute('data-air-el', 'page-note-add');
  addNoteBtn.textContent = '+ Note';
  addNoteBtn.title = 'Add page note';
  actions.appendChild(addNoteBtn);

  const exportBtn = document.createElement('button');
  exportBtn.className = 'air-panel__btn air-panel__btn--export';
  exportBtn.setAttribute('data-air-el', 'export');
  exportBtn.textContent = 'Copy All';
  exportBtn.title = 'Copy all annotations to clipboard as Markdown';
  exportBtn.addEventListener('click', () => callbacks.onExport());
  actions.appendChild(exportBtn);

  const clearBtn = document.createElement('button');
  clearBtn.className = 'air-panel__btn air-panel__btn--danger';
  clearBtn.setAttribute('data-air-el', 'clear-all');
  clearBtn.textContent = 'Clear All';
  actions.appendChild(clearBtn);
  setupClearAll(clearBtn, callbacks, mediator);

  header.appendChild(actions);
  container.appendChild(header);

  // Tabs
  const tabs = document.createElement('div');
  tabs.className = 'air-panel__tabs';

  const thisPageTab = document.createElement('button');
  thisPageTab.className = 'air-panel__tab air-panel__tab--active';
  thisPageTab.setAttribute('data-air-el', 'tab-this-page');
  thisPageTab.textContent = 'This Page (0)';
  tabs.appendChild(thisPageTab);

  const allPagesTab = document.createElement('button');
  allPagesTab.className = 'air-panel__tab';
  allPagesTab.setAttribute('data-air-el', 'tab-all-pages');
  allPagesTab.textContent = 'All Pages (0)';
  tabs.appendChild(allPagesTab);

  container.appendChild(tabs);

  // Content area
  const content = document.createElement('div');
  content.className = 'air-panel__content';
  content.setAttribute('data-air-el', 'panel-content');
  container.appendChild(content);

  shadowRoot.appendChild(container);

  // State
  let activeTab: ActiveTab = 'this-page';

  thisPageTab.addEventListener('click', () => {
    activeTab = 'this-page';
    thisPageTab.classList.add('air-panel__tab--active');
    allPagesTab.classList.remove('air-panel__tab--active');
    refreshPanel(content, activeTab, callbacks, mediator);
  });

  allPagesTab.addEventListener('click', () => {
    activeTab = 'all-pages';
    allPagesTab.classList.add('air-panel__tab--active');
    thisPageTab.classList.remove('air-panel__tab--active');
    refreshPanel(content, activeTab, callbacks, mediator);
  });

  // Add page note handler
  addNoteBtn.addEventListener('click', () => {
    showAddNoteForm(content, callbacks, mediator);
  });

  const elements: PanelElements = { container, thisPageTab, allPagesTab, content, addNoteBtn, mediator };

  // Wire up mediator so other modules can trigger a panel refresh
  mediator.refreshPanel = async () => {
    try {
      const store = await api.getStore();
      refreshPanel(content, activeTab, callbacks, mediator, store);
      updateTabCounts(thisPageTab, allPagesTab, store);
    } catch {
      // Fall back to independent fetches
      refreshPanel(content, activeTab, callbacks, mediator);
      updateTabCounts(thisPageTab, allPagesTab);
    }
  };

  return elements;
}

/**
 * Toggle the panel open/closed.
 */
export function togglePanel(panel: PanelElements): boolean {
  const isOpen = panel.container.classList.toggle('air-panel--open');
  panel.container.setAttribute('data-air-state', isOpen ? 'open' : 'closed');
  if (isOpen) {
    panel.mediator.refreshPanel();
  }
  return isOpen;
}

/**
 * Check if panel is open.
 */
export function isPanelOpen(panel: PanelElements): boolean {
  return panel.container.classList.contains('air-panel--open');
}

/**
 * Close the panel.
 */
export function closePanel(panel: PanelElements): void {
  panel.container.classList.remove('air-panel--open');
  panel.container.setAttribute('data-air-state', 'closed');
}

// --- Internal ---

async function refreshPanel(
  content: HTMLDivElement,
  activeTab: ActiveTab,
  callbacks: PanelCallbacks,
  mediator: ReviewMediator,
  prefetchedStore?: ReviewStore,
): Promise<void> {
  content.innerHTML = '';

  try {
    // "All Pages" must always fetch from the server — the cache only holds
    // the current page's annotations (written by restoreHighlights).
    const store = prefetchedStore
      ?? (activeTab === 'all-pages'
        ? await api.getStore()
        : (readCache() ?? await api.getStore()));
    if (activeTab === 'this-page') {
      renderThisPage(content, store, callbacks, mediator);
    } else {
      renderAllPages(content, store, callbacks, mediator);
    }
  } catch {
    content.innerHTML = '<div class="air-panel__empty">Failed to load annotations</div>';
  }
}

function renderThisPage(
  content: HTMLDivElement,
  store: ReviewStore,
  callbacks: PanelCallbacks,
  mediator: ReviewMediator,
): void {
  const currentPage = window.location.pathname;
  const pageAnnotations = store.annotations.filter(a => a.pageUrl === currentPage);
  const pageNotes = store.pageNotes.filter(n => n.pageUrl === currentPage);

  // Page notes section
  if (pageNotes.length > 0) {
    const notesHeader = document.createElement('div');
    notesHeader.className = 'air-page-group__title';
    notesHeader.textContent = 'Page Notes';
    content.appendChild(notesHeader);

    for (const note of pageNotes) {
      content.appendChild(createPageNoteItem(note, callbacks, mediator));
    }
  }

  // Annotations section
  if (pageAnnotations.length > 0) {
    const annotationsHeader = document.createElement('div');
    annotationsHeader.className = 'air-page-group__title';
    annotationsHeader.textContent = 'Annotations';
    content.appendChild(annotationsHeader);

    for (const annotation of pageAnnotations) {
      content.appendChild(createAnnotationItem(annotation, callbacks));
    }
  }

  if (pageAnnotations.length === 0 && pageNotes.length === 0) {
    content.innerHTML = '<div class="air-panel__empty"><span class="air-panel__empty-arrow" data-air-el="empty-arrow">\u2190</span><br>No annotations on this page yet.<br>Select text or Alt+click elements to get started.</div>';
  }
}

function renderAllPages(
  content: HTMLDivElement,
  store: ReviewStore,
  callbacks: PanelCallbacks,
  mediator: ReviewMediator,
): void {
  // Group by page URL
  const pages = new Map<string, { title: string; annotations: Annotation[]; notes: PageNote[] }>();

  for (const a of store.annotations) {
    if (!pages.has(a.pageUrl)) {
      pages.set(a.pageUrl, { title: a.pageTitle, annotations: [], notes: [] });
    }
    pages.get(a.pageUrl)!.annotations.push(a);
  }

  for (const n of store.pageNotes) {
    if (!pages.has(n.pageUrl)) {
      pages.set(n.pageUrl, { title: n.pageTitle, annotations: [], notes: [] });
    }
    pages.get(n.pageUrl)!.notes.push(n);
  }

  if (pages.size === 0) {
    content.innerHTML = '<div class="air-panel__empty">No annotations across any pages.</div>';
    return;
  }

  for (const [url, page] of pages) {
    const pageTitle = document.createElement('div');
    pageTitle.className = 'air-page-group__title';
    pageTitle.textContent = `${url}${page.title ? ` — ${page.title}` : ''}`;
    content.appendChild(pageTitle);

    for (const note of page.notes) {
      content.appendChild(createPageNoteItem(note, callbacks, mediator));
    }

    for (const annotation of page.annotations) {
      content.appendChild(createAnnotationItem(annotation, callbacks));
    }
  }
}

function createAnnotationItem(annotation: Annotation, callbacks: PanelCallbacks): HTMLDivElement {
  if (isTextAnnotation(annotation)) {
    return createTextAnnotationItem(annotation, callbacks);
  }
  return createElementAnnotationItem(annotation, callbacks);
}

function createTextAnnotationItem(annotation: TextAnnotation, callbacks: PanelCallbacks): HTMLDivElement {
  const item = document.createElement('div');
  item.className = 'air-annotation-item';
  item.setAttribute('data-air-el', 'annotation-item');

  const text = document.createElement('div');
  text.className = 'air-annotation-item__text';
  const truncated = annotation.selectedText.length > 80
    ? annotation.selectedText.slice(0, 80) + '…'
    : annotation.selectedText;
  text.textContent = `"${truncated}"`;
  item.appendChild(text);

  if (annotation.note) {
    const note = document.createElement('div');
    note.className = 'air-annotation-item__note';
    note.textContent = annotation.note;
    item.appendChild(note);
  }

  item.addEventListener('click', () => {
    callbacks.onAnnotationClick(annotation.id);
  });

  return item;
}

function createElementAnnotationItem(annotation: Annotation & { type: 'element' }, callbacks: PanelCallbacks): HTMLDivElement {
  const item = document.createElement('div');
  item.className = 'air-annotation-item';
  item.setAttribute('data-air-el', 'element-annotation-item');

  const desc = document.createElement('div');
  desc.className = 'air-annotation-item__text';
  desc.textContent = annotation.elementSelector.description;
  item.appendChild(desc);

  if (annotation.note) {
    const note = document.createElement('div');
    note.className = 'air-annotation-item__note';
    note.textContent = annotation.note;
    item.appendChild(note);
  }

  item.addEventListener('click', () => {
    callbacks.onAnnotationClick(annotation.id);
  });

  return item;
}

function createPageNoteItem(note: PageNote, callbacks: PanelCallbacks, mediator: ReviewMediator): HTMLDivElement {
  const item = document.createElement('div');
  item.className = 'air-annotation-item';
  item.setAttribute('data-air-el', 'page-note-item');

  const noteText = document.createElement('div');
  noteText.className = 'air-annotation-item__note';
  noteText.textContent = note.note;
  item.appendChild(noteText);

  // Inline edit/delete actions
  const actions = document.createElement('div');
  actions.style.cssText = 'display: flex; gap: 8px; margin-top: 8px;';

  const editBtn = document.createElement('button');
  editBtn.className = 'air-popup__btn air-popup__btn--cancel';
  editBtn.setAttribute('data-air-el', 'page-note-edit');
  editBtn.textContent = 'Edit';
  editBtn.style.fontSize = '11px';
  editBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    showEditNoteForm(item, note, callbacks, mediator);
  });
  actions.appendChild(editBtn);

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'air-popup__btn air-popup__btn--delete';
  deleteBtn.setAttribute('data-air-el', 'page-note-delete');
  deleteBtn.textContent = 'Delete';
  deleteBtn.style.fontSize = '11px';
  deleteBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      await api.deletePageNote(note.id);
      await callbacks.onRefreshBadge();
      mediator.refreshPanel();
    } catch (err) {
      console.error('[astro-inline-review] Failed to delete page note:', err);
    }
  });
  actions.appendChild(deleteBtn);

  item.appendChild(actions);

  return item;
}

function showAddNoteForm(content: HTMLDivElement, callbacks: PanelCallbacks, mediator: ReviewMediator): void {
  // Insert a form at the top of the content area
  const existing = content.querySelector('.air-note-form');
  if (existing) {
    existing.remove();
    return; // Toggle off
  }

  const form = createNoteForm('', async (noteText) => {
    if (!noteText.trim()) {
      form.remove();
      return;
    }

    try {
      await api.createPageNote({
        pageUrl: window.location.pathname,
        pageTitle: document.title,
        note: noteText.trim(),
      });
      form.remove();
      await callbacks.onRefreshBadge();
      mediator.refreshPanel();
    } catch (err) {
      console.error('[astro-inline-review] Failed to create page note:', err);
    }
  }, () => {
    form.remove();
  });

  content.insertBefore(form, content.firstChild);
  form.querySelector('textarea')?.focus();
}

function showEditNoteForm(
  item: HTMLDivElement,
  note: PageNote,
  callbacks: PanelCallbacks,
  mediator: ReviewMediator,
): void {
  const form = createNoteForm(note.note, async (noteText) => {
    if (!noteText.trim()) return;

    try {
      await api.updatePageNote(note.id, { note: noteText.trim() });
      await callbacks.onRefreshBadge();
      mediator.refreshPanel();
    } catch (err) {
      console.error('[astro-inline-review] Failed to update page note:', err);
    }
  }, () => {
    // Cancel — just restore the item
    mediator.refreshPanel();
  });

  item.innerHTML = '';
  item.appendChild(form);
  form.querySelector('textarea')?.focus();
}

function createNoteForm(
  initialValue: string,
  onSave: (value: string) => void,
  onCancel: () => void,
): HTMLDivElement {
  const form = document.createElement('div');
  form.className = 'air-note-form';
  form.style.cssText = 'padding: 8px; margin-bottom: 8px;';

  const textarea = document.createElement('textarea');
  textarea.className = 'air-popup__textarea';
  textarea.setAttribute('data-air-el', 'page-note-textarea');
  textarea.value = initialValue;
  textarea.placeholder = 'Add a page-level note…';
  textarea.style.minHeight = '60px';
  form.appendChild(textarea);

  const footer = document.createElement('div');
  footer.style.cssText = 'display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px;';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'air-popup__btn air-popup__btn--cancel';
  cancelBtn.setAttribute('data-air-el', 'page-note-cancel');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', onCancel);
  footer.appendChild(cancelBtn);

  const saveBtn = document.createElement('button');
  saveBtn.className = 'air-popup__btn air-popup__btn--save';
  saveBtn.setAttribute('data-air-el', 'page-note-save');
  saveBtn.textContent = 'Save';
  saveBtn.addEventListener('click', () => onSave(textarea.value));
  footer.appendChild(saveBtn);

  form.appendChild(footer);
  return form;
}

/** Two-click clear: first click shows confirmation, second click deletes. */
function setupClearAll(clearBtn: HTMLButtonElement, callbacks: PanelCallbacks, mediator: ReviewMediator): void {
  let confirming = false;
  let resetTimeout: ReturnType<typeof setTimeout> | null = null;

  clearBtn.addEventListener('click', async () => {
    if (!confirming) {
      // First click — enter confirmation state
      confirming = true;
      clearBtn.textContent = 'Confirm Delete';
      clearBtn.setAttribute('data-air-state', 'confirming');

      // Auto-reset after 3 seconds if user doesn't confirm
      resetTimeout = setTimeout(() => {
        confirming = false;
        clearBtn.textContent = 'Clear All';
        clearBtn.removeAttribute('data-air-state');
      }, 3000);
      return;
    }

    // Second click — actually clear
    if (resetTimeout) clearTimeout(resetTimeout);
    confirming = false;
    clearBtn.textContent = 'Clear All';
    clearBtn.removeAttribute('data-air-state');

    try {
      const store = await api.getStore();

      for (const a of store.annotations) {
        await api.deleteAnnotation(a.id);
      }
      for (const n of store.pageNotes) {
        await api.deletePageNote(n.id);
      }

      writeCache({ version: 1, annotations: [], pageNotes: [] });
      await callbacks.onRefreshBadge();

      // Clean up DOM highlights (text marks + element outlines)
      await mediator.restoreHighlights();

      // Refresh panel content
      mediator.refreshPanel();
    } catch (err) {
      console.error('[astro-inline-review] Failed to clear all:', err);
    }
  });
}

async function updateTabCounts(
  thisPageTab: HTMLButtonElement,
  allPagesTab: HTMLButtonElement,
  prefetchedStore?: ReviewStore,
): Promise<void> {
  try {
    // Always fetch from server for accurate All Pages count
    const store = prefetchedStore ?? await api.getStore();
    const currentPage = window.location.pathname;
    const thisPageCount = store.annotations.filter(a => a.pageUrl === currentPage).length +
                          store.pageNotes.filter(n => n.pageUrl === currentPage).length;
    const allCount = store.annotations.length + store.pageNotes.length;

    thisPageTab.textContent = `This Page (${thisPageCount})`;
    allPagesTab.textContent = `All Pages (${allCount})`;
  } catch {
    // Ignore — counts stay stale
  }
}
