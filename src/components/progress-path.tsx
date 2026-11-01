"use client";
import {
  ArrowRight,
  Check,
  Flame,
  Flag,
  LockKeyhole,
  MapPin,
  Sparkles,
} from "lucide-react";
import { lessons } from "@/content/lessons";
import type { Lesson, LevelId, Locale, Player } from "@/lib/types";
import { Stars } from "./ui";

export function ProgressPath({
  player,
  selected,
  locale,
  busy,
  onSelect,
  onStart,
  onResume,
}: {
  player: Player | null;
  selected: LevelId;
  locale: Locale;
  busy: boolean;
  onSelect: (id: LevelId) => void;
  onStart: (lesson: Lesson) => void;
  onResume: () => void;
}) {
  const t = (id: string, en: string) => (locale === "id" ? id : en);
  const completed = lessons.filter((lesson) => player?.stars[lesson.id]).length;
  const unlocked = (index: number) =>
    index === 0 || Boolean(player?.stars[lessons[index - 1].id]);
  return (
    <section
      className="progress-path"
      aria-label={t("Jalur belajar", "Learning path")}
    >
      <header className="path-summary">
        <div>
          <small>
            {t("GELAR KAMU", "YOUR TITLE")}
            {player?.isDemo ? " · DEMO" : ""}
          </small>
          <h1>{completed === 4 ? "Nyama" : "Tamiu"}</h1>
        </div>
        <span>
          <Flame size={16} />
          {player?.streak || 0} {t("hari", "days")}
        </span>
        <span>
          <Sparkles size={16} />
          {player?.xp || 0} XP
        </span>
      </header>
      <div className="chapter-completion">
        <span>{t("Babak 1 · Rauh", "Chapter 1 · Rauh")}</span>
        <strong>
          {completed}/4 {t("lokasi selesai", "places completed")}
        </strong>
        <progress
          max={4}
          value={completed}
          aria-label={t("Progres babak", "Chapter progress")}
        />
      </div>
      {player?.activeSessionId ? (
        <button
          className="path-resume"
          aria-label={t("Lanjutkan", "Continue")}
          onClick={onResume}
          disabled={busy}
        >
          <strong>
            {t(
              "Lanjutkan latihan yang belum selesai",
              "Continue your unfinished lesson",
            )}
          </strong>
          <ArrowRight size={20} />
        </button>
      ) : null}
      <ol className="path-levels">
        {lessons.map((lesson, index) => {
          const available = unlocked(index),
            active = lesson.id === selected,
            done = Boolean(player?.stars[lesson.id]);
          return (
            <li
              key={lesson.id}
              className={`${active ? "active" : ""} ${done ? "complete" : ""} ${!available ? "locked" : ""}`}
              data-level-id={lesson.id}
            >
              <button
                className="path-node"
                onClick={() => onSelect(lesson.id)}
                aria-label={`${lesson.title}, ${available ? t("terbuka", "unlocked") : t("terkunci", "locked")}`}
                aria-pressed={active}
              >
                {done ? (
                  <Check size={23} />
                ) : !available ? (
                  <LockKeyhole size={19} />
                ) : lesson.id === "boss" ? (
                  <Flag size={22} />
                ) : (
                  lesson.number
                )}
              </button>
              <article className="path-card">
                <button
                  className="path-title"
                  onClick={() => onSelect(lesson.id)}
                  aria-expanded={active}
                >
                  <small>
                    {lesson.id === "boss"
                      ? t("TANTANGAN AKHIR", "FINAL CHALLENGE")
                      : `Level ${lesson.number}`}
                    {active ? ` · ${t("dipilih", "selected")}` : ""}
                  </small>
                  <h3>{lesson.title}</h3>
                  {done ? <Stars count={player!.stars[lesson.id]} /> : null}
                </button>
                {active ? (
                  <div className="path-brief">
                    <p>
                      <MapPin size={15} />
                      {lesson.subtitle[locale]}
                    </p>
                    <button
                      className="btn primary full"
                      disabled={!available || busy}
                      onClick={() => onStart(lesson)}
                    >
                      {!available
                        ? t(
                            `Selesaikan ${lessons[index - 1]?.title}`,
                            `Complete ${lessons[index - 1]?.title}`,
                          )
                        : done
                          ? t("Latihan lagi", "Practise again")
                          : t("Mulai ngobrol", "Start talking")}
                      <ArrowRight size={17} />
                    </button>
                  </div>
                ) : null}
              </article>
            </li>
          );
        })}
      </ol>
      <p className="path-unlock-note">
        {t(
          "Selesaikan percakapan dan kuis untuk membuka lokasi berikutnya.",
          "Complete the conversation and quiz to open the next location.",
        )}
      </p>
    </section>
  );
}
