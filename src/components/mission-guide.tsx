"use client";
import { useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Lightbulb,
  Volume2,
  ExternalLink,
} from "lucide-react";
import type { GameSession, Lesson, Locale } from "@/lib/types";
import { currentMission, missionGuides } from "@/content/guidance";
import { corpus } from "@/content/corpus";
import { api, json } from "@/lib/client-api";
import { Modal, Spinner } from "./ui";
import { useSpeech } from "./use-audio";

export function MissionGuide({
  lesson,
  session,
  locale,
  muted,
  disabled,
  onSession,
  onExample,
  onOpen,
  notice,
  showNotice,
}: {
  lesson: Lesson;
  session: GameSession;
  locale: Locale;
  muted: boolean;
  disabled: boolean;
  onSession: (session: GameSession) => void;
  onExample: (text: string) => void;
  onOpen: () => void;
  notice: string;
  showNotice: boolean;
}) {
  const next = currentMission(lesson, session.completedObjectives);
  const t = (id: string, en: string) => (locale === "id" ? id : en);
  const [opened, setOpened] = useState<string | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const speech = useSpeech(muted);
  const objective = lesson.objectives.find((item) => item.id === opened);
  const guide = objective ? missionGuides[objective.id] : undefined;
  const example = corpus.find((entry) => entry.id === guide?.phraseId);
  const revealed = Boolean(opened && session.revealedHints?.includes(opened));
  function close() {
    speech.stop();
    setOpened(null);
    setError("");
  }
  async function reveal() {
    if (!opened || loading) return;
    setLoading(true);
    setError("");
    try {
      const data = await api<{ session: GameSession }>(
        `/api/sessions/${session.id}/hint`,
        json({ objectiveId: opened }),
      );
      onSession(data.session);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : t(
              "Contoh belum tersedia. Coba lagi.",
              "The example is unavailable. Try again.",
            ),
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <section
      className="mission-guide"
      aria-label={t("Panduan percakapan", "Conversation guide")}
    >
      <div className="guide-topline">
        <span>
          {next
            ? t(
                `Langkah ${lesson.objectives.indexOf(next) + 1} dari ${lesson.objectives.length}`,
                `Step ${lesson.objectives.indexOf(next) + 1} of ${lesson.objectives.length}`,
              )
            : t("Percakapan selesai", "Conversation complete")}
        </span>
        <span
          className="guide-progress"
          aria-label={`${session.completedObjectives.length}/${lesson.objectives.length}`}
        >
          {lesson.objectives.map((item) => (
            <span
              key={item.id}
              className={
                session.completedObjectives.includes(item.id)
                  ? "done"
                  : item.id === next?.id
                    ? "current"
                    : ""
              }
            >
              <Check size={11} />
            </span>
          ))}
        </span>
      </div>
      <div className="guide-current">
        <div>
          <h2>
            {next?.title[locale] ||
              t("Saatnya kuis singkat", "Time for a short quiz")}
          </h2>
          <p>
            {next
              ? missionGuides[next.id].instruction[locale]
              : t(
                  "Lanjutkan ke kuis 5 soal. Hadiah disimpan setelahnya.",
                  "Continue to the 5-question quiz, then save your rewards.",
                )}
          </p>
        </div>
        {next && lesson.id !== "boss" ? (
          <button
            className="guide-help"
            aria-label={t("Petunjuk", "Hint")}
            disabled={disabled}
            onClick={() => {
              onOpen();
              setError("");
              setOpened(next.id);
            }}
          >
            <Lightbulb size={18} />
            <span>{t("Petunjuk", "Hint")}</span>
          </button>
        ) : null}
      </div>
      <details className="mission-checklist">
        <summary>
          {t("Lihat semua target", "See all goals")}{" "}
          <span>
            {session.completedObjectives.length}/{lesson.objectives.length}
          </span>
          <ChevronDown size={14} />
        </summary>
        <ol>
          {lesson.objectives.map((item) => (
            <li
              key={item.id}
              className={
                session.completedObjectives.includes(item.id) ? "done" : ""
              }
              aria-current={item.id === next?.id ? "step" : undefined}
            >
              <Check size={14} />
              {item.title[locale]}
            </li>
          ))}
        </ol>
      </details>
      <span
        className={showNotice ? "guide-stalled" : "guide-announcement"}
        role="status"
      >
        {notice}
      </span>
      {objective && guide ? (
        <Modal title={objective.title[locale]} onClose={close}>
          <div className="hint-sheet">
            <span className="eyebrow">
              {t("COBA LANGKAH INI", "TRY THIS STEP")}
            </span>
            <p>{guide.instruction[locale]}</p>
            {revealed && example ? (
              <>
                <div className="hint-example">
                  <small>{t("Contoh ucapan", "Example phrase")}</small>
                  <strong>{example.bali}</strong>
                  <p>{locale === "id" ? example.indonesia : example.english}</p>
                </div>
                {guide.tip ? <p className="note">{guide.tip[locale]}</p> : null}
                <button
                  className="btn subtle full"
                  disabled={muted || speech.loading}
                  onClick={() =>
                    speech.play({ sessionId: session.id, phraseId: example.id })
                  }
                >
                  {speech.loading ? <Spinner /> : <Volume2 size={18} />}{" "}
                  {t("Dengarkan contoh", "Listen to the example")}
                </button>
                <a
                  className="hint-source"
                  href={example.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t("Lihat sumber", "View source")}
                  <ExternalLink size={14} />
                </a>
                <button
                  className="btn primary full"
                  onClick={() => {
                    onExample(example.bali);
                    close();
                  }}
                >
                  {t("Pakai dan sesuaikan", "Use and edit")}
                  <ArrowRight size={17} />
                </button>
                <p className="note">
                  {t(
                    "Contoh masuk ke kolom ketik. Periksa sebelum mengirim.",
                    "The example goes into the text box. Review it before sending.",
                  )}
                </p>
              </>
            ) : (
              <>
                <div className="hint-policy">
                  <Lightbulb size={20} />
                  <p>
                    {t(
                      "Perlu contoh kalimat? Membuka contoh membatasi hasil latihan ini hingga 2 bintang. Arahan langkah di atas selalu gratis.",
                      "Need an example? Revealing one limits this lesson to 2 stars. The directions above are always free.",
                    )}
                  </p>
                </div>
                <button
                  className="btn primary full"
                  disabled={loading}
                  onClick={() => void reveal()}
                >
                  {loading ? <Spinner /> : <Lightbulb size={17} />}{" "}
                  {t("Lihat contoh ucapan", "Show an example phrase")}
                </button>
                <button className="btn subtle full" onClick={close}>
                  {t("Coba sendiri dulu", "Try on my own")}
                </button>
              </>
            )}
            {error ? (
              <p className="inline-error" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
