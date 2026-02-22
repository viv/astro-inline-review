import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { parseStoragePath } from '../../src/mcp/server.js';

describe('parseStoragePath', () => {
  it('defaults to ./inline-review.json when no --storage flag', () => {
    const result = parseStoragePath(['node', 'server.js']);
    expect(result).toBe(resolve(process.cwd(), './inline-review.json'));
  });

  it('resolves a relative path from --storage', () => {
    const result = parseStoragePath(['node', 'server.js', '--storage', './data/reviews.json']);
    expect(result).toBe(resolve(process.cwd(), './data/reviews.json'));
  });

  it('preserves an absolute path from --storage', () => {
    const result = parseStoragePath(['node', 'server.js', '--storage', '/tmp/reviews.json']);
    expect(result).toBe('/tmp/reviews.json');
  });

  it('ignores --storage when no value follows', () => {
    const result = parseStoragePath(['node', 'server.js', '--storage']);
    expect(result).toBe(resolve(process.cwd(), './inline-review.json'));
  });

  it('handles --storage at various positions in argv', () => {
    const result = parseStoragePath(['node', 'server.js', '--verbose', '--storage', './custom.json', '--debug']);
    expect(result).toBe(resolve(process.cwd(), './custom.json'));
  });
});
