import { expect, test, type Page } from "@playwright/test";

async function openRoom(page: Page) {
  await page.clock.install({ time: new Date("2026-01-01T12:00:00Z") });
  await page.goto("/room");
  await expect(page.getByTestId("status-transit-state")).toHaveText("ACTIVE_TRANSIT");
  await expect(page.locator('[data-testid^="seat-"]')).toHaveCount(9);
}

async function expectCompletion(page: Page) {
  await expect(page.getByTestId("status-transit-state")).toHaveText("DISCONNECTED");
  await expect(page.getByTestId("screen-transit-completion")).toBeVisible();
  await expect(page.getByRole("heading", { name: "You have reached your drop-off destination." })).toBeVisible();
  await expect(page.getByTestId("text-seat-backfilled")).toHaveText(
    "Your seat in this room will now be backfilled by another passenger.",
  );
  await expect(page.locator('[data-testid^="seat-"]')).toHaveCount(0);
  await expect(page.getByTestId("grid-room-seats")).toHaveCount(0);
  await expect(page.getByTestId("modal-traffic-grace")).toHaveCount(0);
}

test("red-light sensor payload starts five-minute grace, counts down, and expires into completion", async ({ page }) => {
  await openRoom(page);

  await page.getByTestId("button-simulate-red-light").click();
  await expect(page.getByTestId("status-transit-state")).toHaveText("GRACE_PERIOD_PENDING");
  await expect(page.getByTestId("modal-traffic-grace")).toBeVisible();
  await expect(page.getByTestId("timer-grace")).toHaveText("05:00");
  await expect(page.getByTestId("grid-room-seats")).toHaveAttribute("aria-hidden", "true");
  await expect(page.getByTestId("grid-room-seats")).toHaveClass(/opacity-40/);
  await expect(page.locator('[data-testid^="seat-"]')).toHaveCount(9);

  await page.clock.runFor(1_000);
  await expect(page.getByTestId("timer-grace")).toHaveText("04:59");
  await page.clock.runFor(299_000);
  await expectCompletion(page);
});

test("speed at and above 15 mph does not pause the active room", async ({ page }) => {
  await openRoom(page);

  for (const testId of ["button-simulate-speed-threshold", "button-simulate-speed-above-threshold"]) {
    await page.getByTestId(testId).click();
    await expect(page.getByTestId("status-transit-state")).toHaveText("ACTIVE_TRANSIT");
    await expect(page.getByTestId("modal-traffic-grace")).toHaveCount(0);
    await expect(page.getByTestId("grid-room-seats")).toHaveAttribute("aria-hidden", "false");
  }

  await page.clock.runFor(300_000);
  await expect(page.getByTestId("status-transit-state")).toHaveText("ACTIVE_TRANSIT");
});

test("repeated red-light samples preserve the first grace deadline", async ({ page }) => {
  await openRoom(page);
  const redLight = page.getByTestId("button-simulate-red-light");
  await redLight.click();
  await page.clock.runFor(61_000);
  await expect(page.getByTestId("timer-grace")).toHaveText("03:59");

  await redLight.click();
  await expect(page.getByTestId("timer-grace")).toHaveText("03:59");
  await page.clock.runFor(238_000);
  await expect(page.getByTestId("timer-grace")).toHaveText("00:01");
  await redLight.click();
  await expect(page.getByTestId("timer-grace")).toHaveText("00:01");
  await page.clock.runFor(1_000);
  await expectCompletion(page);

  // Late slow samples must not bring back a completed room.
  await redLight.click();
  await expectCompletion(page);
});

test("motion resumed cancels grace and restores the undimmed room and timer", async ({ page }) => {
  await openRoom(page);
  await page.getByTestId("button-simulate-red-light").click();
  await page.clock.runFor(61_000);
  await expect(page.getByTestId("timer-grace")).toHaveText("03:59");

  await page.getByTestId("button-simulate-motion-resumed").click();
  await expect(page.getByTestId("status-transit-state")).toHaveText("ACTIVE_TRANSIT");
  await expect(page.getByTestId("modal-traffic-grace")).toHaveCount(0);
  await expect(page.getByTestId("grid-room-seats")).toHaveAttribute("aria-hidden", "false");
  await expect(page.getByTestId("grid-room-seats")).toHaveClass(/opacity-100/);
  await page.clock.runFor(300_000);
  await expect(page.getByTestId("status-transit-state")).toHaveText("ACTIVE_TRANSIT");

  await page.getByTestId("button-simulate-red-light").click();
  await expect(page.getByTestId("timer-grace")).toHaveText("05:00");
});

test("manual ride-end payload disconnects immediately and removes every seat", async ({ page }) => {
  await openRoom(page);
  await page.getByTestId("button-simulate-red-light").click();
  await expect(page.getByTestId("modal-traffic-grace")).toBeVisible();
  await page.getByTestId("button-simulate-ride-end").click();
  await expectCompletion(page);
});

test("Next remains reachable on a short mobile screen and opens matchmaking", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 480 });
  await openRoom(page);
  const next = page.getByTestId("button-next-room");
  await next.scrollIntoViewIfNeeded();
  await expect(next).toBeInViewport();
  await page.getByTestId("button-simulate-red-light").click();
  await expect(page.getByTestId("modal-traffic-grace")).toBeVisible();
  await next.scrollIntoViewIfNeeded();
  await expect(next).toBeInViewport();
  await next.click();
  await expect(page).toHaveURL(/\/match$/);
  await expect(page.getByRole("heading", { name: "Matching next room..." })).toBeVisible();
});