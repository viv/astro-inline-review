/**
 * Client entry point — bootstraps the inline review overlay.
 *
 * Creates Shadow DOM host, FAB, panel, annotator, keyboard shortcuts,
 * and loads existing annotations. Idempotent — safe to call multiple times.
 */
import { createHost } from './ui/host.js';
import { createFab, updateBadge, type FabElements } from './ui/fab.js';
import { createPanel, togglePanel, closePanel, isPanelOpen, type PanelElements } from './ui/panel.js';
import { createAnnotator, type AnnotatorInstance } from './annotator.js';
import { isPopupVisible, hidePopup } from './ui/popup.js';
import { registerShortcuts } from './shortcuts.js';
import { exportToClipboard } from './export.js';
import { showToast } from './ui/toast.js';
import { api } from './api.js';
import { writeCache, readCache } from './cache.js';
import { pulseHighlight, getHighlightMarks } from './highlights.js';

// Idempotency guard
const INIT_FLAG = '__astro_inline_review_init';

declare global {
  interface Window {
    [INIT_FLAG]?: boolean;
  }
}

function init(): void {
  if (window[INIT_FLAG]) return;
  window[INIT_FLAG] = true;

  const shadowRoot = createHost();

  const refreshBadge = async () => {
    try {
      const store = await api.getStore(window.location.pathname);
      writeCache(store);
      const pageCount = store.annotations.filter(
        a => a.pageUrl === window.location.pathname,
      ).length;
      updateBadge(fab.badge, pageCount);
    } catch {
      // Ignore
    }
  };

  // Panel
  const panel: PanelElements = createPanel(shadowRoot, {
    onAnnotationClick: (id) => {
      const marks = getHighlightMarks(id);
      if (marks.length > 0) {
        marks[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        pulseHighlight(id);
      }
    },
    onRefreshBadge: refreshBadge,
  });

  // FAB
  const fab: FabElements = createFab(shadowRoot, () => {
    togglePanel(panel);
  });

  // Annotator — selection, highlights, popup
  const annotator: AnnotatorInstance = createAnnotator({
    shadowRoot,
    badge: fab.badge,
  });

  // Keyboard shortcuts
  registerShortcuts({
    togglePanel: () => togglePanel(panel),
    closeActive: () => {
      // Popup takes precedence over panel
      const popupEl = shadowRoot.querySelector('.air-popup--visible');
      if (popupEl) {
        popupEl.classList.remove('air-popup--visible');
        return;
      }
      if (isPanelOpen(panel)) {
        closePanel(panel);
      }
    },
    exportToClipboard: async () => {
      const store = readCache() ?? await api.getStore();
      const success = await exportToClipboard(store);
      showToast(shadowRoot, success ? 'Copied to clipboard!' : 'Export failed — try again');
    },
    addPageNote: () => {
      // Open panel and trigger the add note form
      if (!isPanelOpen(panel)) {
        togglePanel(panel);
      }
      // Click the add note button
      panel.addNoteBtn.click();
    },
  });

  // Restore highlights for the current page
  annotator.restoreHighlights();

  // Re-restore on Astro page transitions
  document.addEventListener('astro:page-load', () => {
    annotator.restoreHighlights();
  });
}

// Bootstrap on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
