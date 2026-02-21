/** Pencil/annotation icon SVG */
const PENCIL_ICON = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
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
  button.innerHTML = PENCIL_ICON;

  const badge = document.createElement('span');
  badge.className = 'air-fab__badge air-fab__badge--hidden';
  badge.setAttribute('data-air-el', 'badge');
  badge.textContent = '0';
  button.appendChild(badge);

  let isOpen = false;

  button.addEventListener('click', () => {
    isOpen = !isOpen;
    button.innerHTML = isOpen ? PLUS_ICON : PENCIL_ICON;
    button.appendChild(badge); // Re-append badge after innerHTML change
    button.classList.toggle('air-fab--open', isOpen);
    button.setAttribute('data-air-state', isOpen ? 'open' : 'closed');
    onToggle();
  });

  shadowRoot.appendChild(button);

  return { button, badge };
}

/** Update the badge count on the FAB */
export function updateBadge(badge: HTMLSpanElement, count: number): void {
  badge.textContent = String(count);
  badge.classList.toggle('air-fab__badge--hidden', count === 0);
}
