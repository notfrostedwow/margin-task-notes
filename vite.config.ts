import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { include: ["src/**/*.test.ts"], environment: "node" },
  server: { host: "127.0.0.1", port: 4183, strictPort: true },
});
