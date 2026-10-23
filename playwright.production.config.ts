import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/production",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:3101",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    },
  },
  webServer: {
    command: "npm start -- --port 3101",
    url: "http://127.0.0.1:3101",
    reuseExistingServer: false,
    env: {
      NODE_ENV: "production",
      DEV_AUTH_ENABLED: "true",
      DEV_AUTH_SECRET:
        "production-test-secret-never-use-for-real-authentication",
    },
  },
});
