import { test, expect } from "@playwright/test";

test("welcome explains the game, transitions into the village, and refresh stays in the app", async ({
  page,
}, info) => {
  await page.route("**/api/**", (r) =>
    r.fulfill({ json: { player: null, aiReady: true } }),
  );
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Dari Tamiu jadi Nyama." }),
  ).toBeVisible();
  await expect(
    page.getByText("Belajar Basa Bali lewat percakapan.", { exact: false }),
  ).toBeVisible();
  await expect(page.locator(".welcome__guide li")).toHaveCount(3);
  const image = page.locator(".welcome__picture img");
  await expect(image).toBeVisible();
  expect(
    await image.evaluate(
      (el: HTMLImageElement) => el.complete && el.naturalWidth > 0,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("region", { name: "Peta interaktif Desa Kenderan" }),
  ).toHaveCount(0);
  await page.screenshot({
    path: info.outputPath("welcome.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Mulai", exact: true }).click();
  await expect(page.locator(".entry-journey")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Menuju Desa Kenderan", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/desa$/);
  await expect(
    page
      .getByRole("heading", { name: /^(Ayo latihan\s*Basa Bali\.|Tamiu)$/ })
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Dari Tamiu jadi Nyama." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Mulai", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Mulai", exact: true }).click();
  await expect(page).toHaveURL(/\/desa$/);
  await expect(page.locator(".entry-journey")).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("button", { name: "Mulai", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Mulai", exact: true }).click();
  await expect(page).toHaveURL(/\/desa$/);
  await page.reload();
  await expect(
    page
      .getByRole("heading", { name: /^(Ayo latihan\s*Basa Bali\.|Tamiu)$/ })
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
});

test("welcome supports English, keyboard entry and reduced motion", async ({
  page,
}) => {
  await page.route("**/api/**", (r) =>
    r.fulfill({ json: { player: null, aiReady: true } }),
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Switch to English" }).click();
  await expect(
    page.getByRole("heading", { name: "How to play", exact: true }),
  ).toBeVisible();
  expect(
    await page
      .locator(".welcome__picture")
      .evaluate((el) => getComputedStyle(el).transform),
  ).toBe("none");
  await page.getByRole("button", { name: "Begin", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/desa$/);
  await expect(
    page
      .getByRole("heading", { name: /^(Let’s practise\s*Balinese\.|Tamiu)$/ })
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
});

test("welcome fits one screen, including all three steps and the footer", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop-chromium",
    "Explicit viewport matrix runs once.",
  );
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
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "Mulai", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth + 1,
      ),
    ).toBe(true);
    const geometry = await page.evaluate(() => {
      const main = document.querySelector(".welcome__main")!,
        footer = document.querySelector(".welcome__footer")!;
      return {
        document: document.documentElement.scrollHeight,
        mainScroll: main.scrollHeight,
        mainClient: main.clientHeight,
        footer: footer.getBoundingClientRect().bottom,
      };
    });
    expect(geometry.document, `${width}×${height}`).toBeLessThanOrEqual(
      height + 1,
    );
    expect(geometry.mainScroll, `${width}×${height}`).toBeLessThanOrEqual(
      geometry.mainClient + 1,
    );
    expect(geometry.footer, `${width}×${height}`).toBeLessThanOrEqual(
      height + 1,
    );
    await expect(
      page.getByRole("button", { name: "Mulai", exact: true }),
    ).toBeInViewport();
    await expect(
      page.getByRole("heading", { name: "Selesaikan kuis", exact: true }),
    ).toBeInViewport();
    await page.getByRole("button", { name: "Switch to English" }).click();
    await expect(
      page.getByRole("button", { name: "Begin", exact: true }),
    ).toBeInViewport();
    expect(
      await page
        .locator(".welcome__main")
        .evaluate((el) => el.scrollHeight - el.clientHeight),
      `English ${width}×${height}`,
    ).toBeLessThanOrEqual(1);
    await page
      .getByRole("button", { name: "Ganti ke Bahasa Indonesia" })
      .click();
  }
});

test("Bali journey follows the route, waits for actual village readiness, and releases focus", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/player", async (route) => {
    await gate;
    await route.fulfill({ json: { player: null, aiReady: true } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Mulai", exact: true }).click();
  await expect(page.locator(".entry-journey")).toBeVisible();
  await expect(page.locator(".journey-content")).toHaveAttribute("inert", "");
  const map = page.locator(".entry-journey .bali-journey__map img");
  await expect(map).toBeVisible();
  await expect
    .poll(() =>
      map.evaluate(
        (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
      ),
    )
    .toBe(true);
  const traveler = page.locator(".entry-journey .bali-journey__traveler");
  const first = await traveler.evaluate(
    (el: SVGGraphicsElement) => el.getBBox().x,
  );
  await expect
    .poll(() => traveler.evaluate((el: SVGGraphicsElement) => el.getBBox().x))
    .toBeGreaterThan(first + 20);
  await page.screenshot({
    path: info.outputPath("bali-journey.png"),
    fullPage: false,
  });
  await expect(
    page.getByText("Desanya masih disiapkan…", { exact: true }),
  ).toBeVisible();
  await expect.poll(()=>traveler.evaluate(el=>Number(el.getAttribute('cx')))).toBeCloseTo(514.43,1);
  await expect.poll(()=>traveler.evaluate(el=>Number(el.getAttribute('cy')))).toBeCloseTo(278.11,1);
  await expect(page.locator(".entry-journey")).toBeVisible();
  release();
  await expect(page.locator(".entry-journey")).toHaveCount(0);
  await expect(page.locator("#main-content")).toBeFocused();
  await expect(page.locator(".journey-content")).not.toHaveAttribute(
    "inert",
    "",
  );
});

test("slow arrival offers recovery and does not leave a disabled start button on return", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop-chromium",
    "Shared recovery logic; the primary transition is tested on every engine.",
  );
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/player", async (route) => {
    await gate;
    await route.fulfill({ json: { player: null, aiReady: true } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Mulai", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Kembali", exact: true }),
  ).toBeVisible({ timeout: 12000 });
  await page.getByRole("button", { name: "Kembali", exact: true }).click();
  release();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("button", { name: "Mulai", exact: true }),
  ).toBeEnabled();
});
