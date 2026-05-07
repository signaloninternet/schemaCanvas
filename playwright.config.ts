import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3005",
    channel: "chrome",
    trace: "on-first-retry"
  },
  webServer: {
    command: "pnpm --filter @schemacanvas/web dev --port 3005",
    port: 3005,
    reuseExistingServer: true,
    timeout: 120000
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
