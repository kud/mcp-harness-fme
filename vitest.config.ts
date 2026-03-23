import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    setupFiles: ["./src/__tests__/setup.ts"],
    exclude: ["dist/**", "node_modules/**"],
  },
})
