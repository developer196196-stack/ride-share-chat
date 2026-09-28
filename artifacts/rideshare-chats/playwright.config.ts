import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

const port = 4174;
const baseURL = `http://127.0.0.1:${port}`;
const chromiumPath = process.env.CHROMIUM_PATH ??
  (existsSync("/repl/tools/bin/chromium") ? "/repl/tools/bin/chromium" : undefined);

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    browserName: "chromium",
    launchOptions: chromiumPath ? { executablePath: chromiumPath } : undefined,
  },
  webServer: {
    command: `pnpm run dev`,
    cwd: import.meta.dirname,
    env: { PORT: String(port), BASE_PATH: "/" },
    url: `${baseURL}/room`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});