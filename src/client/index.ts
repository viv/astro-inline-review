/**
 * Client entry point — bootstraps the inline review overlay.
 *
 * Creates Shadow DOM host, FAB, panel, annotator, keyboard shortcuts,
 * and loads existing annotations. Idempotent — safe to call multiple times.
 */
import { createHost } from './ui/host.js';
import { createFab, updateBadge, resetFab, openFab, type FabElements } from './ui/fab.js';
import { createPanel, togglePanel, closePanel, isPanelOpen, type PanelElements } from './ui/panel.js';
import { createAnnotator, type AnnotatorInstance } from './annotator.js';
import type { ReviewMediator } from './mediator.js';
import { isPopupVisible, hidePopup } from './ui/popup.js';
import { registerShortcuts } from './shortcuts.js';
import { exportToClipboard } from './export.js';
import { showToast } from './ui/toast.js';
import { api } from './api.js';
import { writeCache } from './cache.js';
import { pulseHighlight, getHighlightMarks, pulseElementHighlight, getElementByAnnotationId, removeHighlight, removeElementHighlight } from './highlights.js';
import { createStorePoller } from './store-poller.js';

const SCROLL_TO_KEY = 'air-scroll-to';
const PANEL_STATE_KEY = 'air-panel-state';

/** Scroll to and pulse an annotation highlight on the current page. */
function scrollToAnnotation(id: string): void {
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
}

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
    refreshPanel: async () => {},
    restoreHighlights: async () => {},
  };

  // Panel
  const panel: PanelElements = createPanel(shadowRoot, {
    onAnnotationClick: (id, pageUrl) => {
      // Cross-page navigation: store target and panel state, then navigate
      if (pageUrl !== window.location.pathname) {
        sessionStorage.setItem(SCROLL_TO_KEY, id);
        sessionStorage.setItem(PANEL_STATE_KEY, 'all-pages');
        window.location.href = pageUrl;
        return;
      }

      scrollToAnnotation(id);
    },
    onAnnotationDelete: async (id) => {
      try {
        await api.deleteAnnotation(id);
        removeHighlight(id);
        removeElementHighlight(id);
        await refreshBadge();
        mediator.refreshPanel();
      } catch (err) {
        console.error('[astro-inline-review] Failed to delete annotation:', err);
        showToast(shadowRoot, 'Failed to delete annotation');
      }
    },
    onAnnotationStatusChange: async (id, status) => {
      try {
        await api.updateAnnotation(id, { status } as Partial<import('./types.js').Annotation>);
        await mediator.restoreHighlights();
        await refreshBadge();
        mediator.refreshPanel();
      } catch (err) {
        console.error('[astro-inline-review] Failed to update annotation status:', err);
        showToast(shadowRoot, 'Failed to update status');
      }
    },
    isAnnotationOrphaned: (id, pageUrl) => {
      if (pageUrl !== window.location.pathname) return false;
      const marks = getHighlightMarks(id);
      if (marks.length > 0) return false;
      const element = getElementByAnnotationId(id);
      if (element) return false;
      return true;
    },
    onRefreshBadge: refreshBadge,
    onExport: async () => {
      const store = await api.getStore();
      const success = await exportToClipboard(store);
      showToast(shadowRoot, success ? 'Copied to clipboard!' : 'Export failed — try again');
    },
  }, mediator);

  // FAB
  const fab: FabElements = createFab(shadowRoot, () => {
    const isOpen = togglePanel(panel);
    if (isOpen) {
      // Move focus to first focusable element in panel
      const firstFocusable = panel.container.querySelector<HTMLElement>('button, [tabindex="0"]');
      if (firstFocusable) firstFocusable.focus();
    } else {
      fab.button.focus();
    }
  });

  // First-use tooltip
  const TOOLTIP_KEY = 'air-tooltip-dismissed';
  if (!localStorage.getItem(TOOLTIP_KEY)) {
    const tooltip = document.createElement('div');
    tooltip.className = 'air-tooltip';
    tooltip.setAttribute('data-air-el', 'first-use-tooltip');
    tooltip.id = 'air-tooltip';
    tooltip.setAttribute('role', 'tooltip');
    tooltip.textContent = 'Select text to annotate it, or Alt+click any element';
    fab.button.setAttribute('aria-describedby', 'air-tooltip');
    shadowRoot.appendChild(tooltip);

    let dismissed = false;
    const dismissTooltip = () => {
      if (dismissed) return;
      dismissed = true;
      tooltip.classList.add('air-tooltip--hidden');
      localStorage.setItem(TOOLTIP_KEY, '1');
      fab.button.removeAttribute('aria-describedby');
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
    togglePanel: () => {
      const isOpen = togglePanel(panel);
      if (isOpen) {
        openFab(fab);
      } else {
        resetFab(fab);
      }
    },
    closeActive: () => {
      // Popup takes precedence over panel
      if (isPopupVisible(annotator.popup)) {
        // Don't dismiss if textarea has unsaved content
        if (annotator.popup.textarea.value.trim()) return true;
        hidePopup(annotator.popup);
        return true;
      }
      if (isPanelOpen(panel)) {
        closePanel(panel);
        resetFab(fab);
        fab.button.focus();
        return true;
      }
      return false;
    },
    exportToClipboard: async () => {
      // Always fetch from server — cache only has current page's annotations
      const store = await api.getStore();
      const success = await exportToClipboard(store);
      showToast(shadowRoot, success ? 'Copied to clipboard!' : 'Export failed — try again');
    },
    addPageNote: async () => {
      // Open panel and ensure content is loaded before adding the form.
      // togglePanel fires mediator.refreshPanel() without awaiting it,
      // so the async refresh would wipe the form by clearing children.
      // Instead, open the panel manually and await the refresh.
      if (!isPanelOpen(panel)) {
        panel.container.classList.add('air-panel--open');
        panel.container.setAttribute('data-air-state', 'open');
        await panel.mediator.refreshPanel();
      }
      panel.addNoteBtn.click();
    },
  });

  // Restore panel state after cross-page navigation
  const pendingPanelState = sessionStorage.getItem(PANEL_STATE_KEY);
  if (pendingPanelState) {
    sessionStorage.removeItem(PANEL_STATE_KEY);
    panel.container.classList.add('air-panel--open');
    panel.container.setAttribute('data-air-state', 'open');
    if (pendingPanelState === 'all-pages') {
      panel.allPagesTab.click();
    } else {
      mediator.refreshPanel();
    }
  }

  // Restore highlights for the current page, then handle pending scroll-to
  annotator.restoreHighlights().then(() => {
    const pendingId = sessionStorage.getItem(SCROLL_TO_KEY);
    if (pendingId) {
      sessionStorage.removeItem(SCROLL_TO_KEY);
      scrollToAnnotation(pendingId);
    }
  });

  // Re-restore on Astro page transitions (also handles pending scroll-to)
  document.addEventListener('astro:page-load', () => {
    annotator.restoreHighlights().then(() => {
      const pendingId = sessionStorage.getItem(SCROLL_TO_KEY);
      if (pendingId) {
        sessionStorage.removeItem(SCROLL_TO_KEY);
        scrollToAnnotation(pendingId);
      }
    });
  });

  // Poll for external store changes (e.g. MCP tool updates)
  const poller = createStorePoller({
    onStoreChanged: () => {
      annotator.restoreHighlights();
      mediator.refreshPanel();
    },
  });
  poller.start();
}

// Bootstrap on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
