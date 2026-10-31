"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowRight,
  BookOpen,
  Compass,
  Globe2,
  MapPin,
  Mic,
  Sparkles,
} from "lucide-react";
import { Brand } from "./ui";
import { primeSpeechAudio } from "./use-audio";
import type { Locale } from "@/lib/types";

export function WelcomeScreen() {
  const router = useRouter();
  const [quiet, setQuiet] = useState(false);
  const [ready, setReady] = useState(false);
  const [locale, setLocale] = useState<Locale>("id"),
    [entering, setEntering] = useState(false);
  const scene = useRef<HTMLDivElement | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    started = useRef(false);
  const t = (id: string, en: string) => (locale === "id" ? id : en);
  useEffect(() => {
    // Next can preserve this page when navigating back. Restore its entry state.
    started.current = false;
    setEntering(false);
    setReady(true);
    scene.current?.classList.remove("welcome--reduced");
    router.prefetch("/desa");
    try {
      const preferences = JSON.parse(
        localStorage.getItem("ngraos-preferences") || "{}",
      );
      setQuiet(Boolean(preferences.reduced));
      if (preferences.locale === "en") setLocale("en");
    } catch {}
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [router]);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  function language() {
    const next = locale === "id" ? "en" : "id";
    setLocale(next);
    try {
      const stored = JSON.parse(
        localStorage.getItem("ngraos-preferences") || "{}",
      );
      localStorage.setItem(
        "ngraos-preferences",
        JSON.stringify({ ...stored, locale: next }),
      );
    } catch {}
  }
  function begin() {
    if (!ready || started.current) return;
    started.current = true;
    primeSpeechAudio();
    setEntering(true);
    let reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    try {
      reduce =
        reduce ||
        Boolean(
          JSON.parse(localStorage.getItem("ngraos-preferences") || "{}")
            .reduced,
        );
    } catch {}
    scene.current?.style.setProperty(
      "--entry-duration",
      reduce ? "140ms" : "1400ms",
    );
    if (reduce) scene.current?.classList.add("welcome--reduced");
    timer.current = setTimeout(() => router.push("/desa"), reduce ? 120 : 1300);
  }
  const steps = [
    {
      icon: Compass,
      title: t("Pilih lokasi", "Pick a place"),
      text: t(
        "Temui warga di warung, kos, dan pasar.",
        "Meet the neighbours at the warung, guesthouse, and market.",
      ),
    },
    {
      icon: Mic,
      title: t("Mulai ngobrol", "Start talking"),
      text: t(
        "Bicara atau ketik. Dengarkan balasan mereka.",
        "Speak or type, then listen to their reply.",
      ),
    },
    {
      icon: BookOpen,
      title: t("Selesaikan kuis", "Make it stick"),
      text: t(
        "Latih yang baru dipelajari, lalu buka lokasi berikutnya.",
        "Practise what you learned and unlock the next location.",
      ),
    },
  ];
  return (
    <div
      ref={scene}
      className={`welcome ${entering ? "welcome--entering" : ""} ${quiet ? "welcome--quiet" : ""}`}
      aria-busy={entering || !ready}
      onPointerMove={(e) => {
        if (
          !entering &&
          !quiet &&
          window.matchMedia(
            "(pointer:fine) and (prefers-reduced-motion:no-preference)",
          ).matches
        ) {
          e.currentTarget.style.setProperty(
            "--drift-x",
            `${(e.clientX / window.innerWidth - 0.5) * -12}px`,
          );
          e.currentTarget.style.setProperty(
            "--drift-y",
            `${(e.clientY / window.innerHeight - 0.5) * -8}px`,
          );
        }
      }}
      onPointerLeave={(e) => {
        e.currentTarget.style.setProperty("--drift-x", "0px");
        e.currentTarget.style.setProperty("--drift-y", "0px");
      }}
    >
      <picture className="welcome__picture">
        <source
          media="(max-width:760px)"
          srcSet="/images/welcome-kenderan-mobile.webp"
        />
        <img
          src="/images/welcome-kenderan.webp"
          alt=""
          fetchPriority="high"
          decoding="async"
        />
      </picture>
      <div className="welcome__shade" />
      <div className="welcome__grain" aria-hidden="true" />
      <div className="welcome__lights" aria-hidden="true">
        {[8, 18, 27, 40, 52, 67, 83, 92].map((x, i) => (
          <span
            key={x}
            style={{
              left: `${x}%`,
              bottom: `${12 + ((i * 11) % 58)}%`,
              animationDelay: `${i * -0.8}s`,
            }}
          />
        ))}
      </div>
      <header className="welcome__header">
        <Brand />
        <span className="welcome__location">
          <MapPin size={14} />
          Desa Kenderan, Bali
        </span>
        <button
          className="welcome__language"
          onClick={language}
          disabled={entering || !ready}
          aria-label={t("Switch to English", "Ganti ke Bahasa Indonesia")}
        >
          <Globe2 size={16} />
          {locale.toUpperCase()}
        </button>
      </header>
      <main id="main-content" className="welcome__main" tabIndex={-1}>
        <section className="welcome__intro" aria-labelledby="welcome-title">
          <div className="welcome__eyebrow">
            <span />
            {t("RAHAJENG RAUH", "WELCOME TO KENDERAN")}
            <span />
          </div>
          <h1 id="welcome-title">
            Dari Tamiu
            <br />
            <em>jadi Nyama.</em>
          </h1>
          <p className="welcome__description">
            {t(
              "Belajar Basa Bali lewat percakapan. Temui warga desa dan coba bahasa yang dipakai sehari-hari.",
              "Learn Balinese through conversation. Meet the villagers and try the language of everyday life.",
            )}
          </p>
          <button
            className="welcome__start"
            onClick={begin}
            disabled={entering || !ready}
          >
            <span>
              {entering
                ? t("Masuk ke desa…", "Entering the village…")
                : t("Mulai", "Begin")}
            </span>
            <span className="welcome__start-icon">
              <ArrowRight size={22} />
            </span>
          </button>
          <div className="welcome__meta">
            <Sparkles size={13} />
            {t("Untuk pemula", "For beginners")}
            <span />
            3–5 {t("menit per latihan", "minutes per lesson")}
          </div>
          <a
            className="welcome__scroll"
            href="#cara-bermain"
            aria-label={t("Lihat cara bermain", "See how to play")}
          >
            <ArrowDown size={15} />
          </a>
        </section>
        <section
          className="welcome__guide"
          id="cara-bermain"
          aria-labelledby="welcome-how"
        >
          <div className="welcome__guide-heading">
            <span />
            <h2 id="welcome-how">{t("Cara bermain", "How to play")}</h2>
            <span />
          </div>
          <ol>
            {steps.map((step, i) => (
              <li key={i}>
                <span className="welcome__step-number">0{i + 1}</span>
                <div className="welcome__step-icon">
                  <step.icon size={20} strokeWidth={1.5} />
                </div>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </main>
      <footer className="welcome__footer">
        <span>NGRAOS! · BASA BALI</span>
        <span>
          {t(
            "Percakapan & suara dibantu AI.",
            "AI-assisted conversation & voices.",
          )}
        </span>
      </footer>
      <div className="welcome__entry-light" aria-hidden="true" />
      {entering ? (
        <div className="welcome__entry-status" role="status">
          <span />
          {t("Membuka Desa Kenderan", "Opening Kenderan Village")}
        </div>
      ) : null}
    </div>
  );
}
