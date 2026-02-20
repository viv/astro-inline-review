/**
 * Client entry point — bootstraps the inline review overlay.
 *
 * This file is the entry point for the injected client script.
 * It creates the Shadow DOM host, FAB, and loads existing annotations.
 *
 * Idempotent — safe to call multiple times (e.g. on Astro page transitions).
 */
import { createHost } from './ui/host.js';
import { createFab, updateBadge, type FabElements } from './ui/fab.js';
import { api } from './api.js';
import { writeCache, readCache } from './cache.js';

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
  let panelOpen = false;

  const fab: FabElements = createFab(shadowRoot, () => {
    panelOpen = !panelOpen;
    // Panel toggle will be wired in Session 3
    // For now, just toggle state for the FAB icon
  });

  // Load initial data and update badge
  loadAndUpdateBadge(fab);

  // Re-check on Astro page transitions (View Transitions API)
  document.addEventListener('astro:page-load', () => {
    loadAndUpdateBadge(fab);
  });
}

async function loadAndUpdateBadge(fab: FabElements): Promise<void> {
  try {
    const store = await api.getStore(window.location.pathname);
    writeCache(store);
    const pageCount = store.annotations.filter(
      a => a.pageUrl === window.location.pathname
    ).length;
    updateBadge(fab.badge, pageCount);
  } catch {
    // API unavailable — try cache
    const cached = readCache();
    if (cached) {
      const pageCount = cached.annotations.filter(
        a => a.pageUrl === window.location.pathname
      ).length;
      updateBadge(fab.badge, pageCount);
    }
  }
}

// Bootstrap on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
