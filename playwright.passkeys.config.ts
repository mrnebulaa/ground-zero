import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/passkeys",
  workers: 1,
  expect: { timeout: 15000 },
  timeout: 90000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://localhost:3102",
    // Synthetic proxy headers; this test server remains loopback-only.
    extraHTTPHeaders: { "x-gz-client-ip": "192.0.2.1" },
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    },
  },
  webServer: {
    command: "npm run dev -- --port 3102",
    url: "http://localhost:3102",
    timeout: 120000,
    reuseExistingServer: false,
    env: {
      AUTH_ORIGIN: "http://localhost:3102",
      AUTH_RP_ID: "localhost",
      AUTH_REGISTRATION_ENABLED: "true",
      RECOVERY_CODE_KEY: "ab".repeat(32),
      DEV_AUTH_ENABLED: "false",
      AUTH_TRUST_PROXY: "true",
    },
  },
});
