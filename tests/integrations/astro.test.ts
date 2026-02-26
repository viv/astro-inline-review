import { describe, it, expect } from 'vitest';
import inlineReview from '../../src/integrations/astro.js';

describe('Astro integration adapter', () => {
  it('returns an AstroIntegration-shaped object', () => {
    const integration = inlineReview();
    expect(integration).toHaveProperty('name', 'astro-inline-review');
    expect(integration).toHaveProperty('hooks');
    expect(integration.hooks).toHaveProperty('astro:config:setup');
    expect(typeof integration.hooks['astro:config:setup']).toBe('function');
  });

  it('accepts custom storagePath option', () => {
    const integration = inlineReview({ storagePath: '/tmp/custom.json' });
    expect(integration.name).toBe('astro-inline-review');
  });

  it('is re-exported from the main entry point', async () => {
    const main = await import('../../src/index.js');
    expect(typeof main.default).toBe('function');
    const integration = main.default();
    expect(integration).toHaveProperty('name', 'astro-inline-review');
    expect(integration).toHaveProperty('hooks');
  });
});
