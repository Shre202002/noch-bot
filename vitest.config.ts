import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  // tsconfig sets jsx: "preserve" (Next compiles JSX with the automatic runtime),
  // so esbuild must be told explicitly or component tests hit "React is not defined".
  esbuild: {
    jsx: "automatic",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    globals: false,
    fileParallelism: false,
    hookTimeout: 120_000,
    testTimeout: 30_000,
    env: {
      // ticketIssuance.ts validates this at import time
      TICKET_QR_SECRET: "vitest-qr-secret",
    },
  },
});
