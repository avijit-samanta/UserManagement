import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./src/test-setup.ts'],
    // The repository test files share one live Postgres `test` schema (see
    // test-setup.ts) rather than each getting its own temp file the way
    // the old JSON-file version did — Vitest's default of running test
    // *files* in parallel would let one file's truncateTestTables()
    // beforeEach wipe rows another file just created mid-test. Forcing
    // sequential file execution avoids that; tests within a file were
    // already sequential (no test.concurrent usage).
    fileParallelism: false,
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts'],
    },
  },
});
