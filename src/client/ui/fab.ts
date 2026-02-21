/** Clipboard/notes icon SVG */
const CLIPBOARD_ICON = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1s-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm7 16H5V5h2v3h10V5h2v14z"/>
</svg>`;

/** Close/plus icon (rotated 45° via CSS to become X) */
const PLUS_ICON = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
</svg>`;

export interface FabElements {
  button: HTMLButtonElement;
  badge: HTMLSpanElement;
}

/**
 * Creates the FAB (Floating Action Button) and appends it to the shadow root.
 * Returns references to the button and badge for external control.
 */
export function createFab(shadowRoot: ShadowRoot, onToggle: () => void): FabElements {
  const button = document.createElement('button');
  button.className = 'air-fab';
  button.setAttribute('aria-label', 'Toggle inline review panel');
  button.setAttribute('title', 'Inline Review');
  button.setAttribute('data-air-el', 'fab');
  button.setAttribute('data-air-state', 'closed');
  button.innerHTML = CLIPBOARD_ICON;

  const badge = document.createElement('span');
  badge.className = 'air-fab__badge air-fab__badge--hidden';
  badge.setAttribute('data-air-el', 'badge');
  badge.textContent = '0';
  button.appendChild(badge);

  button.addEventListener('click', () => {
    const wasOpen = button.getAttribute('data-air-state') === 'open';
    const isOpen = !wasOpen;
    button.innerHTML = isOpen ? PLUS_ICON : CLIPBOARD_ICON;
    button.appendChild(badge); // Re-append badge after innerHTML change
    button.classList.toggle('air-fab--open', isOpen);
    button.setAttribute('data-air-state', isOpen ? 'open' : 'closed');
    onToggle();
  });

  shadowRoot.appendChild(button);

  return { button, badge };
}

/** Reset the FAB to its closed visual state (used when panel is closed externally). */
export function resetFab(fab: FabElements): void {
  fab.button.innerHTML = CLIPBOARD_ICON;
  fab.button.appendChild(fab.badge);
  fab.button.classList.remove('air-fab--open');
  fab.button.setAttribute('data-air-state', 'closed');
}

/** Update the badge count on the FAB */
export function updateBadge(badge: HTMLSpanElement, count: number): void {
  badge.textContent = String(count);
  badge.classList.toggle('air-fab__badge--hidden', count === 0);
}
