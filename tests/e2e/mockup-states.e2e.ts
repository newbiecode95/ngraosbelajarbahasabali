import { test, expect } from "@playwright/test";
import type { GameSession, Player, QuizQuestion } from "../../src/lib/types";

// Deterministic visual QA data. Language accuracy is tested separately; no provider is called here.
test("reference states keep the correction, feedback, unlock and actions usable", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop-chromium",
    "One deterministic capture set; engine flows are covered by guided-gameplay.",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() =>
    localStorage.setItem(
      "ngraos-preferences",
      JSON.stringify({ muted: true, reduced: true, locale: "id" }),
    ),
  );
  let player: Player = {
    id: "reference-qa",
    name: "Ayu",
    locale: "id",
    xp: 120,
    streak: 4,
    isDemo: true,
    isAdmin: false,
    stars: { warung: 3, kos: 2 },
    albums: ["warung", "kos"],
  };
  let session: GameSession = {
    id: "dc3f3fe5-7cad-46eb-b27c-20520932b328",
    levelId: "pasar",
    status: "active",
    hintsUsed: 0,
    completedObjectives: ["pasar:price", "pasar:quantity"],
    turns: [
      {
        id: "25c2ed7e-1e6c-4cad-8b83-7130c2ab29cd",
        playerText: "Aji berapa niki?",
        reply: "Aji duang tali.",
        translation: { id: "Harganya dua ribu.", en: "It costs two thousand." },
        objectiveIds: ["pasar:price"],
        assessed: true,
        createdAt: "2026-11-01T00:00:00Z",
        corrections: [
          {
            said: "Aji berapa niki?",
            correct: "Aji kuda niki?",
            type: "vocabulary",
            sourceId: "phrase:pasar-01",
            supported: true,
            reason: {
              id: "Untuk menanyakan harga, gunakan kuda.",
              en: "Use kuda to ask the price.",
            },
          },
        ],
      },
    ],
  };
  const quiz: QuizQuestion[] = Array.from({ length: 5 }, (_, i) => ({
    id: `reference-q${i}`,
    type: "choice",
    prompt: {
      id: "Kamu ingin menanyakan harga. Apa yang kamu ucapkan?",
      en: "How do you ask the price?",
    },
    options: ["Aji berapa niki?", "Aji kuda niki?", "Suksma."],
    sourceId: "phrase:pasar-01",
    reinforcement: false,
    mistakeId: "reference-mistake",
  }));
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/player")
      return route.fulfill({ json: { player, aiReady: true } });
    if (
      path.endsWith("/turns") &&
      route.request().postDataJSON().text === "Dados kirang?"
    )
      session = {
        ...session,
        completedObjectives: ["pasar:price", "pasar:quantity", "pasar:bargain"],
      };
    if (path.endsWith("/quiz"))
      session = {
        ...session,
        status: "quiz",
        quiz,
        quizResponses: {
          [quiz[0].id]: {
            answer: "Suksma.",
            correct: false,
            expectedAnswer: "Aji kuda niki?",
          },
        },
      };
    if (path.endsWith("/answer")) {
      const { questionId, answer } = route.request().postDataJSON();
      session = {
        ...session,
        quizResponses: {
          ...session.quizResponses,
          [questionId]: {
            answer,
            correct: answer === "Aji kuda niki?",
            expectedAnswer: "Aji kuda niki?",
          },
        },
      };
    }
    if (path.endsWith("/complete")) {
      session = {
        ...session,
        status: "completed",
        result: {
          stars: 2,
          xp: 40,
          quizScore: 4,
          quizTotal: 5,
          newAlbum: true,
          unlockedLevel: "boss",
          mistakesPracticed: 1,
          mistakesMastered: 0,
        },
      };
      player = {
        ...player,
        stars: { ...player.stars, pasar: 2 },
        albums: [...player.albums, "pasar"],
      };
      return route.fulfill({ json: { session, player } });
    }
    return route.fulfill({ json: { session } });
  });
  await page.goto("/desa");
  await expect(
    page.getByRole("heading", { name: "Tamiu", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Mulai ngobrol", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByText("2/4 lokasi selesai", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("reference-path.png"),
    fullPage: false,
  });
  await page
    .getByRole("button", { name: "Mulai ngobrol", exact: true })
    .click();
  await expect(page.locator(".correction-card")).toHaveAttribute("open", "");
  await expect(page.getByText("Aji kuda niki?", { exact: true })).toBeVisible();
  await page.screenshot({
    path: info.outputPath("reference-conversation.png"),
    fullPage: false,
  });
  await page.getByRole("button", { name: "Ketik", exact: true }).click();
  await page.getByLabel("Apa yang ingin kamu katakan?").fill("Hmm.");
  await page.getByRole("button", { name: "Kirim ucapan", exact: true }).click();
  await expect(
    page.getByText(
      "Target ini belum tercapai. Coba jawab sesuai arahan di atas.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByLabel("Apa yang ingin kamu katakan?").fill("Dados kirang?");
  await page.getByRole("button", { name: "Kirim ucapan", exact: true }).click();
  await expect(page.locator(".guide-stalled")).toHaveCount(0);
  await page.getByRole("button", { name: "Buka kuis", exact: true }).click();
  await page
    .getByRole("button", { name: "B Aji kuda niki?", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Periksa jawaban", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Tepat!", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Lanjutkan", exact: true }),
  ).toBeInViewport();
  await page.screenshot({
    path: info.outputPath("reference-quiz.png"),
    fullPage: false,
  });
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: "Lanjutkan", exact: true }).click();
    await page
      .getByRole("button", { name: "B Aji kuda niki?", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Periksa jawaban", exact: true })
      .click();
  }
  await page.getByRole("button", { name: "Lihat hasil", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Level 3 selesai!", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Mulai tantangan akhir", exact: true }),
  ).toBeInViewport();
  await page.screenshot({
    path: info.outputPath("reference-result.png"),
    fullPage: false,
  });
  for (const [width, height] of [
    [320, 568],
    [390, 380],
    [768, 1024],
    [1440, 960],
  ]) {
    await page.setViewportSize({ width, height });
    await expect(
      page.getByRole("button", { name: "Mulai tantangan akhir", exact: true }),
    ).toBeInViewport();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  }
  await page.screenshot({
    path: info.outputPath("reference-desktop-result.png"),
    fullPage: false,
  });
});
