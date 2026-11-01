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
import { lessons } from "@/content/lessons";
import { corpus } from "@/content/corpus";
import type {
  GameSession,
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
}: {
  session: GameSession;
  onSession: (s: GameSession) => void;
  locale: Locale;
  muted: boolean;
  onDone: () => void;
  onExit: () => void;
  onPlayer: (p: Player) => void;
  onSpeaking?: (speaking: boolean) => void;
}) {
  const lesson = lessons.find((l) => l.id === session.levelId)!;
  const t = (a: string, b: string) => (locale === "id" ? a : b);
  const [draft, setDraft] = useState(""),
    [raw, setRaw] = useState(""),
    [mode, setMode] = useState<"voice" | "text">("voice"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [hint, setHint] = useState(""),
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
  const isConversation = session.status !== "completed" && !session.quiz?.length;
  useEffect(() => {
    onSpeaking?.(speech.speaking);
    return () => onSpeaking?.(false);
  }, [speech.speaking, onSpeaking]);

  useEffect(() => {
    const history = bottom.current?.parentElement;
    if (history)
      history.scrollTo({ top: history.scrollHeight, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.reduced === "true" ? "instant" : "smooth" });
  }, [session.turns.length, busy]);
  useEffect(() => {
    const viewport = window.visualViewport;
    const update = () => {
      const height = viewport?.height || window.innerHeight;
      conversationView.current?.style.setProperty("--lesson-viewport", `${height}px`);
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
      setHint("");
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
  async function getHint() {
    setBusy(true);
    setError("");
    try {
      const data = await api<{ hint: string; session: GameSession }>(
        `/api/sessions/${session.id}/hint`,
        json({}),
      );
      setHint(data.hint);
      onSession(data.session);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Petunjuk tidak tersedia.");
    } finally {
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
      const data = await api<{ session: GameSession }>(`/api/sessions/${session.id}/repair-reply`, json({ turnId }));
      onSession(data.session);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Balasan belum dapat diperbaiki. Coba lagi.", "Reply repair is unavailable. Try again."));
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
      <div className="result-card">
        <span className="result-flower">
          <Flower2 size={46} />
        </span>
        <div className="eyebrow">{t("LATIHAN SELESAI", "LESSON COMPLETE")}</div>
        <h1>{t("Suksma, Nyama!", "Suksma, Nyama!")}</h1>
        <p>{t("Progresmu sudah disimpan.", "Your progress has been saved.")}</p>
        <Stars count={session.result.stars} size={42} />
        <div className="result-stats">
          <div>
            <Sparkles size={21} />
            <strong>+{session.result.xp}</strong>
            <span>XP</span>
          </div>
          <div>
            <Check size={21} />
            <strong>
              {session.result.quizScore}/{session.result.quizTotal}
            </strong>
            <span>{t("Jawaban benar", "Correct answers")}</span>
          </div>
          <div>
            <BookOpen size={21} />
            <strong>{session.result.newAlbum ? "+1" : "✓"}</strong>
            <span>{t("Kartu budaya", "Culture card")}</span>
          </div>
        </div>
        <div className="result-album">
          <Flower2 size={30} />
          <div>
            <small>{t("DARI ALBUM DESA", "FROM YOUR VILLAGE ALBUM")}</small>
            <h3>{lesson.album.title[locale]}</h3>
            <p>{lesson.album.text[locale]}</p>
          </div>
        </div>
        <button className="btn primary" onClick={onDone}>
          {t("Kembali ke desa", "Back to the village")}
          <ArrowRight size={18} />
        </button>
        <span className="note">
          {t(
            "Progres dan bintang terbaikmu sudah disimpan.",
            "Your progress and best stars have been saved.",
          )}
        </span>
      </div>
    );
  if (session.quiz && session.quiz.length)
    return (
      <QuizPlayer
        session={session}
        onSession={onSession}
        onPlayer={onPlayer}
        locale={locale}
        muted={muted}
        onExit={onExit}
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
          <details className="mission-tracker">
            <summary>
              <span className="eyebrow">
                {completed ? t("Semua target tercapai", "All goals completed") : t("Target percakapan", "Conversation goals")}
              </span>
              <strong>
                {session.completedObjectives.length}/{lesson.objectives.length}
              </strong>
              <ChevronDown size={16} />
            </summary>
            <div className="mission-track-items">
              {lesson.objectives.map((o) => (
                <span
                  key={o.id}
                  className={
                    session.completedObjectives.includes(o.id) ? "done" : ""
                  }
                >
                  {session.completedObjectives.includes(o.id) ? (
                    <Check size={12} />
                  ) : (
                    <span />
                  )}
                  {o.title[locale]}
                </span>
              ))}
            </div>
            <div className="track-line">
              <span
                style={{
                  width: `${(session.completedObjectives.length / lesson.objectives.length) * 100}%`,
                }}
              />
            </div>
          </details>
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
              const readableCorrections = turn.corrections.filter(correctionIsReadable);
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
                  <div className="message-avatar">{lesson.npc.slice(0, 1)}</div>
                  <div>
                    <span className="speaker-name">{lesson.npc}</span>
                    <div className={`message-bubble ${unavailable ? "reply-recovery" : ""}`}>
                      {unavailable ? (
                        <>
                          <p>{t("Balasan ini perlu diperbaiki.", "This reply needs a correction.")}</p>
                          <span className="translation">{t("Ada tulisan yang tidak sesuai. Perbaiki balasan untuk membacanya.", "Unexpected writing was found. Repair the reply to read it.")}</span>
                          <button className="btn subtle" onClick={() => void repairReply(turn.id)} disabled={busy}>
                            {repairingTurn === turn.id ? <Spinner /> : <RotateCcw size={16} />}
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
                          aria-label={t("Laporkan jawaban", "Report response")}
                        >
                          <Flag size={12} />
                        </button>
                      </div>
                        </>
                      )}
                    </div>
                    {readableCorrections.length ? (
                      <details className="correction-card">
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
                              <div className="correction-before">{c.said}</div>
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
                                >
                                  {source.sourceTitle}
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
                  {repairingTurn ? t("Memperbaiki balasan…", "Repairing reply…") : completed
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
            {hint ? (
              <div className="hint-box">
                <Lightbulb size={16} />
                <span>{hint}</span>
              </div>
            ) : null}
            {completed ? (
              <div className="mission-complete">
                <Check size={21} />
                <span>
                  {t(
                    "Percakapan selesai.",
                    "Conversation complete.",
                  )}
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
                  {lesson.id !== "boss" ? (
                    <button
                      className="hint-btn"
                      onClick={getHint}
                      disabled={busy}
                    >
                      <Lightbulb size={14} />
                      {t("Petunjuk", "Hint")}
                    </button>
                  ) : (
                    <span className="boss-label">
                      {t("Tanpa petunjuk", "No hints")}
                    </span>
                  )}
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
function QuizPlayer({
  session,
  onSession,
  onPlayer,
  locale,
  muted,
  onExit,
}: {
  session: GameSession;
  onSession: (s: GameSession) => void;
  onPlayer: (p: Player) => void;
  locale: Locale;
  muted: boolean;
  onExit: () => void;
}) {
  const questions = session.quiz!;
  const [index, setIndex] = useState(0),
    [answers, setAnswers] = useState<Record<string, string>>({}),
    [selectedWords, setSelectedWords] = useState<number[]>([]),
    [typed, setTyped] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const t = (a: string, b: string) => (locale === "id" ? a : b);
  const q = questions[index];
  const speech = useSpeech(muted);
  const recorder = useRecorder(session.levelId, (_r, n) => setTyped(n));
  const current =
    q.type === "order"
      ? selectedWords.map((i) => q.words?.[i]).join(" ")
      : q.type === "repeat"
        ? typed
        : answers[q.id] || "";

  const restored = useRef(false);
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("ngraos-quiz-" + session.id);
      if (saved) {
        const value = JSON.parse(saved);
        if (
          Number.isInteger(value.index) &&
          value.index >= 0 &&
          value.index < questions.length
        ) {
          setIndex(value.index);
          setAnswers(value.answers || {});
          setTyped(value.typed || "");
          setSelectedWords(
            Array.isArray(value.selectedWords) ? value.selectedWords : [],
          );
        }
      }
    } catch {}
    restored.current = true;
  }, [session.id, questions.length]);
  useEffect(() => {
    if (restored.current)
      try {
        sessionStorage.setItem(
          "ngraos-quiz-" + session.id,
          JSON.stringify({ index, answers, typed, selectedWords }),
        );
      } catch {}
  }, [session.id, index, answers, typed, selectedWords]);
  useEffect(() => {
    if (q.type === "repeat" && !muted)
      void speech.play({ sessionId: session.id, phraseId: q.id });
    return () => speech.stop();
  }, [q.id]);
  async function next() {
    if (
      !current.trim() ||
      (q.type === "order" && selectedWords.length !== q.words?.length)
    )
      return;
    const result = { ...answers, [q.id]: current };
    setAnswers(result);
    speech.stop();
    if (index < questions.length - 1) {
      setIndex(index + 1);
      setSelectedWords([]);
      setTyped("");
      setError("");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const data = await api<{ session: GameSession; player: Player }>(
        `/api/sessions/${session.id}/complete`,
        json({ answers: result }),
      );
      sessionStorage.removeItem("ngraos-quiz-" + session.id);
      onSession(data.session);
      onPlayer(data.player);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Hasil belum tersimpan. Coba lagi.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="quiz-container">
      <div className="lesson-heading">
        <button className="text-link" onClick={onExit}>
          <ArrowLeft size={17} />
          {t("Kembali ke desa", "Back to village")}
        </button>
        <span className="label-pill">{t("KUIS LATIHAN", "PRACTICE QUIZ")}</span>
      </div>
      <div className="quiz-progress">
        <div role="progressbar" aria-label={t("Soal selesai", "Questions completed")} aria-valuemin={0} aria-valuemax={questions.length} aria-valuenow={index}>
          <span style={{ width: `${(index / questions.length) * 100}%` }} />
        </div>
        <strong>
          {index + 1}
          <span> / {questions.length}</span>
        </strong>
      </div>
      <section className="quiz-card">
        <span className={`quiz-type-icon ${q.type}`}>
          {q.type === "choice" ? (
            <Sparkles size={29} />
          ) : q.type === "order" ? (
            <BookOpen size={29} />
          ) : (
            <Volume2 size={29} />
          )}
        </span>
        <div className="eyebrow">
          {q.reinforcement
            ? t("LATIHAN PENGUATAN", "A LITTLE REINFORCEMENT")
            : t("DARI PERCAKAPANMU", "FROM YOUR CONVERSATION")}
        </div>
        <h1>{q.prompt[locale]}</h1>
        <p className="quiz-instruction">
          {q.type === "choice"
            ? t("Pilih jawaban yang paling tepat.", "Choose the best answer.")
            : q.type === "order"
              ? t(
                  "Ketuk kata untuk menyusun kalimat. Ketuk lagi untuk mengembalikan.",
                  "Tap words to build the sentence. Tap them again to undo.",
                )
              : t(
                  "Dengarkan lalu ucapkan atau ketik kembali.",
                  "Listen, then repeat by speaking or typing.",
                )}
        </p>
        {q.type === "choice" ? (
          <div className="quiz-options">
            {q.options?.map((option, i) => (
              <button
                key={`${option}-${i}`}
                className={answers[q.id] === option ? "selected" : ""}
                aria-pressed={answers[q.id] === option}
                onClick={() => setAnswers({ ...answers, [q.id]: option })}
              >
                <span>{String.fromCharCode(65 + i)}</span>
                {option}
                {answers[q.id] === option ? <Check size={20} /> : null}
              </button>
            ))}
          </div>
        ) : null}
        {q.type === "order" ? (
          <>
            <div
              className="word-answer"
              aria-label={t("Kalimat tersusun", "Your sentence")}
            >
              {selectedWords.length ? (
                selectedWords.map((wordIndex, i) => (
                  <button
                    key={`${wordIndex}-${i}`}
                    onClick={() =>
                      setSelectedWords(selectedWords.filter((_, n) => i !== n))
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
            <div className="word-bank">
              {q.words?.map((word, i) => (
                <button
                  key={`${word}-${i}`}
                  disabled={selectedWords.includes(i)}
                  onClick={() => setSelectedWords([...selectedWords, i])}
                >
                  {word}
                </button>
              ))}
            </div>
          </>
        ) : null}
        {q.type === "repeat" ? (
          <div className="repeat-question">
            <button
              className="btn audio-play"
              onClick={() =>
                speech.play({ sessionId: session.id, phraseId: q.id })
              }
              disabled={speech.loading || muted}
            >
              {speech.loading ? <Spinner /> : <Volume2 size={22} />}{" "}
              {t("Dengarkan kalimat", "Listen to the phrase")}
            </button>
            {muted ? (
              <p className="note">
                {t(
                  "Suara dimatikan. Aktifkan dari tombol suara di atas.",
                  "Sound is muted. Enable it using the sound button above.",
                )}
              </p>
            ) : null}
            <details className="repeat-transcript">
              <summary>
                {t(
                  "Lihat teks untuk aksesibilitas",
                  "Show text for accessibility",
                )}
              </summary>
              <p>{q.target}</p>
            </details>
            <div className="repeat-input">
              <button
                className={`record-button ${recorder.recording ? "recording" : ""}`}
                onClick={() => {
                  speech.stop();
                  recorder.recording ? recorder.stop() : void recorder.start();
                }}
                disabled={recorder.transcribing}
                aria-label={
                  recorder.recording ? "Stop recording" : "Start recording"
                }
              >
                {recorder.transcribing ? (
                  <Spinner />
                ) : recorder.recording ? (
                  <Square size={18} />
                ) : (
                  <Mic size={21} />
                )}
              </button>
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={t(
                  "Hasil ucapanmu, atau ketik di sini…",
                  "Your transcript, or type here…",
                )}
                aria-label={t("Jawaban ulang-ucap", "Repeat answer")}
              />
            </div>
            <p className="note">
              {t(
                "Periksa transkrip sebelum melanjutkan. Pelafalan tidak dinilai.",
                "Check the transcript before continuing. Pronunciation is not scored.",
              )}
            </p>
          </div>
        ) : null}
        {error || recorder.error ? (
          <p className="inline-error" role="alert">
            {error || recorder.error}
          </p>
        ) : null}
        {speech.error ? <p className="audio-notice">{speech.error}</p> : null}
        <div className="quiz-footer">
          <span>
            {t(
              "Jawab semua soal untuk melihat hasil.",
              "Answer every question to see your results.",
            )}
          </span>
          <button
            className="btn primary"
            onClick={next}
            disabled={
              !current.trim() ||
              (q.type === "order" &&
                selectedWords.length !== q.words?.length) ||
              busy ||
              recorder.recording ||
              recorder.transcribing
            }
          >
            {busy ? (
              <Spinner />
            ) : (
              <>
                {index === questions.length - 1
                  ? t("Lihat hasil", "See results")
                  : t("Lanjutkan", "Continue")}
                <ArrowRight size={17} />
              </>
            )}
          </button>
        </div>
      </section>
    </div>
  );
}
