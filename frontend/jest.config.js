/**
 * Plain ESM rather than jest.config.ts: a TypeScript Jest config would pull in
 * ts-node purely to read this one file. The JSDoc type still gives editor
 * completion and is checked by `npm run typecheck`.
 *
 * @type {import('jest').Config}
 */
export default {
  // jsdom plus the fetch/AbortController globals it omits - see the file.
  testEnvironment: '<rootDir>/jest.environment.cjs',

  // ts-jest compiles TS/TSX to CommonJS for Jest. Vite never reads this file
  // and Jest never reads vite.config.ts - two pipelines over the same source,
  // which is why the aliases are repeated below.
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },

  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],

  moduleNameMapper: {
    '^@core/(.*)$': '<rootDir>/src/core/$1',
    '^@packages/(.*)$': '<rootDir>/src/packages/$1',
    '^@test/(.*)$': '<rootDir>/src/test/$1',
    // Vite imports these as assets; Jest cannot parse them.
    '\\.(css|svg|png)$': '<rootDir>/src/test/fileMock.ts',
  },

  testMatch: ['<rootDir>/src/**/*.test.{ts,tsx}'],
  clearMocks: true,
  restoreMocks: true,
}
