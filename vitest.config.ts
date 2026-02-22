import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['tests/**/*.test.ts'],
    projects: [
      {
        test: {
          name: 'client',
          environment: 'happy-dom',
          include: ['tests/client/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'server',
          environment: 'node',
          include: ['tests/server/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'mcp',
          environment: 'node',
          include: ['tests/mcp/**/*.test.ts'],
        },
      },
    ],
  },
});
