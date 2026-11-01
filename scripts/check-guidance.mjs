// Opt-in real-provider probe. Uses paid AI and only its own disposable demo.
// node scripts/check-guidance.mjs https://ngraos.docker.anatera.app
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
const base = process.argv[2];
if (!base || !["http:", "https:"].includes(new URL(base).protocol))
  throw new Error(
    "Provide the target URL explicitly; this probe uses paid AI.",
  );
let cookie = "";
const report = {
  date: new Date().toISOString(),
  environment: base,
  checks: {},
  notes: [
    "One isolated sequential real-provider session, not a load benchmark.",
    "Typed phrases and generated WAV, not physical microphone or language-accuracy certification.",
  ],
};
async function call(path, body, method = "POST") {
  const response = await fetch(`${base}/api/${path}`, {
    method,
    headers: {
      Origin: base,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(65000),
  });
  if (!response.ok)
    throw new Error(
      `${path.replace(/[a-f0-9-]{36}/g, "[session]")}: HTTP ${response.status}`,
    );
  return response;
}
async function data(path, body, method) {
  return (await call(path, body, method)).json();
}
try {
  const created = await call("demo", {
    name: "Guidance release verification",
    locale: "id",
  });
  cookie = created.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  assert(cookie);
  let { session } = await data("sessions", { levelId: "warung" });
  const hints = await Promise.all([
    data(`sessions/${session.id}/hint`, { objectiveId: "warung:greet" }),
    data(`sessions/${session.id}/hint`, { objectiveId: "warung:greet" }),
  ]);
  assert.equal(hints[0].hint, "Rahajeng semeng.");
  assert.equal(hints[0].session.hintsUsed, 1);
  assert.equal(hints[1].session.hintsUsed, 1);
  assert.deepEqual(hints[0].session.revealedHints, ["warung:greet"]);
  report.checks.concurrentCanonicalHint = true;
  for (const text of ["Rahajeng semeng.", "Suksma.", "Tiang pamit."]) {
    const result = await data(`sessions/${session.id}/turns`, {
      id: randomUUID(),
      text,
    });
    session = result.session;
    assert(result.turn.reply.trim());
  }
  assert.equal(session.completedObjectives.length, 3);
  report.checks.realConversationObjectives = true;
  ({ session } = await data(`sessions/${session.id}/quiz`, {}));
  assert.equal(session.quiz.length, 5);
  assert(session.quiz.every((q) => !("answer" in q) && !("variants" in q)));
  assert.deepEqual(session.quizResponses, {});
  report.checks.uncheckedAnswersPrivate = true;
  const first = session.quiz[0];
  ({ session } = await data(`sessions/${session.id}/answer`, {
    questionId: first.id,
    answer: "belum tahu",
  }));
  const stored = session.quizResponses[first.id];
  assert.equal(stored.correct, false);
  assert(stored.expectedAnswer);
  const retried = await data(`sessions/${session.id}/answer`, {
    questionId: first.id,
    answer: stored.expectedAnswer,
  });
  assert.deepEqual(retried.session.quizResponses[first.id], stored);
  const resumed = await data(`sessions/${session.id}`, undefined, "GET");
  assert.deepEqual(resumed.session.quizResponses[first.id], stored);
  report.checks.firstAnswerRetainedAfterRetryAndResume = true;
  for (const q of session.quiz.slice(1)) {
    const answer =
      q.type === "repeat"
        ? q.target
        : q.type === "choice"
          ? q.options[0]
          : q.words.join(" ");
    ({ session } = await data(`sessions/${session.id}/answer`, {
      questionId: q.id,
      answer,
    }));
  }
  assert.equal(Object.keys(session.quizResponses).length, 5);
  report.checks.allAnswersSaved = true;
  const audio = Buffer.from(
    await (
      await call("speech", { sessionId: session.id, phraseId: first.id })
    ).arrayBuffer(),
  );
  assert.equal(audio.subarray(0, 4).toString(), "RIFF");
  assert.equal(audio.subarray(8, 12).toString(), "WAVE");
  report.checks.checkedAnswerWav = true;
  const completed = await Promise.all([
    data(`sessions/${session.id}/complete`, { answers: {} }),
    data(`sessions/${session.id}/complete`, { answers: {} }),
  ]);
  assert.deepEqual(completed[0].session.result, completed[1].session.result);
  assert.equal(completed[0].player.xp, completed[1].player.xp);
  assert.equal(completed[0].session.result.stars, 2);
  assert.equal(completed[0].session.result.unlockedLevel, "kos");
  report.checks.concurrentCompletionIdempotent = true;
  const player = await data("player", undefined, "GET");
  assert.equal(player.player.xp, completed[0].player.xp);
  const next = await data("sessions", { levelId: "kos" });
  assert.equal(next.session.levelId, "kos");
  assert.equal(next.session.status, "active");
  report.checks.nextLocationStarted = true;
  report.result = {
    stars: completed[0].session.result.stars,
    quizScore: completed[0].session.result.quizScore,
    quizTotal: 5,
    xp: completed[0].player.xp,
  };
} finally {
  if (cookie) {
    await call("player", undefined, "DELETE");
    report.temporaryDemoDeleted = true;
  }
}
await writeFile(
  new URL("../docs/gameplay-guide/production-check.json", import.meta.url),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
