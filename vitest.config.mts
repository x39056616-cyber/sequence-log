import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    pool: "threads",
    maxWorkers: 1,
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
