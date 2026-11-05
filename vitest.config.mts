import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // Load .env (DATABASE_URL, AUTH_SECRET) before any test module imports
    // src/server/db, which requires them. DATABASE_URL is the dev database
    // for MVP-task tests; a dedicated test database arrives with Phase 8.
    setupFiles: ["dotenv/config"],
    environment: "node",
    testTimeout: 30000,
    hookTimeout: 30000,
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/domain/**/*.ts"],
    },
  },
});
