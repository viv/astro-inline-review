/**
 * Core annotation orchestrator.
 *
 * Coordinates text selection detection, popup display, highlight injection,
 * and API persistence. This is the central "controller" that ties together
 * selection.ts, highlights.ts, popup.ts, and api.ts.
 */

import { serializeRange, deserializeRange, findRangeByContext } from './selection.js';
import { applyHighlight, removeHighlight, pulseHighlight, getHighlightMarks, HIGHLIGHT_ATTR } from './highlights.js';
import {
  createPopup,
  showPopup,
  showEditPopup,
  hidePopup,
  isPopupVisible,
  type PopupElements,
} from './ui/popup.js';
import { api } from './api.js';
import { writeCache, readCache } from './cache.js';
import { updateBadge } from './ui/fab.js';
import type { Annotation, ReviewStore } from './types.js';

export interface AnnotatorDeps {
  shadowRoot: ShadowRoot;
  badge: HTMLSpanElement;
}

export interface AnnotatorInstance {
  /** Restore highlights from stored annotations for the current page */
  restoreHighlights: () => Promise<void>;
  /** Clean up event listeners */
  destroy: () => void;
}

/**
 * Initialise the annotator — sets up selection detection, popup, and highlight management.
 */
export function createAnnotator(deps: AnnotatorDeps): AnnotatorInstance {
  const { shadowRoot, badge } = deps;
  const popup: PopupElements = createPopup(shadowRoot);

  // Track current selection for creating new annotations
  let currentRange: Range | null = null;

  // --- Selection Detection ---

  function onMouseUp(e: MouseEvent): void {
    // Ignore clicks inside the Shadow DOM host
    const host = shadowRoot.host;
    if (host.contains(e.target as Node)) return;

    // Check if user clicked on an existing highlight
    const target = e.target as HTMLElement;
    if (target.tagName === 'MARK' && target.hasAttribute(HIGHLIGHT_ATTR)) {
      handleHighlightClick(target);
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
    if (isPopupVisible(popup)) {
      hidePopup(popup);
      currentRange = null;
    }
  }

  // Attach listeners
  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('scroll', onScroll, { passive: true });

  // --- Save New Annotation ---

  async function handleSave(note: string): Promise<void> {
    if (!currentRange) return;

    // Capture range locally before any async work — onMouseUp can overwrite
    // the module-level currentRange during the API await
    const range = currentRange;
    currentRange = null;

    const selectedText = range.toString();
    const serialized = serializeRange(range);

    hidePopup(popup);

    try {
      const annotation = await api.createAnnotation({
        pageUrl: window.location.pathname,
        pageTitle: document.title,
        selectedText,
        note,
        range: serialized,
      });

      // Apply highlight — use the captured Range, falling back to
      // context-based matching if the Range was invalidated (e.g. during
      // the async API call the browser may detach text nodes).
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

      // Update cache and badge
      await refreshCacheAndBadge();
    } catch (err) {
      console.error('[astro-inline-review] Failed to save annotation:', err);
    }

    window.getSelection()?.removeAllRanges();
  }

  // --- Edit Existing Annotation ---

  async function handleHighlightClick(mark: HTMLElement): Promise<void> {
    const annotationId = mark.getAttribute(HIGHLIGHT_ATTR);
    if (!annotationId) return;

    // Fetch current annotation data
    const store = readCache() ?? await api.getStore(window.location.pathname);
    const annotation = store.annotations.find(a => a.id === annotationId);
    if (!annotation) return;

    const rect = mark.getBoundingClientRect();
    showEditPopup(popup, annotation.selectedText, annotation.note, rect, {
      onSave: async (newNote) => {
        hidePopup(popup);
        try {
          await api.updateAnnotation(annotationId, { note: newNote });
          await refreshCacheAndBadge();
        } catch (err) {
          console.error('[astro-inline-review] Failed to update annotation:', err);
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
        }
      },
    });
  }

  // --- Restore Highlights ---

  async function restoreHighlights(): Promise<void> {
    // Remove existing highlights first (e.g. on page transition)
    const existingMarks = document.querySelectorAll(`mark[${HIGHLIGHT_ATTR}]`);
    for (const mark of existingMarks) {
      const id = mark.getAttribute(HIGHLIGHT_ATTR)!;
      removeHighlight(id);
    }

    try {
      const store = await api.getStore(window.location.pathname);
      writeCache(store);

      const pageAnnotations = store.annotations.filter(
        a => a.pageUrl === window.location.pathname,
      );

      for (const annotation of pageAnnotations) {
        // Tier 1: Try XPath + offset
        let range = deserializeRange(annotation.range);

        // Tier 2: Fall back to context matching
        if (!range) {
          range = findRangeByContext(
            annotation.range.selectedText,
            annotation.range.contextBefore,
            annotation.range.contextAfter,
          );
        }

        // Tier 3: Orphaned — no highlight, visible only in panel
        if (range) {
          applyHighlight(range, annotation.id);
        }
      }

      // Update badge with current page count
      updateBadge(badge, pageAnnotations.length);
    } catch (err) {
      console.error('[astro-inline-review] Failed to restore highlights:', err);
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

  // --- Scroll To Annotation ---

  /**
   * Scroll to a highlight and pulse it. Called from the panel.
   * Exported via the annotator instance for the panel to use.
   */
  function scrollToAnnotation(annotationId: string): void {
    const marks = getHighlightMarks(annotationId);
    if (marks.length === 0) return;

    marks[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
    pulseHighlight(annotationId);
  }

  // Store on the shadow root for panel access
  (shadowRoot as any).__scrollToAnnotation = scrollToAnnotation;

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

  // --- Cleanup ---

  function destroy(): void {
    document.removeEventListener('mouseup', onMouseUp);
    document.removeEventListener('scroll', onScroll);
  }

  return { restoreHighlights, destroy };
}
