/**
 * Selection annotation popup.
 *
 * Appears near text selection with a textarea for notes.
 * Supports create mode (save/cancel) and edit mode (save/cancel/delete).
 */

export interface PopupCallbacks {
  onSave: (note: string) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

export interface PopupElements {
  container: HTMLDivElement;
  textarea: HTMLTextAreaElement;
  selectedTextPreview: HTMLDivElement;
}

const MAX_PREVIEW_LENGTH = 100;

/**
 * Create the popup container and append to the shadow root.
 * The popup starts hidden — call showPopup() to display it.
 */
export function createPopup(shadowRoot: ShadowRoot): PopupElements {
  const container = document.createElement('div');
  container.className = 'air-popup';

  const selectedTextPreview = document.createElement('div');
  selectedTextPreview.className = 'air-popup__selected';
  container.appendChild(selectedTextPreview);

  const textarea = document.createElement('textarea');
  textarea.className = 'air-popup__textarea';
  textarea.placeholder = 'Add a note (optional)…';
  container.appendChild(textarea);

  const footer = document.createElement('div');
  footer.className = 'air-popup__footer';
  container.appendChild(footer);

  shadowRoot.appendChild(container);

  return { container, textarea, selectedTextPreview };
}

/**
 * Show the popup near a selection rect in create mode.
 */
export function showPopup(
  popup: PopupElements,
  selectedText: string,
  rect: DOMRect,
  callbacks: PopupCallbacks,
): void {
  const { container, textarea, selectedTextPreview } = popup;

  // Set preview text
  const truncated = selectedText.length > MAX_PREVIEW_LENGTH
    ? `"${selectedText.slice(0, MAX_PREVIEW_LENGTH)}…"`
    : `"${selectedText}"`;
  selectedTextPreview.textContent = truncated;

  // Position near the selection
  positionPopup(container, rect);

  // Clear and set up textarea
  textarea.value = '';

  // Rebuild footer buttons
  rebuildFooter(container, textarea, callbacks);

  // Show
  container.classList.add('air-popup--visible');

  // Focus textarea after a tick (let the popup render first)
  requestAnimationFrame(() => textarea.focus());
}

/**
 * Show the popup in edit mode with existing note pre-filled.
 */
export function showEditPopup(
  popup: PopupElements,
  selectedText: string,
  existingNote: string,
  rect: DOMRect,
  callbacks: PopupCallbacks,
): void {
  const { container, textarea, selectedTextPreview } = popup;

  // Set preview text
  const truncated = selectedText.length > MAX_PREVIEW_LENGTH
    ? `"${selectedText.slice(0, MAX_PREVIEW_LENGTH)}…"`
    : `"${selectedText}"`;
  selectedTextPreview.textContent = truncated;

  // Position
  positionPopup(container, rect);

  // Pre-fill textarea
  textarea.value = existingNote;

  // Rebuild footer with delete button
  rebuildFooter(container, textarea, callbacks);

  // Show
  container.classList.add('air-popup--visible');
  requestAnimationFrame(() => textarea.focus());
}

/**
 * Hide the popup.
 */
export function hidePopup(popup: PopupElements): void {
  popup.container.classList.remove('air-popup--visible');
  popup.textarea.value = '';
}

/**
 * Check if the popup is currently visible.
 */
export function isPopupVisible(popup: PopupElements): boolean {
  return popup.container.classList.contains('air-popup--visible');
}

// --- Helpers ---

function positionPopup(container: HTMLElement, rect: DOMRect): void {
  const POPUP_WIDTH = 300;
  const MARGIN = 8;

  // Try to position above the selection
  let top = rect.top - MARGIN;
  let left = rect.left + (rect.width / 2) - (POPUP_WIDTH / 2);

  // Keep within viewport
  left = Math.max(MARGIN, Math.min(left, window.innerWidth - POPUP_WIDTH - MARGIN));

  // If there's no room above, position below
  if (top < MARGIN + 200) {
    top = rect.bottom + MARGIN;
  }

  container.style.top = `${top}px`;
  container.style.left = `${left}px`;

  // Reset any transform the popup might position itself after content renders
  container.style.transform = top < rect.top ? 'translateY(-100%)' : '';
}

function rebuildFooter(
  container: HTMLElement,
  textarea: HTMLTextAreaElement,
  callbacks: PopupCallbacks,
): void {
  const footer = container.querySelector('.air-popup__footer')!;
  footer.innerHTML = '';

  // Delete button (only in edit mode)
  if (callbacks.onDelete) {
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'air-popup__btn air-popup__btn--delete';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', () => callbacks.onDelete!());
    footer.appendChild(deleteBtn);
  }

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'air-popup__btn air-popup__btn--cancel';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => callbacks.onCancel());
  footer.appendChild(cancelBtn);

  const saveBtn = document.createElement('button');
  saveBtn.className = 'air-popup__btn air-popup__btn--save';
  saveBtn.textContent = 'Save';
  saveBtn.addEventListener('click', () => callbacks.onSave(textarea.value));
  footer.appendChild(saveBtn);
}
