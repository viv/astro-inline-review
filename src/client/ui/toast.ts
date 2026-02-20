/**
 * Toast notification — appears bottom-right above FAB, auto-dismisses.
 */

let toastEl: HTMLDivElement | null = null;
let dismissTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Show a toast message. Auto-dismisses after the given duration.
 */
export function showToast(shadowRoot: ShadowRoot, message: string, durationMs = 2500): void {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.className = 'air-toast';
    shadowRoot.appendChild(toastEl);
  }

  // Clear any pending dismiss
  if (dismissTimeout) {
    clearTimeout(dismissTimeout);
  }

  toastEl.textContent = message;
  toastEl.classList.add('air-toast--visible');

  dismissTimeout = setTimeout(() => {
    toastEl?.classList.remove('air-toast--visible');
  }, durationMs);
}
