import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['reflect-metadata'],
    // The integration tests share one database, and some check global facts (e.g. "this is
    // the only admin"). Running files one at a time stops one file's data changing another's
    // result mid-test.
    fileParallelism: false,
  },
});
