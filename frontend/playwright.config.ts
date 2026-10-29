import { defineConfig, devices } from "@playwright/test";
import { execSync } from "child_process";

function getBackendUrl(): string {
  if (process.env.VITE_BACKEND_URL) return process.env.VITE_BACKEND_URL;
  try {
    const ip = execSync("wsl hostname -I", { encoding: "utf8" }).trim().split(/\s+/)[0];
    if (ip && /^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
      return `http://${ip}:8000`;
    }
  } catch {
    // ignore WSL check failure
  }
  return "http://127.0.0.1:8000";
}

const backendUrl = getBackendUrl();

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || "http://127.0.0.1:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "Desktop Chrome",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5173",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: true,
    timeout: 30000,
    env: {
      VITE_BACKEND_URL: backendUrl,
    },
  },
});
