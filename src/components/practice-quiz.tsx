"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  ExternalLink,
  Mic,
  RotateCcw,
  Square,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { corpus } from "@/content/corpus";
import { lessons } from "@/content/lessons";
import type { GameSession, Locale, Player } from "@/lib/types";
import { api, json } from "@/lib/client-api";
import { Spinner } from "./ui";
import { useRecorder, useSpeech } from "./use-audio";

export function PracticeQuiz({
  session,
  onSession,
  onPlayer,
  locale,
  muted,
  onExit,
  onToggleMute,
}: {
  session: GameSession;
  onSession: (session: GameSession) => void;
  onPlayer: (player: Player) => void;
  locale: Locale;
  muted: boolean;
  onExit: () => void;
  onToggleMute: () => void;
}) {
  const questions = session.quiz!;
  const firstUnanswered = questions.findIndex(
    (item) => !session.quizResponses?.[item.id],
  );
  const [index, setIndex] = useState(
    firstUnanswered < 0 ? questions.length - 1 : firstUnanswered,
  );
  const [choices, setChoices] = useState<Record<string, string>>({}),
    [words, setWords] = useState<number[]>([]),
    [typed, setTyped] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const t = (id: string, en: string) => (locale === "id" ? id : en);
  const q = questions[index],
    feedback = session.quizResponses?.[q.id];
  const speech = useSpeech(muted),
    recorder = useRecorder(session.levelId, (_raw, normalized) =>
      setTyped(normalized),
    );
  const heading = useRef<HTMLHeadingElement>(null),
    body = useRef<HTMLDivElement>(null);
  const source = corpus.find((entry) => entry.id === q.sourceId);
  const current =
    q.type === "order"
      ? words.map((i) => q.words?.[i]).join(" ")
      : q.type === "repeat"
        ? typed
        : choices[q.id] || "";
  const valid =
    Boolean(current.trim()) &&
    (q.type !== "order" || words.length === q.words?.length);
  const lesson = lessons.find((item) => item.id === session.levelId)!;
  useEffect(() => {
    body.current?.scrollTo({ top: 0 });
    heading.current?.focus({ preventScroll: true });
    if (q.type === "repeat" && !muted)
      void speech.play({ sessionId: session.id, phraseId: q.id });
    return () => speech.stop();
  }, [q.id]);
  async function check() {
    if (!valid || busy) return;
    setBusy(true);
    setError("");
    speech.stop();
    try {
      const data = await api<{ session: GameSession }>(
        `/api/sessions/${session.id}/answer`,
        json({ questionId: q.id, answer: current }),
      );
      if (!data.session.quizResponses?.[q.id])
        throw new Error(
          t(
            "Jawaban belum tersimpan. Coba lagi.",
            "Your answer has not been saved. Please retry.",
          ),
        );
      onSession(data.session);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : t(
              "Jawaban belum tersimpan. Coba lagi.",
              "Could not save your answer. Please retry.",
            ),
      );
    } finally {
      setBusy(false);
    }
  }
  async function next() {
    if (!feedback || busy) return;
    speech.stop();
    if (index < questions.length - 1) {
      setIndex(index + 1);
      setWords([]);
      setTyped("");
      setError("");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const data = await api<{ session: GameSession; player: Player }>(
        `/api/sessions/${session.id}/complete`,
        json({ answers: {} }),
      );
      onSession(data.session);
      onPlayer(data.player);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : t(
              "Hasil belum tersimpan. Coba lagi.",
              "Results have not been saved. Please retry.",
            ),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="practice-quiz">
      <header className="practice-header">
        <button
          className="icon-btn"
          aria-label={t("Kembali ke desa", "Back to village")}
          onClick={onExit}
        >
          <X size={22} />
        </button>
        <progress
          max={questions.length}
          value={Object.keys(session.quizResponses || {}).length}
          aria-label={t("Soal selesai", "Questions completed")}
        />
        <strong>
          {index + 1}/{questions.length}
        </strong>
        <button
          className="icon-btn"
          aria-label={
            muted
              ? t("Aktifkan suara", "Enable sound")
              : t("Matikan suara", "Mute sound")
          }
          onClick={onToggleMute}
        >
          {muted ? <VolumeX size={19} /> : <Volume2 size={19} />}
        </button>
      </header>
      <div className="practice-body" ref={body}>
        <span className="quiz-origin">
          <RotateCcw size={15} />
          {q.reinforcement
            ? t("Latihan penguatan", "Reinforcement practice")
            : t(
                `Dari kesalahanmu di ${lesson.title}`,
                `From your mistakes at ${lesson.title}`,
              )}
        </span>
        <p className="practice-type">
          {q.type === "choice"
            ? t("Pilih kalimat yang tepat", "Choose the right phrase")
            : q.type === "order"
              ? t("Susun kalimat", "Build the sentence")
              : t("Dengar dan ulangi", "Listen and repeat")}
        </p>
        <h1 ref={heading} tabIndex={-1}>
          {q.prompt[locale]}
        </h1>
        {q.type === "choice" ? (
          <div className="practice-options">
            {q.options?.map((option, i) => (
              <button
                key={`${option}-${i}`}
                disabled={Boolean(feedback) || busy}
                aria-pressed={(feedback?.answer || choices[q.id]) === option}
                className={`${(feedback?.answer || choices[q.id]) === option ? "selected" : ""} ${feedback && option === feedback.expectedAnswer ? "correct" : ""} ${feedback && !feedback.correct && option === feedback.answer ? "incorrect" : ""}`}
                onClick={() => setChoices({ ...choices, [q.id]: option })}
              >
                <span>
                  {feedback && option === feedback.expectedAnswer ? (
                    <Check size={18} />
                  ) : (
                    String.fromCharCode(65 + i)
                  )}
                </span>
                {option}
              </button>
            ))}
          </div>
        ) : null}
        {q.type === "order" ? (
          <>
            <p className="practice-instruction">
              {t(
                "Ketuk kata untuk menyusun kalimat. Ketuk lagi untuk mengembalikan.",
                "Tap words to build the sentence. Tap again to undo.",
              )}
            </p>
            <div
              className="word-answer"
              aria-label={t("Kalimat tersusun", "Your sentence")}
            >
              {feedback ? (
                <p>{feedback.answer}</p>
              ) : words.length ? (
                words.map((wordIndex, i) => (
                  <button
                    key={`${wordIndex}-${i}`}
                    disabled={busy}
                    onClick={() =>
                      setWords(words.filter((_, position) => position !== i))
                    }
                  >
                    {q.words?.[wordIndex]}
                  </button>
                ))
              ) : (
                <span>
                  {t("Susun kalimatmu di sini…", "Build your sentence here…")}
                </span>
              )}
            </div>
            {!feedback ? (
              <div className="word-bank">
                {q.words?.map((word, i) => (
                  <button
                    key={`${word}-${i}`}
                    disabled={busy || words.includes(i)}
                    onClick={() => setWords([...words, i])}
                  >
                    {word}
                  </button>
                ))}
              </div>
            ) : null}
          </>
        ) : null}
        {q.type === "repeat" ? (
          <div className="practice-repeat">
            <button
              className="btn audio-play"
              disabled={speech.loading || muted}
              onClick={() =>
                speech.play({ sessionId: session.id, phraseId: q.id })
              }
            >
              {speech.loading ? <Spinner /> : <Volume2 size={21} />}{" "}
              {t("Dengarkan kalimat", "Listen to the phrase")}
            </button>
            <details className="repeat-transcript">
              <summary>{t("Lihat teks", "Show text")}</summary>
              <p>{q.target}</p>
            </details>
            <div className="repeat-input">
              <button
                className={`record-button ${recorder.recording ? "recording" : ""}`}
                disabled={busy || Boolean(feedback) || recorder.transcribing}
                aria-label={
                  recorder.recording
                    ? t("Selesai merekam", "Stop recording")
                    : t("Mulai merekam", "Start recording")
                }
                onClick={() => {
                  speech.stop();
                  recorder.recording ? recorder.stop() : void recorder.start();
                }}
              >
                {recorder.transcribing ? (
                  <Spinner />
                ) : recorder.recording ? (
                  <Square size={18} />
                ) : (
                  <Mic size={22} />
                )}
              </button>
              <input
                value={feedback?.answer || typed}
                disabled={busy || Boolean(feedback)}
                onChange={(e) => setTyped(e.target.value)}
                aria-label={t("Jawaban ulang-ucap", "Repeat answer")}
                placeholder={t(
                  "Ucapkan atau ketik kembali…",
                  "Repeat aloud or type…",
                )}
              />
            </div>
            <p className="note">
              {t(
                "Pelafalan tidak dinilai. Periksa transkrip sebelum melanjutkan.",
                "Pronunciation is not scored. Check the transcript before continuing.",
              )}
            </p>
          </div>
        ) : null}
        {feedback ? (
          <div className="checked-answer-source">
            <button
              className="text-link"
              disabled={speech.loading || muted}
              onClick={() =>
                speech.play({ sessionId: session.id, phraseId: q.id })
              }
            >
              <Volume2 size={17} />
              {t("Dengar pengucapannya", "Listen to the phrase")}
            </button>
            {source ? (
              <a href={source.sourceUrl} target="_blank" rel="noreferrer">
                {t("Sumber kalimat", "Phrase source")}
                <ExternalLink size={13} />
              </a>
            ) : null}
          </div>
        ) : null}
        {speech.error ? <p className="audio-notice">{speech.error}</p> : null}
      </div>
      <footer
        className={`practice-footer ${feedback ? (feedback.correct ? "is-correct" : "is-incorrect") : ""}`}
      >
        {feedback ? (
          <div className="answer-feedback" role="status">
            {feedback.correct ? <Check size={26} /> : <RotateCcw size={26} />}
            <div>
              <h2>
                {feedback.correct
                  ? t("Tepat!", "That’s right!")
                  : t(
                      "Belum tepat. Yuk, ingat kalimat ini.",
                      "Not quite. Remember this phrase.",
                    )}
              </h2>
              <p>
                {source
                  ? `${feedback.expectedAnswer} — ${locale === "id" ? source.indonesia : source.english}`
                  : feedback.expectedAnswer}
              </p>
            </div>
          </div>
        ) : (
          <p className="practice-save-note">
            {t(
              "Jawaban diperiksa setelah kamu memilih Periksa jawaban.",
              "Your answer is checked when you choose Check answer.",
            )}
          </p>
        )}
        {error || recorder.error ? (
          <p className="inline-error" role="alert">
            {error || recorder.error}
          </p>
        ) : null}
        <button
          className="btn primary full"
          disabled={
            busy ||
            recorder.recording ||
            recorder.transcribing ||
            (!feedback && !valid)
          }
          onClick={() => void (feedback ? next() : check())}
        >
          {busy ? (
            <Spinner />
          ) : feedback ? (
            index === questions.length - 1 ? (
              t("Lihat hasil", "See results")
            ) : (
              t("Lanjutkan", "Continue")
            )
          ) : (
            t("Periksa jawaban", "Check answer")
          )}
          <ArrowRight size={18} />
        </button>
      </footer>
    </section>
  );
}
