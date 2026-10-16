import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["json", { outputFile: "test-results/results.json" }]],
  use: {
    baseURL: "http://127.0.0.1:4183",
    browserName: "chromium",
    channel: process.env.MARGIN_BROWSER_CHANNEL || undefined,
    headless: true,
    trace: "off",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: {
        viewport: { width: 1440, height: 900 },
        timezoneId: "America/Los_Angeles",
      },
    },
    {
      name: "mobile",
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        timezoneId: "Pacific/Auckland",
      },
    },
  ],
  webServer: {
    command: "npm run preview",
    url: "http://127.0.0.1:4183",
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
