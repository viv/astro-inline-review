/**
 * Core annotation orchestrator.
 *
 * Coordinates text selection detection, element annotation (Alt+click),
 * inspector overlay, popup display, highlight injection, and API persistence.
 * This is the central "controller" that ties together selection.ts,
 * element-selector.ts, highlights.ts, popup.ts, and api.ts.
 */

import { serializeRange, deserializeRange, findRangeByContext, findRangeByContextSeam } from './selection.js';
import {
  applyHighlight,
  removeHighlight,
  getHighlightMarks,
  HIGHLIGHT_ATTR,
  applyElementHighlight,
  removeElementHighlight,
  removeAllElementHighlights,
  ELEMENT_HIGHLIGHT_ATTR,
} from './highlights.js';
import {
  createPopup,
  showPopup,
  showEditPopup,
  showElementPopup,
  showEditElementPopup,
  hidePopup,
  isPopupVisible,
  type PopupElements,
} from './ui/popup.js';
import { buildElementSelector, resolveElement } from './element-selector.js';
import { api } from './api.js';
import { writeCache, readCache } from './cache.js';
import { updateBadge } from './ui/fab.js';
import { showToast } from './ui/toast.js';
import { Z_INDEX } from './styles.js';
import { isTextAnnotation, isElementAnnotation, getAnnotationStatus } from './types.js';
import type { ReviewMediator } from './mediator.js';

export interface AnnotatorDeps {
  shadowRoot: ShadowRoot;
  badge: HTMLSpanElement;
  mediator: ReviewMediator;
}

export interface AnnotatorInstance {
  /** Restore highlights from stored annotations for the current page */
  restoreHighlights: () => Promise<void>;
  /** Clean up event listeners */
  destroy: () => void;
  /** Popup elements for external hide/visibility checks */
  popup: PopupElements;
}

/**
 * Initialise the annotator — sets up selection detection, element annotation,
 * inspector overlay, popup, and highlight management.
 */
