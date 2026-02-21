/**
 * Client entry point — bootstraps the inline review overlay.
 *
 * Creates Shadow DOM host, FAB, panel, annotator, keyboard shortcuts,
 * and loads existing annotations. Idempotent — safe to call multiple times.
 */
import { createHost } from './ui/host.js';
import { createFab, updateBadge, resetFab, type FabElements } from './ui/fab.js';
import { createPanel, togglePanel, closePanel, isPanelOpen, type PanelElements } from './ui/panel.js';
import { createAnnotator, type AnnotatorInstance } from './annotator.js';
import type { ReviewMediator } from './mediator.js';
import { isPopupVisible, hidePopup } from './ui/popup.js';
import { registerShortcuts } from './shortcuts.js';
import { exportToClipboard } from './export.js';
import { showToast } from './ui/toast.js';
import { api } from './api.js';
import { writeCache, readCache } from './cache.js';
import { pulseHighlight, getHighlightMarks, pulseElementHighlight, getElementByAnnotationId } from './highlights.js';

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

  // Typed mediator — createPanel and createAnnotator wire up their
  // implementations; stubs here are replaced before first use.
  const mediator: ReviewMediator = {
    refreshPanel: () => {},
    restoreHighlights: async () => {},
  };

  // Panel
  const panel: PanelElements = createPanel(shadowRoot, {
    onAnnotationClick: (id) => {
      // Try text highlight first
      const marks = getHighlightMarks(id);
      if (marks.length > 0) {
        marks[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        pulseHighlight(id);
        return;
      }
      // Try element highlight
      const element = getElementByAnnotationId(id);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        pulseElementHighlight(id);
      }
    },
    onRefreshBadge: refreshBadge,
  }, mediator);

  // FAB
  const fab: FabElements = createFab(shadowRoot, () => {
    togglePanel(panel);
  });

  // First-use tooltip
  const TOOLTIP_KEY = 'air-tooltip-dismissed';
  if (!localStorage.getItem(TOOLTIP_KEY)) {
    const tooltip = document.createElement('div');
    tooltip.className = 'air-tooltip';
    tooltip.setAttribute('data-air-el', 'first-use-tooltip');
    tooltip.textContent = 'Select text to annotate it, or Alt+click any element';
    shadowRoot.appendChild(tooltip);

    let dismissed = false;
    const dismissTooltip = () => {
      if (dismissed) return;
      dismissed = true;
      tooltip.classList.add('air-tooltip--hidden');
      localStorage.setItem(TOOLTIP_KEY, '1');
      // Remove from DOM after fade-out transition
      setTimeout(() => tooltip.remove(), 300);
    };

    // Auto-dismiss after 8 seconds
    setTimeout(dismissTooltip, 8000);

    // Dismiss on click anywhere
    document.addEventListener('click', dismissTooltip, { once: true });
    shadowRoot.addEventListener('click', dismissTooltip, { once: true });
  }

  // Annotator — selection, highlights, popup
  const annotator: AnnotatorInstance = createAnnotator({
    shadowRoot,
    badge: fab.badge,
    mediator,
  });

  // Keyboard shortcuts
  registerShortcuts({
    togglePanel: () => togglePanel(panel),
    closeActive: () => {
      // Popup takes precedence over panel
      if (isPopupVisible(annotator.popup)) {
        hidePopup(annotator.popup);
        return;
      }
      if (isPanelOpen(panel)) {
        closePanel(panel);
        resetFab(fab);
      }
    },
    exportToClipboard: async () => {
      // Always fetch from server — cache only has current page's annotations
      const store = await api.getStore();
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
