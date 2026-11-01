import { test, expect } from "@playwright/test";

test("arrival keeps its destination aligned and readable across phone, tablet and desktop sizes", async ({
  page,
}, info) => {
  test.setTimeout(90_000);
  test.skip(
    info.project.name !== "desktop-chromium",
    "The viewport matrix runs once; engine coverage is separate.",
  );
  await page.emulateMedia({ reducedMotion: "no-preference" });
  for (const [width, height] of [
    [320, 568],
    [375, 667],
    [390, 700],
    [390, 844],
    [430, 932],
    [760, 844],
    [844, 390],
    [1024, 768],
    [1440, 900],
  ]) {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/player", async (route) => {
      await gate;
      await route.fulfill({
        json: { player: null, aiReady: true, demoOnly: true },
      });
    });
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await page.getByRole("button", { name: "Mulai", exact: true }).click();
    const scene = page.locator(".entry-journey .bali-journey");
    await expect(scene).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Menuju Desa Kenderan", exact: true }),
    ).toHaveCount(1);
    await expect
      .poll(() =>
        scene
          .locator(".bali-journey__traveler")
          .getAttribute("cx")
          .then(Number),
      )
      .toBeCloseTo(514.43, 1);
    await page.evaluate(() => document.fonts.ready);
    const geometry = await scene.evaluate((el) => {
      const map = el.querySelector<HTMLElement>(".bali-journey__map")!;
      const image = map.querySelector<HTMLImageElement>("img")!;
      const pin = map.querySelector<HTMLElement>(".bali-journey__pin")!;
      const bounds = [
        ".bali-journey__topline",
        "h1",
        ".bali-journey__pin",
        ".bali-journey__status",
      ].map((selector) => {
        const rect = el.querySelector(selector)!.getBoundingClientRect();
        return {
          selector,
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
        };
      });
      return {
        bounds,
        mapRatio: map.offsetWidth / map.offsetHeight,
        pinX: pin.offsetLeft / map.offsetWidth,
        pinY: pin.offsetTop / map.offsetHeight,
        imageReady: image.complete && image.naturalWidth > 0,
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
      };
    });
    expect(geometry.imageReady).toBe(true);
    expect(geometry.overflow, `${width}×${height} horizontal overflow`).toBe(
      false,
    );
    expect(geometry.mapRatio, `${width}×${height} undistorted map`).toBeCloseTo(
      800 / 560,
      1,
    );
    expect(geometry.pinX).toBeCloseTo(514.43 / 800, 2);
    expect(geometry.pinY).toBeCloseTo(278.11 / 560, 2);
    for (const rect of geometry.bounds) {
      expect(
        rect.left,
        `${width}×${height} ${rect.selector} left`,
      ).toBeGreaterThanOrEqual(0);
      expect(
        rect.right,
        `${width}×${height} ${rect.selector} right`,
      ).toBeLessThanOrEqual(width);
      expect(
        rect.top,
        `${width}×${height} ${rect.selector} top`,
      ).toBeGreaterThanOrEqual(0);
      expect(
        rect.bottom,
        `${width}×${height} ${rect.selector} bottom`,
      ).toBeLessThanOrEqual(height);
    }
    await page.screenshot({
      path: info.outputPath(`arrival-${width}x${height}.png`),
      animations: "disabled",
    });
    release();
    await expect(page.locator(".entry-journey")).toHaveCount(0);
    await expect(
      page.getByLabel("Nama panggilan", { exact: true }),
    ).toBeFocused();
    await page.unroute("**/api/player");
  }
});

test("the English arrival respects reduced motion and hands focus to the name form", async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/player", async (route) => {
    await gate;
    await route.fulfill({
      json: { player: null, aiReady: true, demoOnly: true },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Switch to English" }).click();
  await page.getByRole("button", { name: "Begin", exact: true }).click();
  const scene = page.locator(".entry-journey .bali-journey");
  await expect(
    scene.getByRole("heading", { name: "On our way to Kenderan", exact: true }),
  ).toBeVisible();
  await expect(scene.locator(".bali-journey__map")).toHaveCSS(
    "transform",
    "none",
  );
  await expect(scene.locator(".bali-journey__traveler")).toBeHidden();
  await expect(scene.locator(".bali-journey__aurora")).toBeHidden();
  await expect(
    scene.getByText("Getting the village ready…", { exact: true }),
  ).toBeVisible();
  release();
  await expect(page.locator(".entry-journey")).toHaveCount(0);
  await expect(page.getByLabel("Your name", { exact: true })).toBeFocused();
});
