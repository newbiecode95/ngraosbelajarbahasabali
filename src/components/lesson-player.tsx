"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Mic,
  Square,
  Keyboard,
  Send,
  Volume2,
  Lightbulb,
  Check,
  ChevronDown,
  ExternalLink,
  Flag,
  RotateCcw,
  Sparkles,
  Flower2,
  Star,
  BookOpen,
  ShoppingBasket,
  Coffee,
  LoaderCircle,
  X,
} from "lucide-react";
import { MissionGuide } from "./mission-guide";
import { PracticeQuiz } from "./practice-quiz";
import { LessonResult } from "./lesson-result";
import { currentMission } from "@/content/guidance";
import { lessons } from "@/content/lessons";
import { corpus } from "@/content/corpus";
import type {
  GameSession,
  LevelId,
  Locale,
  Player,
  QuizQuestion,
  Turn,
} from "@/lib/types";
import { api, json } from "@/lib/client-api";
import { Modal, Spinner, Stars } from "./ui";
import { useRecorder, useSpeech } from "./use-audio";
import { correctionIsReadable, replyNeedsRepair } from "@/lib/learning-text";
const portraits = {
  warung: "/images/sari.webp",
  kos: "/images/komang.webp",
  pasar: "/images/pedagang.webp",
  boss: "/images/wayan.webp",
};
export function LessonPlayer({
  session,
  onSession,
  locale,
  muted,
  onDone,
  onExit,
  onPlayer,
  onSpeaking,
  onNext,
  onReplay,
  navigationBusy,
  onToggleMute,
}: {
  session: GameSession;
  onSession: (s: GameSession) => void;
  locale: Locale;
  muted: boolean;
  onDone: () => void;
  onExit: () => void;
  onPlayer: (p: Player) => void;
  onSpeaking?: (speaking: boolean) => void;
  onNext: (level: LevelId) => void;
  onReplay: () => void;
  navigationBusy: boolean;
  onToggleMute: () => void;
}) {
  const lesson = lessons.find((l) => l.id === session.levelId)!;
  const t = (a: string, b: string) => (locale === "id" ? a : b);
  const [draft, setDraft] = useState(""),
    [raw, setRaw] = useState(""),
    [mode, setMode] = useState<"voice" | "text">("voice"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [guidanceNotice, setGuidanceNotice] = useState(""),
    [needsDirection, setNeedsDirection] = useState(false),
    [selectedObject, setSelectedObject] = useState(""),
    [report, setReport] = useState<string | null>(null),
    [reportText, setReportText] = useState(""),
    [reportDone, setReportDone] = useState(false),
    [reportBusy, setReportBusy] = useState(false),
    [reviewVoice, setReviewVoice] = useState(false);
  const [repairingTurn, setRepairingTurn] = useState<string | null>(null);
  const sending = useRef(false);
  const speech = useSpeech(muted);
  const recorder = useRecorder(
    lesson.id,
    (r, n) => {
      if (reviewVoice) {
        setRaw(r);
        setDraft(n);
      } else void sendTurn(n, r);
    },
    true,
  );
  const bottom = useRef<HTMLDivElement | null>(null),
    attempt = useRef<{ id: string; text: string } | null>(null);
  const conversationView = useRef<HTMLDivElement | null>(null);
  const completed = lesson.objectives.every((o) =>
    session.completedObjectives.includes(o.id),
  );
  const isConversation =
    session.status !== "completed" && !session.quiz?.length;
  useEffect(() => {
    onSpeaking?.(speech.speaking);
    return () => onSpeaking?.(false);
  }, [speech.speaking, onSpeaking]);

  useEffect(() => {
    const history = bottom.current?.parentElement;
    if (history)
      history.scrollTo({
        top: history.scrollHeight,
        behavior:
          window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
          document.documentElement.dataset.reduced === "true"
            ? "instant"
            : "smooth",
      });
  }, [session.turns.length, busy]);
  useEffect(() => {
    const viewport = window.visualViewport;
    const update = () => {
      const height = viewport?.height || window.innerHeight;
      conversationView.current?.style.setProperty(
        "--lesson-viewport",
        `${height}px`,
      );
      conversationView.current?.classList.toggle("keyboard-open", height < 500);
    };
    update();
    viewport?.addEventListener("resize", update);
    window.addEventListener("resize", update);
    return () => {
      viewport?.removeEventListener("resize", update);
      window.removeEventListener("resize", update);
    };
  }, [isConversation]);
  useEffect(() => {
    if (recorder.failures >= 2) setMode("text");
  }, [recorder.failures]);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!session.turns.length && !session.quiz && !muted)
        void speech.play({ sessionId: session.id, phraseId: "opening" });
    }, 0);
    return () => {
      clearTimeout(timer);
      speech.stop();
    };
  }, [session.id]);
  async function startQuiz() {
    setBusy(true);
    setError("");
    speech.stop();
    try {
      const data = await api<{ session: GameSession }>(
        `/api/sessions/${session.id}/quiz`,
        json({}),
      );
      onSession(data.session);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kuis belum tersedia.");
    } finally {
      setBusy(false);
    }
  }
  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    await sendTurn(draft, raw);
  }
  async function sendTurn(text: string, rawTranscript = "") {
    text = text.trim();
    if (!text || sending.current) return;
    sending.current = true;
    setDraft(text);
    setRaw(rawTranscript);
    setBusy(true);
    setError("");
    speech.stop();
    if (!attempt.current || attempt.current.text !== text)
      attempt.current = { id: crypto.randomUUID(), text };
    try {
      const data = await api<{ session: GameSession; turn: Turn }>(
        `/api/sessions/${session.id}/turns`,
        json({
          id: attempt.current.id,
          text,
          rawTranscript: rawTranscript || undefined,
        }),
      );
      onSession(data.session);
      setDraft("");
      setRaw("");
      const newlyDone = lesson.objectives.filter(
        (item) =>
          data.session.completedObjectives.includes(item.id) &&
          !session.completedObjectives.includes(item.id),
      );
      const next = currentMission(lesson, data.session.completedObjectives);
      setNeedsDirection(!newlyDone.length && Boolean(next));
      setGuidanceNotice(
        newlyDone.length
          ? t(
              `Selesai: ${newlyDone.map((item) => item.title.id).join(", ")}.${next ? ` Berikutnya: ${next.title.id}.` : " Semua target tercapai."}`,
              `Completed: ${newlyDone.map((item) => item.title.en).join(", ")}.${next ? ` Up next: ${next.title.en}.` : " All goals completed."}`,
            )
          : t(
              "Target ini belum tercapai. Coba jawab sesuai arahan di atas.",
              "This goal is still open. Try responding to the directions above.",
            ),
      );
      attempt.current = null;
      if (!muted)
        void speech.play({ sessionId: session.id, turnId: data.turn.id });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Percakapan tersendat. Coba lagi.",
      );
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  async function repairReply(turnId: string) {
    if (busy) return;
    setBusy(true);
    setRepairingTurn(turnId);
    setError("");
    speech.stop();
    try {
      const data = await api<{ session: GameSession }>(
        `/api/sessions/${session.id}/repair-reply`,
        json({ turnId }),
      );
      onSession(data.session);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : t(
              "Balasan belum dapat diperbaiki. Coba lagi.",
              "Reply repair is unavailable. Try again.",
            ),
      );
    } finally {
      setBusy(false);
      setRepairingTurn(null);
    }
  }
  async function submitReport(e: React.FormEvent) {
    e.preventDefault();
    setReportBusy(true);
    try {
      await api(
        "/api/reports",
        json({
          sessionId: session.id,
          turnId: report || undefined,
          message: reportText,
        }),
      );
      setReportDone(true);
      setReportText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Laporan gagal dikirim.");
    } finally {
      setReportBusy(false);
    }
  }
  if (session.status === "completed" && session.result)
    return (
      <LessonResult
        session={session}
        locale={locale}
        busy={navigationBusy}
        onNext={onNext}
        onReplay={onReplay}
        onDone={onDone}
      />
    );
  if (session.quiz && session.quiz.length)
    return (
      <PracticeQuiz
        session={session}
        onSession={onSession}
        onPlayer={onPlayer}
        locale={locale}
        muted={muted}
        onExit={onExit}
        onToggleMute={onToggleMute}
      />
    );
  return (
    <div className="lesson-flow" ref={conversationView}>
      <div className="lesson-heading">
        <button
          className="text-link"
          onClick={() => {
            speech.stop();
            recorder.stop();
            onExit();
          }}
        >
          <ArrowLeft size={17} />
          {t("Kembali ke desa", "Back to village")}
        </button>
        <span className="lesson-saved">
          <span className="online-dot" />
          {t("Progres tersimpan otomatis", "Progress saves automatically")}
        </span>
      </div>
      <div className="play-grid">
        <section className={`scene-panel scene-${lesson.id}`}>
          <img
            className="scene-background"
            src="/images/desa-bali.webp"
            alt=""
          />
          <div className="scene-vignette" />
          <div className="scene-title">
            <span className="label-pill">
              {lesson.id === "boss"
                ? "BOSS LEVEL"
                : `${t("LOKASI", "LOCATION")} 0${lesson.number}`}
            </span>
            <h1>{lesson.title}</h1>
            <p>{lesson.subtitle[locale]}</p>
          </div>
          <div
            ref={speech.avatarRef}
            className={`scene-npc ${speech.speaking ? "speaking" : ""} ${recorder.recording ? "listening" : ""} ${busy || speech.loading ? "thinking" : ""}`}
          >
            <img src={portraits[lesson.id]} alt={lesson.npc} />

            <span className="npc-state">
              {speech.speaking ? (
                <>
                  <span className="voice-bars">
                    <i />
                    <i />
                    <i />
                  </span>
                  {t("Berbicara…", "Speaking…")}
                </>
              ) : recorder.recording ? (
                <>
                  <Mic size={14} />
                  {t("Mendengarkanmu", "Listening to you")}
                </>
              ) : recorder.transcribing || speech.loading || busy ? (
                <>
                  <LoaderCircle size={14} className="spin" />
                  {recorder.transcribing
                    ? t("Memahami ucapan…", "Transcribing…")
                    : speech.loading
                      ? t("Menyiapkan suara…", "Preparing audio…")
                      : t("Memikirkan jawaban…", "Thinking…")}
                </>
              ) : (
                <>
                  <span className="online-dot" />
                  {lesson.npc}
                </>
              )}
            </span>
          </div>
          <div className="scene-objects">
            {lesson.id === "warung" ? (
              ["☕", "🍚", "🥥"].map((item, i) => (
                <button
                  key={item}
                  className={selectedObject === item ? "selected" : ""}
                  onClick={() => setSelectedObject(item)}
                  aria-label={
                    [
                      t("Lihat teh", "Look at tea"),
                      t("Lihat nasi", "Look at rice"),
                      t("Lihat kelapa", "Look at coconut"),
                    ][i]
                  }
                >
                  {item}
                </button>
              ))
            ) : lesson.id === "pasar" ? (
              ["🍌", "🍊", "🥭"].map((item, i) => (
                <button
                  key={item}
                  className={selectedObject === item ? "selected" : ""}
                  onClick={() => setSelectedObject(item)}
                  aria-label={
                    [
                      t("Pilih pisang", "Choose bananas"),
                      t("Pilih jeruk", "Choose oranges"),
                      t("Pilih mangga", "Choose mangoes"),
                    ][i]
                  }
                >
                  {item}
                </button>
              ))
            ) : lesson.id === "kos" ? (
              <div className="intro-card">
                {lesson.objectives.map((o) => (
                  <span key={o.id}>
                    {session.completedObjectives.includes(o.id) ? (
                      <Check size={13} />
                    ) : (
                      <span className="tiny-dot" />
                    )}
                    {o.title[locale]}
                  </span>
                ))}
              </div>
            ) : (
              <span className="boss-scene-note">
                <Flag size={16} />
                {t(
                  "Sekarang giliranmu bercerita.",
                  "Now it is your turn to tell your story.",
                )}
              </span>
            )}
          </div>
          {selectedObject ? (
            <div className="object-hint">
              {selectedObject}{" "}
              {lesson.id === "pasar"
                ? t(
                    "Pilihanmu! Coba tanyakan harganya kepada pedagang.",
                    "Your choice! Ask the seller how much it costs.",
                  )
                : t(
                    "Ada di warung Men Sari. Mulai dengan menyapa, ya.",
                    "A little find at Men Sari’s warung. Start with a greeting.",
                  )}
              <button aria-label="Tutup" onClick={() => setSelectedObject("")}>
                <X size={13} />
              </button>
            </div>
          ) : null}
        </section>
        <section className="conversation-panel">
          <MissionGuide
            lesson={lesson}
            session={session}
            locale={locale}
            muted={muted}
            disabled={busy || recorder.recording || recorder.transcribing}
            onSession={onSession}
            onOpen={speech.stop}
            notice={guidanceNotice}
            showNotice={needsDirection}
            onExample={(text) => {
              setMode("text");
              setRaw("");
              setDraft(text);
              requestAnimationFrame(() =>
                document.getElementById("player-text")?.focus(),
              );
            }}
          />
          <div className="conversation-history" role="log" aria-live="polite">
            <div className="message npc-message">
              <div className="message-avatar">{lesson.npc.slice(0, 1)}</div>
              <div>
                <span className="speaker-name">{lesson.npc}</span>
                <div className="message-bubble">
                  <p>{lesson.opening}</p>
                  <span className="translation">
                    {lesson.openingTranslation[locale]}
                  </span>
                  <button
                    className="listen-btn"
                    onClick={() =>
                      speech.play({
                        sessionId: session.id,
                        phraseId: "opening",
                      })
                    }
                    disabled={speech.loading || muted}
                  >
                    <Volume2 size={14} />
                    {t("Dengarkan", "Listen")}
                  </button>
                </div>
              </div>
            </div>
            {session.turns.map((turn) => {
              const unavailable = replyNeedsRepair(turn);
              const readableCorrections =
                turn.corrections.filter(correctionIsReadable);
              return (
                <div className="turn-group" key={turn.id}>
                  <div className="message player-message">
                    <div>
                      <span className="speaker-name">{t("Kamu", "You")}</span>
                      <div className="message-bubble">
                        <p>{turn.playerText}</p>
                      </div>
                    </div>
                  </div>
                  <div className="message npc-message">
                    <div className="message-avatar">
                      {lesson.npc.slice(0, 1)}
                    </div>
                    <div>
                      <span className="speaker-name">{lesson.npc}</span>
                      <div
                        className={`message-bubble ${unavailable ? "reply-recovery" : ""}`}
                      >
                        {unavailable ? (
                          <>
                            <p>
                              {t(
                                "Balasan ini perlu diperbaiki.",
                                "This reply needs a correction.",
                              )}
                            </p>
                            <span className="translation">
                              {t(
                                "Ada tulisan yang tidak sesuai. Perbaiki balasan untuk membacanya.",
                                "Unexpected writing was found. Repair the reply to read it.",
                              )}
                            </span>
                            <button
                              className="btn subtle"
                              onClick={() => void repairReply(turn.id)}
                              disabled={busy}
                            >
                              {repairingTurn === turn.id ? (
                                <Spinner />
                              ) : (
                                <RotateCcw size={16} />
                              )}
                              {t("Perbaiki balasan", "Repair reply")}
                            </button>
                          </>
                        ) : (
                          <>
                            <p>{turn.reply}</p>
                            <span className="translation">
                              {turn.translation[locale]}
                            </span>
                            <div className="message-actions">
                              <button
                                className="listen-btn"
                                onClick={() =>
                                  speech.play({
                                    sessionId: session.id,
                                    turnId: turn.id,
                                  })
                                }
                                disabled={speech.loading || muted}
                              >
                                <Volume2 size={14} />
                                {t("Dengarkan", "Listen")}
                              </button>
                              <button
                                className="report-btn"
                                onClick={() => {
                                  setReport(turn.id);
                                  setReportDone(false);
                                }}
                                aria-label={t(
                                  "Laporkan jawaban",
                                  "Report response",
                                )}
                              >
                                <Flag size={12} />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                      {readableCorrections.length ? (
                        <details
                          className="correction-card"
                          open={turn.id === session.turns.at(-1)?.id}
                        >
                          <summary>
                            <Lightbulb size={15} />
                            {t("Catatan bahasa", "Language note")}
                            <span>{readableCorrections.length}</span>
                            <ChevronDown size={14} />
                          </summary>
                          {readableCorrections.map((c, i) => {
                            const source = corpus.find(
                              (e) => e.id === c.sourceId,
                            );
                            return (
                              <div
                                className="correction-item"
                                key={`${c.sourceId}-${i}`}
                              >
                                <div className="correction-before">
                                  {c.said}
                                </div>
                                <div className="correction-after">
                                  <Check size={13} />
                                  {c.correct}
                                </div>
                                <p>{c.reason[locale]}</p>
                                {!c.supported ? (
                                  <span className="advisory">
                                    {t(
                                      "Saran AI · tidak memengaruhi bintang",
                                      "AI suggestion · does not affect stars",
                                    )}
                                  </span>
                                ) : null}
                                {source ? (
                                  <a
                                    href={source.sourceUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    title={source.sourceTitle}
                                  >
                                    {t("Lihat sumber", "View source")}
                                    <ExternalLink size={11} />
                                  </a>
                                ) : null}
                              </div>
                            );
                          })}
                        </details>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
            {busy && draft && !repairingTurn ? (
              <div className="message player-message pending-message">
                <div className="message-bubble">
                  <p>{draft}</p>
                  <small>{t("Mengirim…", "Sending…")}</small>
                </div>
              </div>
            ) : null}
            {busy ? (
              <div className="thinking-bubble">
                <span />
                <span />
                <span />
                <small>
                  {repairingTurn
                    ? t("Memperbaiki balasan…", "Repairing reply…")
                    : completed
                      ? t(
                          "Menyiapkan kuis dari percakapanmu…",
                          "Preparing a quiz from your conversation…",
                        )
                      : t(
                          `${lesson.npc} sedang berpikir…`,
                          `${lesson.npc} is thinking…`,
                        )}
                </small>
              </div>
            ) : null}
            <div ref={bottom} />
          </div>
          <div className="composer">
            {error || recorder.error ? (
              <div className="inline-error" role="alert">
                {error || recorder.error}
              </div>
            ) : null}
            {speech.error ? (
              <p className="audio-notice">{speech.error}</p>
            ) : null}
            {completed ? (
              <div className="mission-complete">
                <Check size={21} />
                <span>
                  {t("Percakapan selesai.", "Conversation complete.")}
                </span>
                <button
                  className="btn primary"
                  onClick={startQuiz}
                  disabled={busy || speech.loading || speech.speaking}
                >
                  {busy ? <Spinner /> : t("Buka kuis", "Open quiz")}
                </button>
              </div>
            ) : (
              <>
                <div className="composer-tools">
                  <div className="input-mode">
                    <button
                      className={mode === "voice" ? "active" : ""}
                      aria-pressed={mode === "voice"}
                      onClick={() => setMode("voice")}
                      disabled={
                        recorder.recording || recorder.transcribing || busy
                      }
                    >
                      <Mic size={14} />
                      {t("Bicara", "Speak")}
                    </button>
                    <button
                      className={mode === "text" ? "active" : ""}
                      aria-pressed={mode === "text"}
                      onClick={() => setMode("text")}
                      disabled={recorder.recording}
                    >
                      <Keyboard size={14} />
                      {t("Ketik", "Type")}
                    </button>
                  </div>
                  {lesson.id === "boss" ? (
                    <span className="boss-label">
                      {t("Tanpa contoh ucapan", "No example hints")}
                    </span>
                  ) : null}
                </div>
                {mode === "voice" && (!draft || busy) ? (
                  <div className="voice-mode-panel">
                    <label className="voice-review">
                      <input
                        type="checkbox"
                        checked={reviewVoice}
                        onChange={(e) => setReviewVoice(e.target.checked)}
                      />
                      {t(
                        "Periksa transkrip sebelum dikirim",
                        "Review transcript before sending",
                      )}
                    </label>
                    <div className="voice-composer">
                      <button
                        className={`record-button ${recorder.recording ? "recording" : ""}`}
                        onClick={() => {
                          speech.stop();
                          recorder.recording
                            ? recorder.stop()
                            : void recorder.start();
                        }}
                        disabled={busy || recorder.transcribing}
                        aria-label={
                          recorder.recording
                            ? t("Selesai merekam", "Stop recording")
                            : t("Mulai merekam", "Start recording")
                        }
                      >
                        {recorder.transcribing ? (
                          <Spinner />
                        ) : recorder.recording ? (
                          <Square size={21} fill="currentColor" />
                        ) : (
                          <Mic size={24} />
                        )}
                      </button>
                      <div>
                        <strong>
                          {recorder.recording
                            ? `${t("Sedang merekam", "Recording")} · ${recorder.seconds}s`
                            : recorder.transcribing
                              ? t(
                                  "Mendengarkan rekamanmu…",
                                  "Transcribing your recording…",
                                )
                              : t(
                                  "Tekan, lalu mulai bicara",
                                  "Tap, then start speaking",
                                )}
                        </strong>
                        <p>
                          {recorder.recording
                            ? t(
                                "Kirim otomatis setelah jeda. Tekan lagi untuk selesai lebih cepat.",
                                "Sends after a pause. Tap again to finish sooner.",
                              )
                            : t(
                                "Ucapan langsung dikirim dan balasan diputar otomatis.",
                                "Your words are sent and replies play automatically.",
                              )}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={send}>
                    <label className="composer-label" htmlFor="player-text">
                      {raw
                        ? t(
                            "Periksa ucapanmu sebelum dikirim",
                            "Check your words before sending",
                          )
                        : t(
                            "Apa yang ingin kamu katakan?",
                            "What would you like to say?",
                          )}
                    </label>
                    <div className="text-composer">
                      <textarea
                        id="player-text"
                        rows={2}
                        maxLength={500}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            void send();
                          }
                        }}
                        placeholder={t(
                          "Tulis dalam Basa Bali…",
                          "Write in Balinese…",
                        )}
                        disabled={busy}
                      />
                      <button
                        className="send-button"
                        disabled={busy || !draft.trim()}
                        aria-label={t("Kirim ucapan", "Send message")}
                      >
                        {busy ? <Spinner /> : <Send size={18} />}
                      </button>
                    </div>
                    {raw ? (
                      <button
                        type="button"
                        className="text-link rerecord"
                        onClick={() => {
                          setDraft("");
                          setRaw("");
                        }}
                      >
                        <RotateCcw size={13} />
                        {t("Rekam ulang", "Record again")}
                      </button>
                    ) : null}
                  </form>
                )}
              </>
            )}
            <div className="composer-disclosure">
              <ShieldSmall />
              {t(
                "Balasan dan suara dibantu AI.",
                "AI-assisted replies and voices.",
              )}
            </div>
          </div>
        </section>
      </div>
      {report !== null ? (
        <Modal
          title={t("Bantu kami belajar", "Help us improve")}
          onClose={() => setReport(null)}
        >
          {reportDone ? (
            <div className="report-success">
              <Check size={32} />
              <h3>
                {t("Suksma atas masukannya.", "Thank you for your feedback.")}
              </h3>
              <button className="btn primary" onClick={() => setReport(null)}>
                {t("Kembali ngobrol", "Back to the conversation")}
              </button>
            </div>
          ) : (
            <form className="form-stack" onSubmit={submitReport}>
              <p>
                {t(
                  "Bagian mana yang kurang tepat? Laporan disimpan bersama konteks percakapan ini.",
                  "What seems incorrect? Your report is saved with this conversation context.",
                )}
              </p>
              <label>
                {t("Masukanmu", "Your feedback")}
                <textarea
                  rows={4}
                  value={reportText}
                  onChange={(e) => setReportText(e.target.value)}
                  required
                  maxLength={1000}
                />
              </label>
              <button className="btn primary" disabled={reportBusy}>
                {reportBusy ? <Spinner /> : t("Kirim masukan", "Send feedback")}
              </button>
            </form>
          )}
        </Modal>
      ) : null}
    </div>
  );
}
function ShieldSmall() {
  return <span className="tiny-dot" />;
}
