/**
 * Keyboard shortcut registration.
 *
 * Shortcuts:
 * - Cmd/Ctrl + Shift + .   → Toggle panel
 * - Escape                  → Close panel / dismiss popup
 * - Cmd/Ctrl + Shift + E   → Export to clipboard
 * - Cmd/Ctrl + Shift + N   → Add page note
 *
 * Escape uses capture phase to take precedence over site handlers,
 * but only stops propagation when we actually handle it (panel/popup open).
 *
 * All shortcuts except Escape are suppressed when focus is in an input or textarea.
 */

export interface ShortcutHandlers {
  togglePanel: () => void;
  closeActive: () => void;
  exportToClipboard: () => void;
  addPageNote: () => void;
}

let activeHandler: ((e: KeyboardEvent) => void) | null = null;

export function registerShortcuts(handlers: ShortcutHandlers): void {
  if (activeHandler) {
    unregisterShortcuts();
  }

  activeHandler = (e: KeyboardEvent) => {
    const isModified = e.metaKey || e.ctrlKey;
    const isInInput = isInputFocused();

    // Escape — always fire (even in inputs), but only on capture phase
    if (e.key === 'Escape') {
      handlers.closeActive();
      return;
    }

    // All other shortcuts require modifier and no input focus
    if (!isModified || !e.shiftKey || isInInput) return;

    switch (e.key) {
      case '.':
      case '>': // Shift+. produces > on some layouts
        e.preventDefault();
        handlers.togglePanel();
        break;

      case 'E':
      case 'e':
        e.preventDefault();
        handlers.exportToClipboard();
        break;

      case 'N':
      case 'n':
        e.preventDefault();
        handlers.addPageNote();
        break;
    }
  };

  // Use capture phase for Escape precedence
  document.addEventListener('keydown', activeHandler, true);
}

export function unregisterShortcuts(): void {
  if (activeHandler) {
    document.removeEventListener('keydown', activeHandler, true);
    activeHandler = null;
  }
}

function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || (el as HTMLElement).isContentEditable;
}