export function createAnnotator(deps: AnnotatorDeps): AnnotatorInstance {
  const { shadowRoot, badge, mediator } = deps;
  const popup: PopupElements = createPopup(shadowRoot);

  // Track current selection for creating new text annotations
  let currentRange: Range | null = null;

  // Inspector mode state (Alt+hover)
  let inspectorActive = false;
  let inspectedElement: Element | null = null;
  let inspectorOverlay: HTMLDivElement | null = null;
  let inspectorLabel: HTMLDivElement | null = null;

  // Track element target for element annotation save flow
  let currentElementTarget: Element | null = null;

  // Track scroll position when popup was shown (for scroll-threshold dismissal)
  let popupScrollY: number | null = null;

  // --- Text Selection Detection ---

  function onMouseUp(e: MouseEvent): void {
    // Alt+click is handled by onClickCapture — skip here
    if (e.altKey) return;

    // Ignore clicks inside the Shadow DOM host
    const host = shadowRoot.host;
    if (host.contains(e.target as Node) || e.target === host) return;

    // Check if user clicked on an existing text highlight
    const target = e.target as HTMLElement;
    if (target.tagName === 'MARK' && target.hasAttribute(HIGHLIGHT_ATTR)) {
      handleHighlightClick(target);
      return;
    }

    // Check if user clicked on an annotated element (element highlight)
    const annotatedEl = findAnnotatedAncestor(target);
    if (annotatedEl) {
      handleElementHighlightClick(annotatedEl);
      return;
    }

    // Check for text selection
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const text = range.toString().trim();

    // Ignore whitespace-only selections
    if (!text) return;

    // Ignore selections inside the Shadow DOM
    // Note: host.contains() doesn't see into the shadow root — need both checks
    if (host.contains(range.commonAncestorContainer) ||
        shadowRoot.contains(range.commonAncestorContainer)) return;

    currentRange = range.cloneRange();
    popupScrollY = window.scrollY;

    const rect = range.getBoundingClientRect();
    showPopup(popup, text, rect, {
      onSave: (note) => handleSave(note),
      onCancel: () => {
        hidePopup(popup);
        currentRange = null;
        selection.removeAllRanges();
      },
    });
  }

  function onScroll(): void {
    if (isPopupVisible(popup) && popupScrollY !== null) {
      if (Math.abs(window.scrollY - popupScrollY) > 50) {
        // Don't dismiss if textarea has unsaved content
        if (popup.textarea.value.trim()) return;
        hidePopup(popup);
        currentRange = null;
        currentElementTarget = null;
        popupScrollY = null;
      }
    }
  }

  // --- Inspector Mode (Alt+hover) ---

  function onKeyDown(e: KeyboardEvent): void {
    if (e.key !== 'Alt') return;
    inspectorActive = true;
  }

  function onKeyUp(e: KeyboardEvent): void {
    if (e.key !== 'Alt') return;
    inspectorActive = false;
    inspectedElement = null;
    destroyInspector();
  }

  function onMouseMove(e: MouseEvent): void {
    if (!inspectorActive) return;

    const target = e.target as Element;
    const host = shadowRoot.host;

    // Don't inspect the shadow DOM host or its contents
    if (target === host || host.contains(target)) {
      if (inspectedElement) {
        inspectedElement = null;
        destroyInspector();
      }
      return;
    }

    // Don't inspect body/html
    if (target === document.body || target === document.documentElement) {
      if (inspectedElement) {
        inspectedElement = null;
        destroyInspector();
      }
      return;
    }

    // Don't inspect the inspector overlay itself
    if (inspectorOverlay?.contains(target)) return;

    // Same element — no update needed
    if (target === inspectedElement) return;

    inspectedElement = target;
    updateInspector(target);
  }

  function createInspectorElements(): void {
    inspectorOverlay = document.createElement('div');
    inspectorOverlay.setAttribute('data-air-el', 'inspector-overlay');
    inspectorOverlay.style.cssText = [
      'position: fixed',
      'pointer-events: none',
      'background: rgba(66, 133, 244, 0.15)',
      'border: 2px solid rgba(66, 133, 244, 0.6)',
      'border-radius: 2px',
      `z-index: ${Z_INDEX.inspector}`,
      'transition: all 0.1s ease',
    ].join('; ');

    inspectorLabel = document.createElement('div');
    inspectorLabel.setAttribute('data-air-el', 'inspector-label');
    inspectorLabel.style.cssText = [
      'position: absolute',
      'top: -22px',
      'left: -2px',
      'background: rgba(66, 133, 244, 0.9)',
      'color: white',
      'font-size: 11px',
      'font-family: monospace',
      'padding: 1px 6px',
      'border-radius: 2px 2px 0 0',
      'white-space: nowrap',
      'pointer-events: none',
      'max-width: 400px',
      'overflow: hidden',
      'text-overflow: ellipsis',
    ].join('; ');

    inspectorOverlay.appendChild(inspectorLabel);
    document.body.appendChild(inspectorOverlay);
  }

  function updateInspector(element: Element): void {
    if (!inspectorOverlay) createInspectorElements();

    const rect = element.getBoundingClientRect();
    inspectorOverlay!.style.top = `${rect.top}px`;
    inspectorOverlay!.style.left = `${rect.left}px`;
    inspectorOverlay!.style.width = `${rect.width}px`;
    inspectorOverlay!.style.height = `${rect.height}px`;

    // Generate label text
    const tag = element.tagName.toLowerCase();
    let label = tag;
    if (element.id) {
      label = `${tag}#${element.id}`;
    } else if (element.classList.length > 0) {
      label = `${tag}.${element.classList[0]}`;
    }
    inspectorLabel!.textContent = label;
  }

  function destroyInspector(): void {
    if (inspectorOverlay) {
      inspectorOverlay.remove();
      inspectorOverlay = null;
      inspectorLabel = null;
    }
  }

  // --- Alt+Click (Element Annotation) ---

  function onClickCapture(e: MouseEvent): void {
    if (!e.altKey) return;

    // Prevent default (e.g. macOS Alt+click downloads links)
    e.preventDefault();
    e.stopPropagation();

    // Ignore if popup is already visible
    if (isPopupVisible(popup)) return;

    const target = e.target as Element;
    const host = shadowRoot.host;

    // Ignore clicks on shadow DOM host
    if (target === host || host.contains(target)) return;

    // Ignore clicks on body/html
    if (target === document.body || target === document.documentElement) return;

    // Clean up inspector
    inspectorActive = false;
    inspectedElement = null;
    destroyInspector();

    // Store element target for save flow
    currentElementTarget = target;
    popupScrollY = window.scrollY;

    // Build element description for popup
    const selector = buildElementSelector(target);
    const rect = target.getBoundingClientRect();

    showElementPopup(popup, selector.description, rect, {
      onSave: (note) => handleElementSave(note),
      onCancel: () => {
        hidePopup(popup);
        currentElementTarget = null;
      },
    });
  }

  // --- Save New Text Annotation ---

  async function handleSave(note: string): Promise<void> {
    if (!currentRange) return;

    // Capture range locally before any async work
    const range = currentRange;
    currentRange = null;

    const selectedText = range.toString();
    const serialized = serializeRange(range);

    hidePopup(popup);

    try {
      const annotation = await api.createAnnotation({
        type: 'text',
        pageUrl: window.location.pathname,
        pageTitle: document.title,
        selectedText,
        note,
        range: serialized,
      });

      applyHighlight(range, annotation.id);

      if (getHighlightMarks(annotation.id).length === 0) {
        const fallbackRange = findRangeByContext(
          serialized.selectedText,
          serialized.contextBefore,
          serialized.contextAfter,
        );
        if (fallbackRange) {
          applyHighlight(fallbackRange, annotation.id);
        }
      }

      await refreshCacheAndBadge();
    } catch (err) {
      console.error('[astro-inline-review] Failed to save annotation:', err);
      showToast(shadowRoot, 'Failed to save annotation');
    }

    window.getSelection()?.removeAllRanges();
  }

  // --- Save New Element Annotation ---

  async function handleElementSave(note: string): Promise<void> {
    if (!currentElementTarget) return;

    const element = currentElementTarget;
    currentElementTarget = null;

    const elementSelector = buildElementSelector(element);

    hidePopup(popup);

    try {
      const annotation = await api.createAnnotation({
        type: 'element',
        pageUrl: window.location.pathname,
        pageTitle: document.title,
        note,
        elementSelector,
      });

      applyElementHighlight(element, annotation.id);
      await refreshCacheAndBadge();
    } catch (err) {
      console.error('[astro-inline-review] Failed to save element annotation:', err);
      showToast(shadowRoot, 'Failed to save annotation');
    }
  }

  // --- Edit Existing Text Annotation ---

  async function handleHighlightClick(mark: HTMLElement): Promise<void> {
    const annotationId = mark.getAttribute(HIGHLIGHT_ATTR);
    if (!annotationId) return;

    // Fetch current annotation data
    const store = readCache() ?? await api.getStore(window.location.pathname);
    const annotation = store.annotations.find(a => a.id === annotationId);
    if (!annotation || !isTextAnnotation(annotation)) return;

    popupScrollY = window.scrollY;
    const rect = mark.getBoundingClientRect();
    showEditPopup(popup, annotation.selectedText, annotation.note, rect, {
      onSave: async (newNote) => {
        hidePopup(popup);
        try {
          await api.updateAnnotation(annotationId, { note: newNote });
          await refreshCacheAndBadge();
        } catch (err) {
          console.error('[astro-inline-review] Failed to update annotation:', err);
          showToast(shadowRoot, 'Failed to update annotation');
        }
      },
      onCancel: () => hidePopup(popup),
      onDelete: async () => {
        hidePopup(popup);
        try {
          await api.deleteAnnotation(annotationId);
          removeHighlight(annotationId);
          await refreshCacheAndBadge();
        } catch (err) {
          console.error('[astro-inline-review] Failed to delete annotation:', err);
          showToast(shadowRoot, 'Failed to delete annotation');
        }
      },
    });
  }

  // --- Edit Existing Element Annotation ---

  async function handleElementHighlightClick(element: HTMLElement): Promise<void> {
    const annotationId = element.getAttribute(ELEMENT_HIGHLIGHT_ATTR);
    if (!annotationId) return;

    const store = readCache() ?? await api.getStore(window.location.pathname);
    const annotation = store.annotations.find(a => a.id === annotationId);
    if (!annotation || !isElementAnnotation(annotation)) return;

    popupScrollY = window.scrollY;
    const rect = element.getBoundingClientRect();
    showEditElementPopup(popup, annotation.elementSelector.description, annotation.note, rect, {
      onSave: async (newNote) => {
        hidePopup(popup);
        try {
          await api.updateAnnotation(annotationId, { note: newNote });
          await refreshCacheAndBadge();
        } catch (err) {
          console.error('[astro-inline-review] Failed to update element annotation:', err);
          showToast(shadowRoot, 'Failed to update annotation');
        }
      },
      onCancel: () => hidePopup(popup),
      onDelete: async () => {
        hidePopup(popup);
        removeElementHighlight(annotationId);
        try {
          await api.deleteAnnotation(annotationId);
          await refreshCacheAndBadge();
        } catch (err) {
          console.error('[astro-inline-review] Failed to delete element annotation:', err);
          showToast(shadowRoot, 'Failed to delete annotation');
        }
      },
    });
  }

  // --- Helpers ---

  /**
   * Walk up from an element to find the closest ancestor with
   * a data-air-element-id attribute (annotated element).
   */
  function findAnnotatedAncestor(el: HTMLElement): HTMLElement | null {
    let current: HTMLElement | null = el;
    while (current && current !== document.body && current !== document.documentElement) {
      if (current.hasAttribute(ELEMENT_HIGHLIGHT_ATTR)) return current;
      current = current.parentElement;
    }
    return null;
  }

  // --- Restore Highlights ---

  async function restoreHighlights(): Promise<void> {
    // Remove existing text highlights
    const existingMarks = document.querySelectorAll(`mark[${HIGHLIGHT_ATTR}]`);
    for (const mark of existingMarks) {
      const id = mark.getAttribute(HIGHLIGHT_ATTR)!;
      removeHighlight(id);
    }

    // Remove existing element highlights
    removeAllElementHighlights();

    try {
      const store = await api.getStore(window.location.pathname);
      writeCache(store);

      const pageAnnotations = store.annotations.filter(
        a => a.pageUrl === window.location.pathname,
      );

      // Restore text highlights
      const textAnnotations = pageAnnotations.filter(isTextAnnotation);
      for (const annotation of textAnnotations) {
        const status = getAnnotationStatus(annotation);

        // Tier 1: Try XPath + offset
        let range = deserializeRange(annotation.range);

        // Tier 2: Fall back to context matching with original text
        if (!range) {
          range = findRangeByContext(
            annotation.range.selectedText,
            annotation.range.contextBefore,
            annotation.range.contextAfter,
          );
        }

        // Tier 2.5: Try context matching with replacement text
        if (!range && annotation.replacedText) {
          range = findRangeByContext(
            annotation.replacedText,
            annotation.range.contextBefore,
            annotation.range.contextAfter,
          );
        }

        // Tier 3: Context-seam — find where contextBefore and contextAfter
        // meet, even if the annotated text has been completely rewritten
        if (!range) {
          range = findRangeByContextSeam(
            annotation.range.contextBefore,
            annotation.range.contextAfter,
          );
        }

        // Tier 4: Orphaned — no highlight, visible only in panel
        if (range) {
          applyHighlight(range, annotation.id, status);
        }
      }

      // Restore element highlights
      const elementAnnotations = pageAnnotations.filter(isElementAnnotation);
      for (const annotation of elementAnnotations) {
        const element = resolveElement(annotation.elementSelector);
        if (element) {
          applyElementHighlight(element, annotation.id, getAnnotationStatus(annotation));
        }
      }

      // Update badge with current page count
      updateBadge(badge, pageAnnotations.length);
    } catch (err) {
      console.error('[astro-inline-review] Failed to restore highlights:', err);
      showToast(shadowRoot, 'Failed to load annotations');
      // Try cache fallback
      const cached = readCache();
      if (cached) {
        const pageCount = cached.annotations.filter(
          a => a.pageUrl === window.location.pathname,
        ).length;
        updateBadge(badge, pageCount);
      }
    }
  }

  // Wire up mediator so the panel can trigger highlight restoration
  mediator.restoreHighlights = restoreHighlights;

  // --- Badge Refresh ---

  async function refreshCacheAndBadge(): Promise<void> {
    try {
      const store = await api.getStore(window.location.pathname);
      writeCache(store);
      const pageCount = store.annotations.filter(
        a => a.pageUrl === window.location.pathname,
      ).length;
      updateBadge(badge, pageCount);
    } catch {
      // Ignore — badge stays at last known count
    }
  }

  // --- Event Listeners ---

  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('scroll', onScroll, { passive: true });
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('click', onClickCapture, true); // Capture phase

  // --- Cleanup ---

  function destroy(): void {
    document.removeEventListener('mouseup', onMouseUp);
    document.removeEventListener('scroll', onScroll);
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('keyup', onKeyUp);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('click', onClickCapture, true);
    destroyInspector();
  }

  return { restoreHighlights, destroy, popup };
}
