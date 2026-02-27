# Express Inline Review Example

Minimal Express server for manually testing the astro-inline-review Express adapter.

## Setup

```sh
npm install
npm run dev
```

Open http://localhost:3000 in your browser.

## What to test

- **Text annotations**: select any text on the page, then add a note in the popup
- **Element annotations**: Alt+click on any element (e.g. the highlighted paragraph)
- **Panel**: click the floating action button to toggle the annotations panel
- **Persistence**: reload the page and verify annotations survive (stored in `inline-review.json`)
