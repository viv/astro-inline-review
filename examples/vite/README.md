# Vite Example

Minimal Vite project for manually testing the review-loop Vite plugin.

## Setup

```sh
npm install
npm run dev
```

## What to Test

- **Text selection**: Select text on the page to create text annotations.
- **Alt+click**: Hold Alt (Option on macOS) and click any element to create element annotations.
- **Panel toggle**: Press `Ctrl+Shift+R` (or `Cmd+Shift+R` on macOS) to open/close the annotations panel.
- **Keyboard shortcuts**: Verify the FAB, panel, and popup respond to keyboard interaction.
- **Persistence**: Annotations are saved to `inline-review.json` in this directory. Reload the page and verify they reappear.
