import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['src/**/*.spec.ts'] },
  resolve: {
    alias: [
      // `.ts` source uses `./foo.js` imports (TypeScript compile target).
      // Vitest runs against source, so rewrite `.js` → `.ts` at resolve.
      {
        find: /^(\.{1,2}\/.+)\.js$/,
        replacement: '$1.ts',
      },
    ],
  },
});
