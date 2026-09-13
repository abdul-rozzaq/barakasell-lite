import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // All e2e specs share one Postgres instance and some assertions (verify)
    // scan the whole table — running files in parallel causes cross-file
    // interference, so force them serial.
    fileParallelism: false,
    // Ensures the fixed admin/cashier fixtures every spec logs in as exist
    // before any test runs — see prisma/seed.e2e.ts.
    globalSetup: ['./prisma/seed.e2e.ts'],
  },
});
