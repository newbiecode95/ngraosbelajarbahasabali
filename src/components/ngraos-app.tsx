"use client";
import { useCallback, useEffect, useState, useRef, useId } from "react";
import {
  Map,
  BookOpen,
  Route,
  Settings,
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  Flame,
  Sparkles,
  Sprout,
  Compass,
  Volume2,
  VolumeX,
  Menu,
  X,
  LockKeyhole,
  Star,
  ChevronRight,
  LogOut,
  ShieldCheck,
  Flower2,
  Coffee,
  House,
  ShoppingBasket,
  Flag,
  CircleHelp,
  Check,
  Globe2,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { lessons } from "@/content/lessons";
import { corpus } from "@/content/corpus";
import type { GameSession, Lesson, LevelId, Locale, Player } from "@/lib/types";
import { api, json } from "@/lib/client-api";
import { Brand, EmptyState, Modal, Spinner, Stars } from "./ui";
import { primeSpeechAudio } from "./use-audio";
import { LessonPlayer } from "./lesson-player";
import { useBackgroundMusic, useMusicScene } from "./background-music";
import { ProgressPath } from "./progress-path";
import { useEntryJourney } from "./entry-journey";
import { AdminPanel } from "./admin-panel";
type Screen = "map" | "album" | "journey" | "sources" | "profile" | "admin";
const iconByLevel = {
  warung: Coffee,
  kos: House,
  pasar: ShoppingBasket,
  boss: Flag,
};
const artByLevel = {
  warung: "/images/sari.webp",
  kos: "/images/komang.webp",
  pasar: "/images/pedagang.webp",
  boss: "/images/wayan.webp",
};
export function NgraosApp() {
  const { villageReady } = useEntryJourney();
  const [locale, setLocale] = useState<Locale>("id"),
    [player, setPlayer] = useState<Player | null>(null),
    [aiReady, setAiReady] = useState(true),
    [ready, setReady] = useState(false),
    [screen, setScreen] = useState<Screen>("map"),
    [selected, setSelected] = useState<LevelId>("warung"),
    [session, setSession] = useState<GameSession | null>(null),
    [auth, setAuth] = useState(false),
    [help, setHelp] = useState(false),
    [mobileMenu, setMobileMenu] = useState(false),
    [reduced, setReduced] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [toast, setToast] = useState("");
  const [smallScreen, setSmallScreen] = useState(false);
  const [characterSpeaking, setCharacterSpeaking] = useState(false);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const { muted, setMuted, setGameActive } = useBackgroundMusic();
  useMusicScene(Boolean(session));
  useEffect(() => {
    if (ready) villageReady();
  }, [ready, villageReady]);
  const locationChosen = useRef(false);
  const navigation = useRef<HTMLElement | null>(null);
  const menuButton = useRef<HTMLButtonElement | null>(null);
  const content = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const mq = window.matchMedia("(max-width:760px)");
    const update = () => {
      setSmallScreen(mq.matches);
      if (!mq.matches) setMobileMenu(false);
    };
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!mobileMenu) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    navigation.current?.querySelector("button")?.focus();
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileMenu(false);
        requestAnimationFrame(() => menuButton.current?.focus());
      }
    };
    document.addEventListener("keydown", escape);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", escape);
    };
  }, [mobileMenu]);
  function chooseLocation(id: LevelId) {
    locationChosen.current = true;
    setSelected(id);
    if (smallScreen)
      requestAnimationFrame(() =>
        document.querySelector(`[data-level-id="${id}"]`)?.scrollIntoView({
          behavior: reduced ? "instant" : "smooth",
          block: "start",
        }),
      );
  }
  const t = (id: string, en: string) => (locale === "id" ? id : en);
  const refresh = useCallback(async () => {
    try {
      const data = await api<{ player: Player | null; aiReady: boolean }>(
        "/api/player",
      );
      setPlayer(data.player);
      setAiReady(data.aiReady);
      if (data.player) {
        setLocale(data.player.locale);
        if (!locationChosen.current)
          setSelected(
            lessons.find((item) => !data.player!.stars[item.id])?.id || "boss",
          );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tidak terhubung.");
    } finally {
      setReady(true);
    }
  }, []);
  useEffect(() => {
    void refresh();
    try {
      const stored = localStorage.getItem("ngraos-preferences");
      if (stored) {
        const value = JSON.parse(stored);
        setReduced(Boolean(value.reduced));
        if (value.locale === "en") setLocale("en");
      }
    } catch {}
    setPreferencesLoaded(true);
  }, [refresh]);
  useEffect(() => {
    if (!preferencesLoaded) return;
    document.documentElement.lang = locale;
    document.documentElement.dataset.reduced = String(reduced);
    try {
      localStorage.setItem(
        "ngraos-preferences",
        JSON.stringify({ muted, reduced, locale }),
      );
    } catch {}
  }, [muted, reduced, locale, preferencesLoaded]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  const lesson = lessons.find((l) => l.id === selected) || lessons[0];
  function unlocked(id: LevelId) {
    const index = lessons.findIndex((l) => l.id === id);
    return index === 0 || Boolean(player?.stars[lessons[index - 1]?.id]);
  }
  const nextLesson = lessons.find((l) => !player?.stars[l.id]) || lessons[0];
  async function changeLocale() {
    const next = locale === "id" ? "en" : "id";
    setLocale(next);
    if (player)
      try {
        await api("/api/player", {
          method: "PATCH",
          body: JSON.stringify({ locale: next }),
        });
      } catch {
        setToast(
          t(
            "Bahasa berubah di perangkat ini. Sinkronisasi belum berhasil.",
            "Language changed on this device. Sync unavailable.",
          ),
        );
      }
  }
  async function begin(l: Lesson) {
    primeSpeechAudio();
    if (!player) {
      setAuth(true);
      return;
    }
    if (!unlocked(l.id)) {
      setToast(
        t(
          "Selesaikan lokasi sebelumnya untuk membuka tempat ini.",
          "Complete the previous location to unlock this one.",
        ),
      );
      return;
    }
    setBusy(true);
    setGameActive(true);
    setError("");
    try {
      const result = await api<{ session: GameSession }>(
        "/api/sessions",
        json({ levelId: l.id }),
      );
      setSession(result.session);
      setSelected(l.id);
    } catch (e) {
      setGameActive(Boolean(session));
      setError(e instanceof Error ? e.message : "Gagal memulai.");
    } finally {
      setBusy(false);
    }
  }
  async function resume() {
    primeSpeechAudio();
    if (!player?.activeSessionId) return;
    setBusy(true);
    setGameActive(true);
    try {
      const data = await api<{ session: GameSession }>(
        `/api/sessions/${player.activeSessionId}`,
      );
      setSession(data.session);
      setSelected(data.session.levelId);
    } catch (e) {
      setGameActive(Boolean(session));
      setError(e instanceof Error ? e.message : "Sesi tidak tersedia.");
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    try {
      if (player?.isDemo) await api("/api/demo/exit", json({}));
      else await api("/api/auth/sign-out", json({}));
      setSession(null);
      await refresh();
      setScreen("map");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  function navigate(value: Screen) {
    window.scrollTo({ top: 0, behavior: "instant" });
    setScreen(value);
    setSession(null);
    setMobileMenu(false);
    setError("");
    requestAnimationFrame(() =>
      content.current?.focus({ preventScroll: true }),
    );
  }
  const nav = [
    { id: "map" as const, icon: Map, label: t("Petualangan", "Adventure") },
    {
      id: "album" as const,
      icon: BookOpen,
      label: t("Album Desa", "Village album"),
    },
    {
      id: "journey" as const,
      icon: Route,
      label: t("Perjalananku", "My journey"),
    },
    {
      id: "sources" as const,
      icon: Sprout,
      label: t("Sumber belajar", "Learning sources"),
    },
  ];
  return (
    <div
      className={`app-shell ${session ? "in-lesson" : ""} ${session?.status === "quiz" ? "in-quiz" : ""} ${session?.status === "completed" ? "in-results" : ""} ${!session && screen === "map" ? "on-map" : ""} ${reduced ? "reduce-motion" : ""}`}
    >
      <aside
        id="village-navigation"
        aria-label={t("Menu desa", "Village menu")}
        ref={navigation}
        onKeyDown={(e) => {
          if (!smallScreen || !mobileMenu || e.key !== "Tab") return;
          const buttons = Array.from(
            navigation.current?.querySelectorAll<HTMLButtonElement>(
              "button:not(:disabled)",
            ) || [],
          );
          const first = buttons[0],
            last = buttons.at(-1);
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }}
        inert={smallScreen && !mobileMenu}
        className={`sidebar ${mobileMenu ? "open" : ""}`}
      >
        <div className="sidebar-brand">
          <button
            className="unstyled"
            onClick={() => navigate("map")}
            aria-label="Ngraos beranda"
          >
            <Brand />
          </button>
          <button
            className="icon-btn mobile-only"
            onClick={() => {
              setMobileMenu(false);
              requestAnimationFrame(() => menuButton.current?.focus());
            }}
            aria-label={t("Tutup menu", "Close menu")}
          >
            <X />
          </button>
        </div>
        <div className="sidebar-tagline">Dari Tamiu jadi Nyama.</div>
        <div className="sidebar-label">
          {t("RUANG BELAJARMU", "YOUR LEARNING SPACE")}
        </div>
        <nav aria-label={t("Navigasi utama", "Main navigation")}>
          {nav.map((item) => (
            <button
              key={item.id}
              aria-current={screen === item.id && !session ? "page" : undefined}
              className={`nav-item ${screen === item.id && !session ? "active" : ""}`}
              onClick={() => navigate(item.id)}
            >
              <item.icon size={20} />
              {item.label}
              {screen === item.id && !session ? (
                <span className="nav-dot" />
              ) : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="journey-note">
            <Flower2 size={28} />
            <p>
              {t("Latihan singkat,", "A short practice,")}
              <br />
              <strong>{t("setiap hari.", "every day.")}</strong>
            </p>
            <span>
              {t("Mulai dari satu sapaan.", "Start with a greeting.")}
            </span>
          </div>
          <button
            className={`nav-item ${screen === "profile" && !session ? "active" : ""}`}
            aria-current={screen === "profile" && !session ? "page" : undefined}
            onClick={() => navigate("profile")}
          >
            <Settings size={20} />
            {t("Pengaturan", "Settings")}
          </button>
          {player?.isAdmin ? (
            <button className="nav-item" onClick={() => navigate("admin")}>
              <ShieldCheck size={20} />
              Admin
            </button>
          ) : null}
          <button className="nav-item" onClick={() => setHelp(true)}>
            <CircleHelp size={20} />
            {t("Cara bermain", "How to play")}
          </button>
          <div className="sidebar-footer">
            <span className="online-dot" />{" "}
            {t("Belajar Basa Bali", "Learn Balinese")}
          </div>
        </div>
      </aside>
      {mobileMenu ? (
        <button
          className="sidebar-scrim"
          aria-hidden="true"
          tabIndex={-1}
          onClick={() => {
            setMobileMenu(false);
            requestAnimationFrame(() => menuButton.current?.focus());
          }}
        />
      ) : null}
      <div className="main-shell" inert={smallScreen && mobileMenu}>
        <header className="topbar">
          <div className="topbar-left">
            <button
              ref={menuButton}
              className="icon-btn mobile-only"
              onClick={() => (session ? navigate("map") : setMobileMenu(true))}
              aria-expanded={session ? undefined : mobileMenu}
              aria-controls={session ? undefined : "village-navigation"}
              aria-label={
                session
                  ? t("Kembali ke desa", "Back to village")
                  : t("Buka menu", "Open menu")
              }
            >
              {session ? <ArrowLeft /> : <Menu />}
            </button>
            {session ? (
              <div
                className={`conversation-identity mobile-only ${characterSpeaking ? "speaking" : ""}`}
              >
                <img src={artByLevel[session.levelId]} alt="" />
                <div>
                  <strong>
                    {lessons.find((l) => l.id === session.levelId)?.npc}
                    {characterSpeaking ? (
                      <span className="speaking-indicator" role="status">
                        {t("Berbicara", "Speaking")}
                      </span>
                    ) : null}
                  </strong>
                  <h1>
                    {lessons.find((l) => l.id === session.levelId)?.title}
                  </h1>
                </div>
              </div>
            ) : (
              <button
                className="mobile-brand mobile-only unstyled"
                onClick={() => navigate("map")}
                aria-label={t("Ngraos beranda", "Ngraos home")}
              >
                <Brand small />
              </button>
            )}
            <span className="breadcrumb">
              {t("Desa Kenderan", "Kenderan Village")}
              <ChevronRight size={14} />
              <strong>
                {session
                  ? lessons.find((l) => l.id === session.levelId)?.title
                  : nav.find((n) => n.id === screen)?.label ||
                    t("Pengaturan", "Settings")}
              </strong>
            </span>
          </div>
          <div className="topbar-right">
            <span
              className="stat-pill streak"
              aria-label={`${player?.streak || 0} ${t("hari berturut-turut", "day streak")}`}
            >
              <Flame size={17} />
              {player?.streak || 0}
              <span>{t("hari", "days")}</span>
            </span>
            <span className="stat-pill xp">
              <Sparkles size={17} />
              {player?.xp || 0}
              <span>XP</span>
            </span>
            <button
              className="language-btn"
              onClick={changeLocale}
              aria-label={t("Switch to English", "Ganti ke Bahasa Indonesia")}
            >
              <Globe2 size={16} />
              {locale.toUpperCase()}
            </button>
            <button
              className="icon-btn sound-btn"
              onClick={() => setMuted(!muted)}
              data-music-action="mute"
              aria-pressed={!muted}
              aria-label={
                muted
                  ? t("Aktifkan suara", "Enable sound")
                  : t("Matikan suara", "Mute sound")
              }
            >
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            {player ? (
              <button
                className="avatar"
                onClick={() => navigate("profile")}
                aria-label={t("Buka profil", "Open profile")}
              >
                {player.name.slice(0, 1).toUpperCase()}
                <span />
              </button>
            ) : (
              <button className="btn login-btn" onClick={() => setAuth(true)}>
                {t("Masuk", "Sign in")}
                <ArrowUpRight size={15} />
              </button>
            )}
          </div>
        </header>
        <main
          ref={content}
          tabIndex={-1}
          className="main-content"
          id="main-content"
        >
          {error ? (
            <div className="error-banner" role="alert">
              {error}
              <button
                className="icon-btn"
                onClick={() => setError("")}
                aria-label="Tutup"
              >
                <X size={16} />
              </button>
            </div>
          ) : null}
          {player?.isDemo ? (
            <div className="demo-strip">
              <span>
                <Sparkles size={14} />
                {t(
                  "Mode demo • Progres terpisah dari akun pribadi",
                  "Demo mode • Progress is separate from your account",
                )}
              </span>
              <button onClick={() => setAuth(true)}>
                {t("Simpan dengan akun", "Create your account")}
                <ArrowRight size={13} />
              </button>
            </div>
          ) : null}
          {session ? (
            <LessonPlayer
              key={session.id}
              session={session}
              onSession={setSession}
              locale={locale}
              muted={muted}
              onSpeaking={setCharacterSpeaking}
              navigationBusy={busy}
              onToggleMute={() => setMuted(!muted)}
              onNext={(id) =>
                void begin(lessons.find((item) => item.id === id)!)
              }
              onReplay={() =>
                void begin(lessons.find((item) => item.id === session.levelId)!)
              }
              onDone={async () => {
                setSession(null);
                await refresh();
              }}
              onPlayer={setPlayer}
              onExit={() => {
                setSession(null);
                void refresh();
              }}
            />
          ) : (
            <>
              {screen === "map" ? (
                <>
                  <section className="page-heading">
                    <div>
                      <div className="eyebrow">
                        <span /> {t("BABAK 01 · RAUH", "CHAPTER 01 · RAUH")}
                      </div>
                      <h1>
                        {t("Ayo latihan", "Let’s practise")}{" "}
                        <em>{t("Basa Bali.", "Balinese.")}</em>
                      </h1>
                      <p>
                        {t(
                          "Pilih lokasi, temui warga, dan mulai percakapan.",
                          "Choose a location, meet a neighbour, and start talking.",
                        )}
                      </p>
                    </div>
                    <div className="chapter-progress">
                      <div className="chapter-progress-ring">
                        <span>
                          {
                            Object.values(player?.stars || {}).filter(Boolean)
                              .length
                          }
                          <small>/ 4</small>
                        </span>
                      </div>
                      <span>{t("lokasi dijelajahi", "places explored")}</span>
                    </div>
                  </section>
                  <ProgressPath
                    player={player}
                    selected={selected}
                    locale={locale}
                    busy={busy || !ready}
                    onSelect={chooseLocation}
                    onStart={(l) => void begin(l)}
                    onResume={() => void resume()}
                  />
                  <div className="adventure-grid">
                    <section
                      className="village-panel"
                      aria-label={t(
                        "Peta interaktif Desa Kenderan",
                        "Interactive Kenderan Village map",
                      )}
                    >
                      <details className="map-disclosure" open={!smallScreen}>
                        <summary>
                          <Map size={18} />
                          {t(
                            "Lihat peta Desa Kenderan",
                            "See the Kenderan Village map",
                          )}
                          <ChevronRight size={16} />
                        </summary>
                        <div className="map-topline">
                          <span className="map-title">
                            <span className="online-dot" />
                            {t("DESA KENDERAN", "KENDERAN VILLAGE")}
                          </span>
                          <span className="map-weather">
                            ☀{" "}
                            <span>
                              {t("Pagi di Kenderan", "Morning in Kenderan")}
                            </span>
                          </span>
                        </div>
                        <div className="village-map">
                          <img
                            className="village-art"
                            src="/images/desa-bali.webp"
                            alt={t(
                              "Ilustrasi desa Bali dengan warung, rumah kos, pasar, dan aliran sungai",
                              "Illustrated Balinese village with a warung, guesthouse, market, and stream",
                            )}
                            fetchPriority="high"
                          />
                          <div className="map-cloud cloud-one" />
                          <div className="map-cloud cloud-two" />
                          {lessons.map((l, i) => (
                            <button
                              key={l.id}
                              className={`map-marker marker-${l.id} ${selected === l.id ? "selected" : ""} ${unlocked(l.id) ? "available" : "locked"}`}
                              onClick={() => chooseLocation(l.id)}
                              aria-pressed={selected === l.id}
                              aria-label={`${l.title}, ${unlocked(l.id) ? t("terbuka", "unlocked") : t("terkunci", "locked")}`}
                            >
                              <span className="marker-dot">
                                {unlocked(l.id) ? (
                                  player?.stars[l.id] ? (
                                    <Check size={19} />
                                  ) : (
                                    i + 1
                                  )
                                ) : (
                                  <LockKeyhole size={15} />
                                )}
                              </span>
                              <span className="marker-label">
                                {l.title}
                                {selected === l.id ? (
                                  <ChevronRight size={13} />
                                ) : null}
                              </span>
                              {selected === l.id ? (
                                <span className="marker-here">
                                  {t("Jelajahi di sini", "Explore here")}
                                </span>
                              ) : null}
                            </button>
                          ))}
                          <span className="map-compass">
                            <Compass size={33} strokeWidth={1.2} />
                            <small>U</small>
                          </span>
                          <span className="map-caption">
                            {t(
                              "Pilih penanda untuk melihat lokasi.",
                              "Select a marker to explore a location.",
                            )}
                          </span>
                        </div>
                        <div className="map-bottom">
                          <span>
                            <span className="legend-dot green" />
                            {t("Siap dijelajahi", "Ready to explore")}
                          </span>
                          <span>
                            <span className="legend-dot pale" />
                            {t(
                              "Selesaikan lokasi sebelumnya",
                              "Complete the previous location",
                            )}
                          </span>
                          <span className="map-bottom-end">
                            <Sprout size={14} />
                            {t(
                              "Petualanganmu dimulai di sini",
                              "Your adventure starts here",
                            )}
                          </span>
                        </div>
                      </details>
                    </section>
                    <aside className="mission-panel">
                      <div className="mission-kicker">
                        <span className="label-pill">
                          {lesson.id === "boss"
                            ? t("TANTANGAN BABAK", "CHAPTER CHALLENGE")
                            : `${t("LOKASI", "LOCATION")} 0${lesson.number}`}
                        </span>
                        <Stars count={player?.stars[lesson.id] || 0} />
                      </div>
                      <div className={`npc-preview npc-${lesson.id}`}>
                        <div className="npc-halo" />
                        <img src={artByLevel[lesson.id]} alt={lesson.npc} />
                        <span className="npc-speech">
                          {lesson.id === "warung"
                            ? "Om Swastiastu!"
                            : lesson.id === "kos"
                              ? "Rahajeng rauh!"
                              : lesson.id === "pasar"
                                ? "Aji kuda?"
                                : t("Siap, Nyama?", "Ready, Nyama?")}
                        </span>
                        <span className="npc-flower">
                          <Flower2 size={24} />
                        </span>
                      </div>
                      <div className="mission-copy">
                        <h2>{lesson.title}</h2>
                        <p>{lesson.description[locale]}</p>
                        <div className="mission-meta">
                          <span>
                            <span className="tiny-dot" />
                            3–5 {t("menit", "min")}
                          </span>
                          <span>+50 XP</span>
                          <span>{t("Pemula", "Beginner")}</span>
                        </div>
                        <div className="mission-objectives">
                          <h3>
                            {t(
                              "DI SINI KAMU AKAN BELAJAR",
                              "HERE YOU WILL LEARN",
                            )}
                          </h3>
                          {lesson.objectives.map((o) => (
                            <div key={o.id}>
                              <span className="objective-check">
                                <Check size={12} />
                              </span>
                              {o.title[locale]}
                            </div>
                          ))}
                        </div>
                        <button
                          className={`btn primary full ${!unlocked(lesson.id) ? "locked-btn" : ""}`}
                          disabled={
                            busy ||
                            !ready ||
                            (!unlocked(lesson.id) && Boolean(player))
                          }
                          onClick={() => begin(lesson)}
                          data-music-action="game"
                        >
                          {busy ? (
                            <Spinner />
                          ) : unlocked(lesson.id) ? (
                            <>
                              {t("Mulai ngobrol", "Let’s talk")}
                              <ArrowRight size={18} />
                            </>
                          ) : (
                            <>
                              <LockKeyhole size={16} />
                              {t(
                                "Selesaikan lokasi sebelumnya",
                                "Complete the previous location",
                              )}
                            </>
                          )}
                        </button>
                        <p className="mission-footnote">
                          <ShieldCheck size={13} />
                          {t(
                            "Bisa dengan suara atau ketikan.",
                            "Speak or type. Your choice.",
                          )}
                        </p>
                      </div>
                    </aside>
                  </div>
                  <section className="path-section">
                    <div className="section-heading">
                      <h2>{t("Tempat latihan", "Practice locations")}</h2>
                      <span>
                        {t(
                          "Empat lokasi untuk pemula",
                          "Four beginner locations",
                        )}
                        <ArrowUpRight size={16} />
                      </span>
                    </div>
                    <div className="location-grid">
                      {lessons.map((l) => {
                        const Icon = iconByLevel[l.id];
                        return (
                          <button
                            key={l.id}
                            onClick={() => setSelected(l.id)}
                            className={`location-card ${selected === l.id ? "selected" : ""} ${!unlocked(l.id) ? "locked" : ""}`}
                          >
                            <span className={`location-icon ${l.id}`}>
                              <Icon size={22} />
                            </span>
                            <span className="location-info">
                              <small>
                                {l.id === "boss"
                                  ? "BOSS LEVEL"
                                  : `${t("LOKASI", "LOCATION")} 0${l.number}`}
                              </small>
                              <strong>{l.title}</strong>
                              <span>{l.subtitle[locale]}</span>
                            </span>
                            {player?.stars[l.id] ? (
                              <span className="location-earned">
                                <Star size={13} fill="currentColor" />
                                {player.stars[l.id]}
                              </span>
                            ) : unlocked(l.id) ? (
                              <ArrowUpRight size={17} />
                            ) : (
                              <LockKeyhole size={14} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                  <section className="daily-banner">
                    <span className="daily-icon">
                      <Flame size={27} />
                    </span>
                    <div>
                      <h3>
                        {player?.activeSessionId
                          ? t("Lanjutkan latihanmu.", "Continue your lesson.")
                          : t(
                              "Punya lima menit? Ayo latihan.",
                              "Have five minutes? Let’s practise.",
                            )}
                      </h3>
                      <p>
                        {player?.activeSessionId
                          ? t(
                              "Lanjutkan percakapan terakhir dari tempat kamu berhenti.",
                              "Pick up your last conversation right where you left off.",
                            )
                          : t(
                              player?.streak
                                ? "Selesaikan satu latihan lagi untuk menambah XP."
                                : "Selesaikan satu latihan untuk memulai streak harian.",
                              player?.streak
                                ? "Complete another lesson to earn more XP."
                                : "Complete a lesson to start your daily streak.",
                            )}
                      </p>
                    </div>
                    <button
                      className="btn subtle"
                      data-music-action="game"
                      onClick={() =>
                        player?.activeSessionId ? resume() : begin(nextLesson)
                      }
                      disabled={busy}
                    >
                      {player?.activeSessionId
                        ? t("Lanjutkan", "Continue")
                        : t("Ayo mulai", "Let’s begin")}
                      <ArrowRight size={16} />
                    </button>
                  </section>
                </>
              ) : null}
              {screen === "album" ? (
                <>
                  <PageTitle
                    eyebrow={t("KOLEKSI KARTU", "CARD COLLECTION")}
                    title={t("Album Desa", "Village album")}
                    description={t(
                      "Kartu yang kamu dapatkan setelah menyelesaikan setiap lokasi.",
                      "Cards you earn by completing each location.",
                    )}
                  />
                  <div className="album-grid">
                    {lessons.map((l) => (
                      <article
                        className={`album-card ${player?.albums.includes(l.id) ? "" : "sealed"}`}
                        key={l.id}
                      >
                        <div className={`album-art ${l.id}`}>
                          <img src="/images/desa-bali.webp" alt="" />
                          <span>
                            {player?.albums.includes(l.id) ? (
                              <Flower2 size={32} />
                            ) : (
                              <LockKeyhole size={28} />
                            )}
                          </span>
                        </div>
                        <div>
                          <span className="eyebrow">{l.title}</span>
                          <h2>{l.album.title[locale]}</h2>
                          <p>
                            {player?.albums.includes(l.id)
                              ? l.album.text[locale]
                              : t(
                                  "Selesaikan lokasi ini untuk membuka kisahnya.",
                                  "Complete this location to reveal its story.",
                                )}
                          </p>
                          <button
                            className="text-link"
                            onClick={() => {
                              setSelected(l.id);
                              navigate("map");
                            }}
                          >
                            {t("Kunjungi lokasi", "Visit location")}
                            <ArrowRight size={15} />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </>
              ) : null}
              {screen === "journey" ? (
                <>
                  <PageTitle
                    eyebrow={t("DARI TAMIU JADI NYAMA", "FROM GUEST TO FAMILY")}
                    title={t("Progres belajar", "Your progress")}
                    description={t(
                      "Lihat bintang, XP, dan lokasi yang sudah kamu selesaikan.",
                      "See your stars, XP, and completed locations.",
                    )}
                  />
                  <div className="journey-summary">
                    <div>
                      <Sparkles />
                      <strong>{player?.xp || 0}</strong>
                      <span>Total XP</span>
                    </div>
                    <div>
                      <Flame />
                      <strong>{player?.streak || 0}</strong>
                      <span>{t("Hari berturut-turut", "Day streak")}</span>
                    </div>
                    <div>
                      <Star />
                      <strong>
                        {Object.values(player?.stars || {}).reduce(
                          (s, n) => s + (n || 0),
                          0,
                        )}
                        <small>/12</small>
                      </strong>
                      <span>{t("Bintang terkumpul", "Stars earned")}</span>
                    </div>
                  </div>
                  <div className="journey-list">
                    {lessons.map((l) => (
                      <div key={l.id}>
                        <span className="journey-number">{l.number}</span>
                        <div>
                          <h3>{l.title}</h3>
                          <p>{l.subtitle[locale]}</p>
                        </div>
                        <Stars count={player?.stars[l.id] || 0} />
                        <button
                          className="btn subtle"
                          disabled={!unlocked(l.id)}
                          onClick={() => begin(l)}
                          data-music-action="game"
                        >
                          {player?.stars[l.id]
                            ? t("Main lagi", "Play again")
                            : t("Mulai", "Start")}
                          <ArrowRight size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                  {!player ? (
                    <p className="note">
                      {t(
                        "Masuk untuk menyimpan perjalananmu di semua perangkat.",
                        "Sign in to save your journey across devices.",
                      )}
                    </p>
                  ) : null}
                </>
              ) : null}
              {screen === "sources" ? <Sources locale={locale} /> : null}
              {screen === "profile" ? (
                <Profile
                  player={player}
                  locale={locale}
                  muted={muted}
                  reduced={reduced}
                  onMute={() => setMuted(!muted)}
                  onReduce={() => setReduced(!reduced)}
                  onLocale={changeLocale}
                  onAuth={() => setAuth(true)}
                  onRefresh={refresh}
                  onLogout={logout}
                  setToast={setToast}
                />
              ) : null}
              {screen === "admin" && player?.isAdmin ? (
                <AdminPanel locale={locale} />
              ) : null}
            </>
          )}
        </main>
        <footer className="main-footer">
          <Brand small />
          <span>
            {t(
              "Latihan Basa Bali di Desa Kenderan.",
              "Practise Balinese in Kenderan Village.",
            )}
          </span>
          <button onClick={() => navigate("sources")}>
            {t("Sumber & privasi", "Sources & privacy")}
            <ArrowUpRight size={12} />
          </button>
        </footer>
        {!session ? (
          <nav
            className="mobile-dock"
            aria-label={t("Navigasi cepat", "Quick navigation")}
          >
            {[
              { id: "map" as const, label: t("Peta", "Map"), icon: Map },
              {
                id: "sources" as const,
                label: t("Kosakata", "Vocabulary"),
                icon: BookOpen,
              },
              {
                id: "profile" as const,
                label: t("Profil", "Profile"),
                icon: Settings,
              },
            ].map((item) => (
              <button
                key={item.id}
                aria-current={screen === item.id ? "page" : undefined}
                onClick={() => navigate(item.id)}
              >
                <item.icon size={22} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        ) : null}
      </div>
      {toast ? (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
          <button
            className="icon-btn"
            aria-label="Tutup"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      ) : null}
      {auth ? (
        <AuthModal
          locale={locale}
          onClose={() => setAuth(false)}
          onSuccess={async () => {
            setAuth(false);
            await refresh();
            setToast(
              t(
                "Rahajeng rauh! Selamat datang di Desa Kenderan.",
                "Rahajeng rauh! Welcome to Kenderan Village.",
              ),
            );
          }}
        />
      ) : null}
      {help ? (
        <Modal
          title={t("Cara bermain", "How to play")}
          onClose={() => setHelp(false)}
        >
          <div className="help-steps">
            {[
              [
                t("Pilih tempat", "Pick a place"),
                t(
                  "Temui warga dan lihat target percakapannya.",
                  "Meet a neighbour and check your conversation goals.",
                ),
              ],
              [
                t("Bicara atau ketik", "Speak or type"),
                t(
                  "Tekan mikrofon dan bicara. Setelah jeda, ucapan dikirim dan balasan diputar otomatis. Kamu juga bisa mengetik.",
                  "Tap the microphone and speak. After a pause, your words are sent and the reply plays automatically. Typing is also available.",
                ),
              ],
              [
                t("Belajar dari percakapanmu", "Learn from your conversation"),
                t(
                  "Lihat catatan bahasa dan sumbernya, lalu kerjakan kuis dari percakapanmu.",
                  "Read the language notes and their sources, then take a quiz based on your conversation.",
                ),
              ],
              [
                t("Simpan progresmu", "Save your progress"),
                t(
                  "Kumpulkan bintang, buka album, dan lanjutkan ke tetangga berikutnya.",
                  "Earn stars, open album stories, and meet your next neighbour.",
                ),
              ],
            ].map(([title, body], i) => (
              <div key={title}>
                <span>{i + 1}</span>
                <section>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </section>
              </div>
            ))}
          </div>
          <p className="note">
            {t(
              "Materi dan suara dibuat dengan AI berbasis sumber. Koreksi bisa keliru; gunakan tombol laporkan untuk memberi masukan.",
              "Learning material and voices are AI-generated with sources. Corrections can be wrong; use report to share feedback.",
            )}
          </p>
          <button className="btn primary full" onClick={() => setHelp(false)}>
            {t("Siap menjelajah", "Ready to explore")}
            <ArrowRight size={17} />
          </button>
        </Modal>
      ) : null}
    </div>
  );
}
function PageTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <section className="page-heading">
      <div>
        <div className="eyebrow">
          <span />
          {eyebrow}
        </div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </section>
  );
}
function AuthModal({
  locale,
  onClose,
  onSuccess,
}: {
  locale: Locale;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}) {
  const t = (a: string, b: string) => (locale === "id" ? a : b);
  const [mode, setMode] = useState<"demo" | "login" | "signup">("demo"),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (mode === "demo")
        await api("/api/demo", json({ name: name || "Tamiu", locale }));
      else {
        await api(
          `/api/auth/${mode === "login" ? "sign-in" : "sign-up"}/email`,
          json({ email, password, ...(mode === "signup" ? { name } : {}) }),
        );
        await api("/api/demo/exit", json({}));
      }
      await onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tidak dapat masuk.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <Modal title={t("Rahajeng rauh!", "Rahajeng rauh!")} onClose={onClose}>
      <p className="modal-intro">
        {t(
          "Masuk untuk menyimpan progres, atau coba dulu dengan demo.",
          "Sign in to save your progress, or try the demo first.",
        )}
      </p>
      <div className="segmented">
        {(["demo", "login", "signup"] as const).map((v) => (
          <button
            className={mode === v ? "active" : ""}
            onClick={() => {
              setMode(v);
              setError("");
            }}
            key={v}
          >
            {v === "demo"
              ? t("Coba demo", "Try demo")
              : v === "login"
                ? t("Masuk", "Sign in")
                : t("Daftar", "Sign up")}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="form-stack">
        {mode !== "login" ? (
          <label>
            {t("Nama panggilan", "Your name")}
            <input
              autoComplete="nickname"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required={mode === "signup"}
              maxLength={40}
              placeholder={t("Panggil aku…", "Call me…")}
            />
          </label>
        ) : null}
        {mode !== "demo" ? (
          <>
            <label>
              Email
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="kamu@email.com"
              />
            </label>
            <label>
              {t("Kata sandi", "Password")}
              <input
                type="password"
                autoComplete={
                  mode === "signup" ? "new-password" : "current-password"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={10}
                placeholder={t("Minimal 10 karakter", "At least 10 characters")}
              />
            </label>
          </>
        ) : (
          <div className="info-box">
            <Sparkles size={20} />
            <p>
              {t(
                "Jelajahi dengan profil demo pribadi. Progres demo tersimpan di browser ini dan bisa direset.",
                "Explore with your own demo profile. Demo progress stays linked to this browser and can be reset.",
              )}
            </p>
          </div>
        )}
        {error ? (
          <p className="inline-error" role="alert">
            {error}
          </p>
        ) : null}
        <button className="btn primary full" disabled={loading}>
          {loading ? (
            <Spinner />
          ) : (
            <>
              {mode === "login"
                ? t("Masuk ke desa", "Enter the village")
                : t("Mulai belajar", "Start learning")}
              <ArrowRight size={17} />
            </>
          )}
        </button>
        <p className="form-disclosure">
          {t(
            "Dengan melanjutkan, Anda memahami bahwa suara dan transkrip diproses melalui OpenRouter dan penyedia AI. Rekaman tidak disimpan permanen oleh Ngraos.",
            "By continuing, you understand that audio and transcripts are processed through OpenRouter and AI providers. Ngraos does not permanently store your recordings.",
          )}
        </p>
      </form>
    </Modal>
  );
}
function Sources({ locale }: { locale: Locale }) {
  const [search, setSearch] = useState("");
  const t = (a: string, b: string) => (locale === "id" ? a : b);
  const filtered = corpus
    .filter((e) => e.status !== "draft")
    .filter((e) =>
      `${e.bali} ${e.indonesia} ${e.english}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
  return (
    <>
      <PageTitle
        eyebrow={t("BELAJAR DENGAN RUJUKAN", "LEARNING WITH REFERENCES")}
        title={t("Kamus & sumber belajar", "Dictionary & learning sources")}
        description={t(
          "Cari arti kata dan lihat sumber materi Ngraos. Materi disusun dan diperiksa dengan AI; belum diperiksa ahli bahasa.",
          "Find word meanings and sources used in Ngraos. Material is prepared and reviewed with AI; it has not been reviewed by a language expert.",
        )}
      />
      <div className="sources-intro">
        <ShieldCheck size={28} />
        <div>
          <h3>{t("Tentang materi", "About the material")}</h3>
          <p>
            {t(
              "Entri kamus menyimpan tautan sumber dan lisensi. Contoh percakapan dibuat untuk pembelajaran. Saran tanpa dukungan sumber tidak mengurangi bintangmu.",
              "Dictionary entries retain source links and licenses. Conversation examples are written for learning. Unsupported suggestions do not reduce your stars.",
            )}
          </p>
        </div>
      </div>
      <div className="source-toolbar">
        <h2>
          {t("Kamus desa", "Village dictionary")}{" "}
          <span>{corpus.filter((e) => e.status !== "draft").length}</span>
        </h2>
        <input
          type="search"
          placeholder={t(
            "Cari kata Bali, Indonesia, atau Inggris…",
            "Search Balinese, Indonesian, or English…",
          )}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label={t("Cari kamus", "Search dictionary")}
        />
      </div>
      <p className="search-count" role="status">
        {search.trim()
          ? t(
              `${filtered.length} kata ditemukan`,
              `${filtered.length} words found`,
            )
          : t(
              "Cari dalam bahasa Bali, Indonesia, atau Inggris.",
              "Search in Balinese, Indonesian, or English.",
            )}
      </p>
      {!filtered.length ? (
        <EmptyState
          title={t("Kata belum ditemukan", "No matching words")}
          description={t(
            "Coba ejaan lain atau cari artinya dalam bahasa Indonesia.",
            "Try a different spelling or search for its meaning in English.",
          )}
        >
          <button className="btn subtle" onClick={() => setSearch("")}>
            {t("Lihat semua kata", "Show all words")}
          </button>
        </EmptyState>
      ) : null}
      <div className="dictionary-grid">
        {filtered.slice(0, 60).map((entry) => (
          <article className="dictionary-entry" key={entry.id}>
            <div>
              <h3>{entry.bali}</h3>
              <span className="register-tag">
                {entry.register === "unknown"
                  ? t("Belum ditentukan", "Unspecified register")
                  : entry.register}
              </span>
            </div>
            <p>{locale === "id" ? entry.indonesia : entry.english}</p>
            <a href={entry.sourceUrl} target="_blank" rel="noreferrer">
              {entry.sourceTitle}
              <ExternalLink size={12} />
            </a>
            <small>
              {entry.license} ·{" "}
              {entry.status === "ai-reviewed"
                ? t("Diperiksa AI", "AI reviewed")
                : t("Bersumber", "Sourced")}
            </small>
          </article>
        ))}
      </div>
      {filtered.length > 60 ? (
        <p className="note">
          {t(
            "Menampilkan 60 hasil pertama. Gunakan pencarian untuk menemukan kata lain.",
            "Showing the first 60 results. Search to find more words.",
          )}
        </p>
      ) : null}
      <section className="privacy-card">
        <h2>{t("Privasi", "Privacy")}</h2>
        <p>
          {t(
            "Ngraos menyimpan akun, transkrip, koreksi, dan progres untuk melanjutkan pembelajaran. Rekaman diproses sementara, lalu dibuang. OpenRouter meneruskan permintaan ke penyedia model; retensi layanan mengikuti kebijakan mereka. Suara karakter dibuat AI. Anda dapat menghapus akun dan riwayat melalui Pengaturan.",
            "Ngraos stores your account, transcripts, corrections, and progress so you can continue learning. Recordings are processed temporarily and discarded. OpenRouter forwards requests to model providers; their retention policies apply. Character voices are AI-generated. You can delete your account and history in Settings.",
          )}
        </p>
        <a
          href="https://openrouter.ai/privacy"
          target="_blank"
          rel="noreferrer"
        >
          {t("Kebijakan OpenRouter", "OpenRouter privacy policy")}
          <ExternalLink size={13} />
        </a>
      </section>
    </>
  );
}
function Profile({
  player,
  locale,
  muted,
  reduced,
  onMute,
  onReduce,
  onLocale,
  onAuth,
  onRefresh,
  onLogout,
  setToast,
}: {
  player: Player | null;
  locale: Locale;
  muted: boolean;
  reduced: boolean;
  onMute: () => void;
  onReduce: () => void;
  onLocale: () => void;
  onAuth: () => void;
  onRefresh: () => Promise<void>;
  onLogout: () => Promise<void>;
  setToast: (s: string) => void;
}) {
  const t = (a: string, b: string) => (locale === "id" ? a : b);
  const [name, setName] = useState(player?.name || ""),
    [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/player", {
        method: "PATCH",
        body: JSON.stringify({ name }),
      });
      await onRefresh();
      setToast(t("Profil disimpan.", "Profile saved."));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal.");
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    try {
      if (player?.isDemo) await api("/api/demo", { method: "DELETE" });
      else await api("/api/player", { method: "DELETE" });
      await onRefresh();
      setConfirm(false);
      setToast(t("Data berhasil dihapus.", "Your data has been deleted."));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow={t("PROFIL & PREFERENSI", "PROFILE & PREFERENCES")}
        title={t("Pengaturan", "Settings")}
        description={t(
          "Ubah profil, bahasa, suara, dan animasi.",
          "Change your profile, language, audio, and motion settings.",
        )}
      />
      <div className="settings-grid">
        <section className="settings-card">
          <h2>{t("Profil pemain", "Player profile")}</h2>
          {player ? (
            <form className="form-stack" onSubmit={save}>
              <span className="profile-avatar">{player.name.slice(0, 1)}</span>
              <label>
                {t("Nama panggilan", "Your name")}
                <input
                  value={name}
                  maxLength={40}
                  required
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <p className="note">
                {player.isDemo
                  ? t(
                      "Profil demo · hanya perangkat ini",
                      "Demo profile · this device",
                    )
                  : player.email}
              </p>
              <button className="btn primary" disabled={busy}>
                {busy ? <Spinner /> : t("Simpan profil", "Save profile")}
              </button>
            </form>
          ) : (
            <EmptyState
              title={t("Selamat datang, Tamiu.", "Welcome, Tamiu.")}
              description={t(
                "Mulai dengan demo atau buat akun untuk menyimpan progres.",
                "Try the demo or create an account to save progress.",
              )}
            >
              <button className="btn primary" onClick={onAuth}>
                {t("Mulai di sini", "Start here")}
              </button>
            </EmptyState>
          )}
        </section>
        <section className="settings-card">
          <h2>{t("Pengalaman belajar", "Learning experience")}</h2>
          <Setting
            title={t("Bahasa antarmuka", "Interface language")}
            detail={locale === "id" ? "Bahasa Indonesia" : "English"}
            onClick={onLocale}
            value={locale.toUpperCase()}
          />
          <Setting
            title={t("Suara & musik latar", "Voice & background music")}
            detail={t(
              "Musik di desa, suara karakter saat mengobrol",
              "Village music and character voices during conversations",
            )}
            onClick={onMute}
            value={muted ? t("Mati", "Off") : t("Aktif", "On")}
            checked={!muted}
          />
          <Setting
            title={t("Kurangi animasi", "Reduce motion")}
            detail={t(
              "Gerakan yang lebih tenang",
              "A calmer visual experience",
            )}
            onClick={onReduce}
            value={reduced ? t("Aktif", "On") : t("Mati", "Off")}
            checked={reduced}
          />
          <p className="note">
            {t(
              "Pergantian hari untuk streak mengikuti WITA (UTC+8).",
              "Daily streaks follow Bali time (UTC+8).",
            )}
          </p>
        </section>
      </div>
      {error ? (
        <p role="alert" className="inline-error">
          {error}
        </p>
      ) : null}
      {player ? (
        <div className="account-actions">
          <button className="btn subtle" onClick={onLogout}>
            <LogOut size={16} />
            {t("Keluar", "Sign out")}
          </button>
          <button className="text-link danger" onClick={() => setConfirm(true)}>
            {player.isDemo
              ? t("Reset demo", "Reset demo")
              : t("Hapus akun & riwayat", "Delete account & history")}
          </button>
        </div>
      ) : null}
      {confirm ? (
        <Modal
          title={
            player?.isDemo
              ? t("Mulai demo dari awal?", "Start the demo again?")
              : t("Hapus akun ini?", "Delete this account?")
          }
          onClose={() => setConfirm(false)}
        >
          <p>
            {t(
              "Tindakan ini menghapus progres dan riwayat percakapan. Data yang dihapus tidak dapat dikembalikan.",
              "This removes your progress and conversation history. Deleted data cannot be recovered.",
            )}
          </p>
          <div className="modal-actions">
            <button className="btn subtle" onClick={() => setConfirm(false)}>
              {t("Batal", "Cancel")}
            </button>
            <button className="btn danger-btn" disabled={busy} onClick={remove}>
              {busy ? <Spinner /> : t("Ya, hapus", "Yes, delete")}
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
function Setting({
  title,
  detail,
  onClick,
  value,
  checked,
}: {
  title: string;
  detail: string;
  onClick: () => void;
  value: string;
  checked?: boolean;
}) {
  const labelId = useId();
  const detailId = useId();
  return (
    <div className="setting-row">
      <div>
        <strong id={labelId}>{title}</strong>
        <p id={detailId}>{detail}</p>
      </div>
      <button
        className="setting-toggle"
        onClick={onClick}
        aria-labelledby={labelId}
        aria-describedby={detailId}
        role={checked === undefined ? undefined : "switch"}
        aria-checked={checked}
      >
        {value}
      </button>
    </div>
  );
}
