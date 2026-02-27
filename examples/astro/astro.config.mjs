import { defineConfig } from 'astro/config';
import inlineReview from 'astro-inline-review';

export default defineConfig({
  integrations: [inlineReview()],
});
