const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "tests",
  timeout: 30000,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: "http://localhost:8123",
    viewport: { width: 1280, height: 720 },
  },
  webServer: {
    command: "node tests/static-server.mjs",
    port: 8123,
    reuseExistingServer: true,
    timeout: 15000,
  },
});
