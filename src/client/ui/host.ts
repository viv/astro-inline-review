import { getAllStyles } from '../styles.js';

const HOST_ID = 'astro-inline-review-host';

/**
 * Creates the Shadow DOM host element and attaches an open shadow root.
 * Returns the shadow root for other UI components to append into.
 *
 * Idempotent — returns the existing shadow root if already created.
 */
export function createHost(): ShadowRoot {
  const existing = document.getElementById(HOST_ID);
  if (existing?.shadowRoot) {
    return existing.shadowRoot;
  }

  const host = document.createElement('div');
  host.id = HOST_ID;
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });

  // Inject all styles
  const style = document.createElement('style');
  style.textContent = getAllStyles();
  shadow.appendChild(style);

  return shadow;
}

/** Get the host element ID (for external reference) */
export const HOST_ELEMENT_ID = HOST_ID;
