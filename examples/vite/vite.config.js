import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import inlineReview from 'review-loop/vite';

export default defineConfig({
  plugins: [inlineReview()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        about: resolve(__dirname, 'about.html'),
      },
    },
  },
});
