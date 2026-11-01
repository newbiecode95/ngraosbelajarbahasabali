import { test, expect } from "@playwright/test";
import type { GameSession, Player, QuizQuestion } from "../../src/lib/types";

for (const destination of ["next", "replay"] as const)
  test(`guided conversation → checked quiz → result → ${destination}`, async ({
    page,
  }, info) => {
    await page.addInitScript(() =>
      localStorage.setItem(
        "ngraos-preferences",
        JSON.stringify({ muted: true, reduced: true, locale: "id" }),
      ),
    );
    let player: Player = {
      id: "guide-test",
      name: "Ayu",
      locale: "id",
      xp: 0,
      streak: 0,
      isDemo: true,
      isAdmin: false,
      stars: {},
      albums: [],
    };
    let session: GameSession = {
      id: "96377573-c3b8-4d03-b321-722aa8837268",
      levelId: "warung",
      status: "active",
      turns: [],
      completedObjectives: [],
      hintsUsed: 0,
      revealedHints: [],
      quizResponses: {},
    };
    let hints = 0,
      turns = 0,
      completed = 0;
    const started: string[] = [];
    const questions: QuizQuestion[] = [
      {
        id: "q1",
        type: "choice",
        prompt: { id: "Pilih sapaan pagi.", en: "Choose a morning greeting." },
        options: [
          "Suksma.",
          "Rahajeng semeng.",
          "Tiang pamit.",
          "Rahajeng wengi.",
        ],
        sourceId: "phrase:warung-01",
        reinforcement: true,
      },
      {
        id: "q2",
        type: "order",
        prompt: {
          id: "Susun ucapan untuk berpamitan.",
          en: "Build the goodbye phrase.",
        },
        words: ["pamit.", "Tiang"],
        sourceId: "phrase:warung-13",
        reinforcement: true,
      },
      {
        id: "q3",
        type: "repeat",
        prompt: { id: "Dengarkan lalu ulangi.", en: "Listen and repeat." },
        target: "Suksma.",
        sourceId: "phrase:warung-07",
        reinforcement: true,
      },
      {
        id: "q4",
        type: "choice",
        prompt: {
          id: "Pilih ucapan terima kasih.",
          en: "Choose the expression of thanks.",
        },
        options: [
          "Rahajeng wengi.",
          "Tiang pamit.",
          "Suksma.",
          "Rahajeng semeng.",
        ],
        sourceId: "phrase:warung-07",
        reinforcement: true,
      },
      {
        id: "q5",
        type: "order",
        prompt: { id: "Susun sapaan pagi.", en: "Build the morning greeting." },
        words: ["semeng.", "Rahajeng"],
        sourceId: "phrase:warung-01",
        reinforcement: true,
      },
    ];
    const expected: Record<string, string> = {
      q1: "Rahajeng semeng.",
      q2: "Tiang pamit.",
      q3: "Suksma.",
      q4: "Suksma.",
      q5: "Rahajeng semeng.",
    };
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === "/api/player")
        return route.fulfill({ json: { player, aiReady: true } });
      if (path === "/api/sessions") {
        const level = route.request().postDataJSON().levelId;
        started.push(level);
        if (completed)
          session = {
            ...session,
            id: "82f9ce80-26bb-41a8-a240-fc826001aeb5",
            levelId: level,
            status: "active",
            turns: [],
            completedObjectives: [],
            quiz: undefined,
            result: undefined,
            quizResponses: {},
            hintsUsed: 0,
            revealedHints: [],
          };
        player = { ...player, activeSessionId: session.id };
        return route.fulfill({ json: { session } });
      }
      if (path.endsWith("/hint")) {
        hints++;
        const objective = route.request().postDataJSON().objectiveId;
        session = { ...session, hintsUsed: 1, revealedHints: [objective] };
        return route.fulfill({
          json: { session, hint: "Suksma.", hintObjectiveId: objective },
        });
      }
      if (path.endsWith("/turns")) {
        turns++;
        const body = route.request().postDataJSON();
        const objective =
          turns === 1
            ? "warung:greet"
            : turns === 2
              ? "warung:thank"
              : "warung:farewell";
        const turn = {
          id: body.id,
          playerText: body.text,
          reply: "Nggih, suksma.",
          translation: { id: "Ya, terima kasih.", en: "Yes, thank you." },
          corrections: [],
          objectiveIds: [objective],
          assessed: true,
          createdAt: new Date().toISOString(),
        };
        session = {
          ...session,
          turns: [...session.turns, turn],
          completedObjectives: [...session.completedObjectives, objective],
        };
        return route.fulfill({ json: { session, turn } });
      }
      if (path.endsWith("/quiz")) {
        session = { ...session, status: "quiz", quiz: questions };
        return route.fulfill({ json: { session } });
      }
      if (path.endsWith("/answer")) {
        const body = route.request().postDataJSON();
        if (!session.quizResponses?.[body.questionId])
          session = {
            ...session,
            quizResponses: {
              ...session.quizResponses,
              [body.questionId]: {
                answer: body.answer,
                expectedAnswer: expected[body.questionId],
                correct: body.answer === expected[body.questionId],
              },
            },
          };
        return route.fulfill({ json: { session } });
      }
      if (path.endsWith("/complete")) {
        completed++;
        expect(Object.keys(session.quizResponses || {})).toHaveLength(5);
        session = {
          ...session,
          status: "completed",
          result: {
            stars: 2,
            xp: 160,
            quizScore: 4,
            quizTotal: 5,
            newAlbum: true,
            unlockedLevel: "kos",
            mistakesPracticed: 0,
            mistakesMastered: 0,
          },
        };
        player = {
          ...player,
          xp: 160,
          stars: { warung: 2 },
          albums: ["warung"],
          activeSessionId: undefined,
        };
        return route.fulfill({ json: { session, player } });
      }
      if (path === `/api/sessions/${session.id}`)
        return route.fulfill({ json: { session } });
      return route.fulfill({
        status: 503,
        json: { error: "Unexpected fixture request" },
      });
    });
    await page.goto("/desa");
    await page
      .getByRole("button", { name: "Mulai ngobrol", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Sapa Men Sari", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Men Sari menyapamu. Balas dengan sapaan pagi dalam Basa Bali.",
        { exact: true },
      ),
    ).toBeVisible();
    expect(hints).toBe(0);
    await page.getByRole("button", { name: "Ketik", exact: true }).click();
    await page
      .getByLabel("Apa yang ingin kamu katakan?")
      .fill("Om swastiastu.");
    await page
      .getByRole("button", { name: "Kirim ucapan", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Ucapkan terima kasih", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Petunjuk", exact: true }).click();
    expect(hints).toBe(0);
    await expect(
      page.getByText(/Membuka contoh membatasi hasil/),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Lihat contoh ucapan", exact: true })
      .click();
    await expect(page.getByText("Suksma.", { exact: true })).toBeVisible();
    expect(hints).toBe(1);
    await page.reload();
    await page.getByRole("button", { name: "Lanjutkan", exact: true }).click();
    await page.getByRole("button", { name: "Petunjuk", exact: true }).click();
    await expect(page.getByText("Suksma.", { exact: true })).toBeVisible();
    expect(hints).toBe(1);
    await page
      .getByRole("button", { name: "Pakai dan sesuaikan", exact: true })
      .click();
    await expect(page.getByLabel("Apa yang ingin kamu katakan?")).toHaveValue(
      "Suksma.",
    );
    expect(turns).toBe(1);
    await page
      .getByRole("button", { name: "Kirim ucapan", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Pamit dengan ramah", exact: true }),
    ).toBeVisible();
    await page.getByLabel("Apa yang ingin kamu katakan?").fill("Tiang pamit.");
    await page
      .getByRole("button", { name: "Kirim ucapan", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Saatnya kuis singkat" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Buka kuis", exact: true }).click();
    await page.getByRole("button", { name: "A Suksma.", exact: true }).click();
    await page
      .getByRole("button", { name: "Periksa jawaban", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Belum tepat. Yuk, ingat kalimat ini.",
      }),
    ).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: "Lanjutkan", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Susun ucapan untuk berpamitan." }),
    ).toBeVisible();
    for (const word of ["Tiang", "pamit."])
      await page.getByRole("button", { name: word, exact: true }).click();
    await page
      .getByRole("button", { name: "Periksa jawaban", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Tepat!", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Lanjutkan", exact: true }).click();
    await page.getByLabel("Jawaban ulang-ucap").fill("Suksma.");
    await page
      .getByRole("button", { name: "Periksa jawaban", exact: true })
      .click();
    await page.getByRole("button", { name: "Lanjutkan", exact: true }).click();
    await page.getByRole("button", { name: "C Suksma.", exact: true }).click();
    await page
      .getByRole("button", { name: "Periksa jawaban", exact: true })
      .click();
    await page.getByRole("button", { name: "Lanjutkan", exact: true }).click();
    for (const word of ["Rahajeng", "semeng."])
      await page.getByRole("button", { name: word, exact: true }).click();
    await page
      .getByRole("button", { name: "Periksa jawaban", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Lihat hasil", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Level 1 selesai!", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Kos Bu Komang terbuka", { exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: info.outputPath("guided-result.png"),
      fullPage: false,
    });
    await page
      .getByRole("button", {
        name:
          destination === "next"
            ? "Lanjut ke Kos Bu Komang"
            : "Ulangi untuk 3 bintang",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("heading", {
        name: destination === "next" ? "Perkenalkan nama" : "Sapa Men Sari",
        exact: true,
      }),
    ).toBeVisible();
    expect(started.at(-1)).toBe(destination === "next" ? "kos" : "warung");
    expect(completed).toBe(1);
  });
