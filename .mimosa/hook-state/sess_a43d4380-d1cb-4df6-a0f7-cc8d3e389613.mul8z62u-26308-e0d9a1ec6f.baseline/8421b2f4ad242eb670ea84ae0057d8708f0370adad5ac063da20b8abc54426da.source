const { defineConfig } = require("@playwright/test");

// 端口用 TEST_PORT 覆盖；默认 8931，避开本机常驻服务的 8123
const PORT = Number(process.env.TEST_PORT) || 8931;

module.exports = defineConfig({
  testDir: "tests",
  timeout: 30000,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1280, height: 720 },
  },
  webServer: {
    command: "node tests/static-server.mjs",
    port: PORT,
    env: { TEST_PORT: String(PORT) },
    reuseExistingServer: !process.env.CI,
    timeout: 15000,
  },
});
