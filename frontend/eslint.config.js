import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

/**
 * Architecture boundaries.
 *
 * Three layers, and dependencies only ever point one way:
 *
 *   main      -> may import anything (it wires the app together)
 *   packages  -> may import core only
 *   core      -> may import nothing above it
 *
 * Enforced with the built-in `no-restricted-imports` rather than
 * eslint-plugin-boundaries or eslint-plugin-import, so this adds no
 * dependency. The trade-off is that the rules are expressed as glob patterns
 * per directory instead of declaratively; with three layers that is a fair
 * price. Swap in a plugin if the layer count grows.
 */
const featureBoundaries = [
  {
    // A feature may not reach into another feature. If two features need the
    // same thing, it belongs in core - or, if it is layout, in main.
    files: ['src/packages/monitoring/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/packages/jogging', '**/packages/jogging/**', '../jogging', '../jogging/**'],
              message:
                'Features must not import each other. Move the shared code into core, or lift shared layout into main.',
            },
            {
              group: ['**/main/**', '../../main', '../../main/**'],
              message: 'Features must not import from main. Move the shared value into core.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/packages/jogging/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/packages/monitoring',
                '**/packages/monitoring/**',
                '../monitoring',
                '../monitoring/**',
              ],
              message:
                'Features must not import each other. Move the shared code into core, or lift shared layout into main.',
            },
            {
              group: ['**/main/**', '../../main', '../../main/**'],
              message: 'Features must not import from main. Move the shared value into core.',
            },
          ],
        },
      ],
    },
  },
  {
    // core is the bottom layer: it must not know that features or the app
    // shell exist, or it stops being reusable and starts being a cycle.
    files: ['src/core/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/packages/**', '../../packages/**', '**/main/**', '../../main/**'],
              message: 'core is the lowest layer and must not import from packages or main.',
            },
          ],
        },
      ],
    },
  },
]

export default defineConfig([
  globalIgnores(['dist', 'coverage']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    // Config files run in Node.
    files: ['*.config.{js,ts}', 'jest.setup.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    // Tests and test helpers are never hot-reloaded in the browser, so the
    // fast-refresh rule (one component export per file) does not apply.
    files: ['**/*.test.{ts,tsx}', 'src/test/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.jest } },
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  ...featureBoundaries,
])
