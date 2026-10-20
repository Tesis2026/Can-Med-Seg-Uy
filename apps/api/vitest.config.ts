import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["./src/test/setupEnv.ts"],
    globalTeardown: ["./src/test/globalTeardown.ts"],
    fileParallelism: false,
    // Un solo worker: el pool de pg y better-auth son singletons.
    maxWorkers: 1,
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
});
