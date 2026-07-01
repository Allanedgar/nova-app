// NOVA-app ESLint 9 flat config — per docs/03_ENGINEERING_PRINCIPLES.md and docs/BOUNDARY_RULES.md.

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import boundaries from 'eslint-plugin-boundaries';

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,js,mjs}'],
    plugins: { boundaries },
    settings: {
      'boundaries/elements': [
        { type: 'app', pattern: 'apps/*' },
        { type: 'package', pattern: 'packages/*', mode: 'folder' },
        { type: 'service', pattern: 'services/*', mode: 'folder' },
        { type: 'connector', pattern: 'connectors/*', mode: 'folder' },
        { type: 'tool', pattern: 'tools/*', mode: 'folder' },
        { type: 'docs', pattern: 'docs/**' },
        { type: 'evidence', pattern: 'data/evidence/**' },
      ],
    },
    rules: {
      // See docs/BOUNDARY_RULES.md for rationale of each rule.
      'boundaries/dependencies': [
        'error',
        {
          default: 'allow',
          rules: [
            // Rule 1: packages/* may NOT import from apps/* (reverse forbidden)
            { from: ['package'], disallow: ['app'] },
            // Rule 2: packages/engine stays pure — no I/O packages
            {
              from: ['packages/engine'],
              allow: ['packages/shared'],
              disallow: [
                'packages/connectors',
                'packages/persistence',
                'packages/cache',
                'packages/risk',
                'packages/alerts',
                'packages/execution',
              ],
            },
            // Rule 3: packages/shared stays at the bottom — no other @nova-app/* packages
            { from: ['packages/shared'], disallow: ['package'] },
            // Rule 4: connectors/* may NOT import from apps/* or services/*
            { from: ['connector'], disallow: ['app', 'service'] },
            // Rule 5: services/* may import packages + connectors, not apps
            { from: ['service'], disallow: ['app'] },
          ],
        },
      ],
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    // data/evidence/* is documentation/evidence — skip strict TS rules
    files: ['data/**/*.ts', 'data/**/*.mjs'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  {
    ignores: ['node_modules/**', '**/dist/**', '**/coverage/**', 'pnpm-lock.yaml'],
  },
];
