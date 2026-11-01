"use client";
import {
  ArrowRight,
  BookOpen,
  Check,
  Flag,
  Flower2,
  LockKeyholeOpen,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { lessons } from "@/content/lessons";
import type { GameSession, LevelId, Locale } from "@/lib/types";
import { Spinner, Stars } from "./ui";

export function LessonResult({
  session,
  locale,
  busy,
  onNext,
  onReplay,
  onDone,
}: {
  session: GameSession;
  locale: Locale;
  busy: boolean;
  onNext: (level: LevelId) => void;
  onReplay: () => void;
  onDone: () => void;
}) {
  const lesson = lessons.find((item) => item.id === session.levelId)!;
  const next = lessons[lessons.indexOf(lesson) + 1];
  const result = session.result!;
  const albumSentences = lesson.album.text[locale].split(/(?<=\.)\s+/);
  const t = (id: string, en: string) => (locale === "id" ? id : en);
  const assessed = session.turns.filter((turn) => turn.assessed !== false);
  const correct = assessed.filter(
    (turn) => !turn.corrections.some((item) => item.supported),
  ).length;
  return (
    <section className="lesson-result">
      <div className="result-hero">
        <Stars count={result.stars} size={48} />
        <h1>
          {lesson.id === "boss"
            ? t("Babak 1 selesai!", "Chapter 1 complete!")
            : t(
                `Level ${lesson.number} selesai!`,
                `Level ${lesson.number} complete!`,
              )}
        </h1>
        <p>
          {lesson.title} · {result.stars} {t("bintang", "stars")}
        </p>
      </div>
      <div className="result-paper">
        <div className="result-content">
          <div className="result-metrics">
            <div>
              <Sparkles size={19} />
              <strong>+{result.xp}</strong>
              <span>XP</span>
            </div>
            <div>
              <Check size={19} />
              <strong>
                {result.quizScore}/{result.quizTotal}
              </strong>
              <span>{t("Jawaban kuis tepat", "Correct quiz answers")}</span>
            </div>
            <div>
              <BookOpen size={19} />
              <strong>
                {result.mistakesPracticed
                  ? `${result.mistakesMastered}/${result.mistakesPracticed}`
                  : `${correct}/${assessed.length}`}
              </strong>
              <span>
                {result.mistakesPracticed
                  ? t("Kesalahan dikuasai", "Mistakes mastered")
                  : t("Giliran tanpa koreksi", "Turns without corrections")}
              </span>
            </div>
          </div>
          <div className="earned-album">
            <Flower2 size={32} />
            <div>
              <small>
                {result.newAlbum
                  ? t("KARTU ALBUM DESA BARU", "NEW VILLAGE ALBUM CARD")
                  : t("DARI ALBUM DESA", "FROM YOUR VILLAGE ALBUM")}
              </small>
              <h2>{lesson.album.title[locale]}</h2>
              <p>{albumSentences[0]}</p>
              {albumSentences.length > 1 ? (
                <details className="album-note">
                  <summary>{t("Baca catatan", "Read the note")}</summary>
                  <p>{albumSentences.slice(1).join(" ")}</p>
                </details>
              ) : null}
            </div>
          </div>
          {next ? (
            <div className="next-location">
              <span>
                {next.id === "boss" ? (
                  <Flag size={25} />
                ) : (
                  <LockKeyholeOpen size={25} />
                )}
              </span>
              <div>
                <strong>
                  {session.result?.unlockedLevel
                    ? t(`${next.title} terbuka`, `${next.title} unlocked`)
                    : t(`Berikutnya: ${next.title}`, `Up next: ${next.title}`)}
                </strong>
                <p>{next.subtitle[locale]}</p>
              </div>
            </div>
          ) : (
            <div className="next-location">
              <Check size={28} />
              <div>
                <strong>
                  {t("Dari Tamiu jadi Nyama", "From Tamiu to Nyama")}
                </strong>
                <p>
                  {t(
                    "Empat lokasi selesai. Kamu bisa kembali untuk berlatih lagi.",
                    "All four locations are complete. Return any time to practise.",
                  )}
                </p>
              </div>
            </div>
          )}
        </div>
        <div className="result-actions">
          <button
            className="btn primary full"
            disabled={busy}
            onClick={() => (next ? onNext(next.id) : onDone())}
          >
            {busy ? (
              <Spinner />
            ) : next ? (
              t(
                next.id === "boss"
                  ? "Mulai tantangan akhir"
                  : `Lanjut ke ${next.title}`,
                next.id === "boss"
                  ? "Start the final challenge"
                  : `Continue to ${next.title}`,
              )
            ) : (
              t("Kembali ke desa", "Back to village")
            )}
            <ArrowRight size={18} />
          </button>
          <button
            className="btn subtle full"
            disabled={busy}
            onClick={onReplay}
          >
            <RotateCcw size={17} />
            {result.stars < 3
              ? t("Ulangi untuk 3 bintang", "Try again for 3 stars")
              : t("Latihan lagi", "Practise again")}
          </button>
          {next ? (
            <button className="text-link" onClick={onDone}>
              {t("Kembali ke peta desa", "Back to the village map")}
            </button>
          ) : null}
        </div>
        <p className="result-saved" role="status">
          {t(
            "Progres dan bintang terbaikmu sudah disimpan.",
            "Your progress and best stars have been saved.",
          )}
        </p>
      </div>
    </section>
  );
}
