"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { MapPin, RotateCcw, X, Compass, Sparkles } from "lucide-react";
import { Brand } from "./ui";
import type { Locale } from "@/lib/types";

const JourneyContext = createContext({
  enter: (_locale: Locale, _reduced: boolean) => {},
  villageReady: () => {},
  isTraveling: false,
});
export const useEntryJourney = () => useContext(JourneyContext);

export function BaliJourney({
  locale = "id",
  reduced = false,
  arriving = false,
  waiting = false,
}: {
  locale?: Locale;
  reduced?: boolean;
  arriving?: boolean;
  waiting?: boolean;
}) {
  const trail = useRef<SVGPathElement>(null),
    traveler = useRef<SVGCircleElement>(null);
  useEffect(() => {
    if (
      reduced ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const path = trail.current,
      dot = traveler.current;
    if (!path || !dot) return;
    const length = path.getTotalLength(),
      start = performance.now();
    let frame = 0;
    const move = (now: number) => {
      const progress = Math.min(1, (now - start) / 1550),
        eased = 1 - Math.pow(1 - progress, 2);
      const point = path.getPointAtLength(length * eased);
      dot.setAttribute("cx", String(point.x));
      dot.setAttribute("cy", String(point.y));
      if (progress < 1) frame = requestAnimationFrame(move);
    };
    frame = requestAnimationFrame(move);
    return () => cancelAnimationFrame(frame);
  }, [reduced]);
  const t = (id: string, en: string) => (locale === "id" ? id : en);
  return (
    <div
      className={`bali-journey ${reduced ? "bali-journey--quiet" : ""} ${arriving ? "bali-journey--arriving" : ""}`}
    >
      <div className="bali-journey__atmosphere" aria-hidden="true">
        <div className="bali-journey__aurora" />
        <div className="bali-journey__chart-grid" />
        {Array.from({ length: 12 }, (_, i) => (
          <i
            key={i}
            style={{
              left: `${6 + ((i * 19) % 89)}%`,
              top: `${9 + ((i * 31) % 78)}%`,
              animationDelay: `${i * -0.7}s`,
            }}
          />
        ))}
      </div>
      <div className="bali-journey__topline">
        <Brand />
        <span>BALI · INDONESIA</span>
      </div>
      <div className="bali-journey__body">
        <div className="bali-journey__heading">
          <span className="bali-journey__chapter">
            <span /> {t("PERJALANAN PERTAMAMU", "YOUR FIRST JOURNEY")} <span />
          </span>
          <h1 aria-label={t("Menuju Desa Kenderan", "On our way to Kenderan")}>
            <small>{t("Menuju", "On our way to")}</small>
            <span>
              Desa <em>Kenderan</em>
            </span>
          </h1>
          <p>
            <span />
            {t("Tegallalang, Gianyar", "Tegallalang, Gianyar")}
            <span />
          </p>
        </div>
        <div className="bali-journey__map" aria-hidden="true">
          <span className="bali-journey__ocean-glow" />
          <img
            src="/images/bali-map-relief.svg"
            alt=""
            width="800"
            height="560"
          />
          <svg viewBox="0 0 800 560" className="bali-journey__route">
            <text x="415" y="240" className="bali-journey__island">
              BALI
            </text>
            <path
              className="bali-journey__trail-shadow"
              d="M 100 126 C 170 130 194 190 255 202 S 375 215 420 248 S 480 300 514.43 278.11"
            />
            <path
              ref={trail}
              className="bali-journey__trail"
              d="M 100 126 C 170 130 194 190 255 202 S 375 215 420 248 S 480 300 514.43 278.11"
              fill="none"
              strokeLinecap="round"
              strokeDasharray="1 17"
            />
            {!reduced ? (
              <circle
                ref={traveler}
                cx="100"
                cy="126"
                r="6"
                className="bali-journey__traveler"
              />
            ) : null}
            <circle
              cx="514.43"
              cy="278.11"
              r="22"
              className="bali-journey__ring"
            />
            <circle
              cx="514.43"
              cy="278.11"
              r="8"
              className="bali-journey__destination"
            />
          </svg>
          <div className="bali-journey__pin">
            <MapPin size={17} />
            <div>
              <small>{t("TUJUANMU", "YOUR DESTINATION")}</small>
              <span>Desa Kenderan</span>
            </div>
          </div>
          <span className="bali-journey__ocean">
            {t("SAMUDRA HINDIA", "INDIAN OCEAN")}
          </span>
          <span className="bali-journey__compass">
            <Compass size={32} />
            <small>{t("U", "N")}</small>
          </span>
        </div>
      </div>
      <div className="bali-journey__bottom">
        <div className="bali-journey__journey-line" aria-hidden="true">
          <i />
          <Sparkles size={16} />
          <i />
        </div>
        <p className="bali-journey__status">
          {arriving
            ? t("Rahajeng rauh!", "Rahajeng rauh!")
            : waiting
              ? t("Desanya masih disiapkan…", "Getting the village ready…")
              : t("Perjalananmu dimulai di sini.", "Your journey starts here.")}
          <span className="bali-journey__dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </p>
        <span className="bali-journey__bottom-note">
          Dari Tamiu jadi Nyama.
        </span>
      </div>
    </div>
  );
}

// The route fallback must not mount a second animated scene behind the entry overlay.
export function VillageLoading() {
  const { isTraveling } = useEntryJourney();
  if (isTraveling) return null;
  return (
    <div className="village-loading" role="status">
      <BaliJourney waiting />
    </div>
  );
}

export function EntryJourneyProvider({ children }: { children: ReactNode }) {
  const router = useRouter(),
    pathname = usePathname();
  const [journey, setJourney] = useState<{
    locale: Locale;
    reduced: boolean;
  } | null>(null);
  const [ready, setReady] = useState(false),
    [elapsed, setElapsed] = useState(false),
    [arriving, setArriving] = useState(false),
    [slow, setSlow] = useState(false);
  const departed = useRef(false),
    overlay = useRef<HTMLDivElement>(null);
  const villageReady = useCallback(() => setReady(true), []);
  useEffect(() => {
    if (!journey && departed.current)
      (
        document.querySelector<HTMLElement>("[data-entry-focus]") ||
        document.getElementById("main-content")
      )?.focus({ preventScroll: true });
  }, [journey]);
  const enter = useCallback(
    (locale: Locale, reduced: boolean) => {
      departed.current = false;
      setReady(false);
      setElapsed(false);
      setArriving(false);
      setSlow(false);
      setJourney({ locale, reduced });
      router.push("/desa");
    },
    [router],
  );
  useEffect(() => {
    if (!journey) return;
    overlay.current?.focus({ preventScroll: true });
    const minimum = setTimeout(
      () => setElapsed(true),
      journey.reduced ? 80 : 1900,
    );
    const timeout = setTimeout(() => setSlow(true), 10000);
    return () => {
      clearTimeout(minimum);
      clearTimeout(timeout);
    };
  }, [journey]);
  useEffect(() => {
    if (!journey) return;
    if (pathname === "/desa") departed.current = true;
    else if (departed.current) setJourney(null);
  }, [journey, pathname]);
  useEffect(() => {
    if (!journey || !ready || !elapsed || pathname !== "/desa") return;
    setArriving(true);
    const finish = setTimeout(
      () => {
        setJourney(null);
      },
      journey.reduced ? 60 : 620,
    );
    return () => clearTimeout(finish);
  }, [journey, ready, elapsed, pathname]);
  const t = (id: string, en: string) => (journey?.locale === "en" ? en : id);
  return (
    <JourneyContext.Provider
      value={{ enter, villageReady, isTraveling: Boolean(journey) }}
    >
      <div className="journey-content" inert={Boolean(journey)}>
        {children}
      </div>
      {journey ? (
        <div
          ref={overlay}
          className={`entry-journey ${arriving ? "entry-journey--arriving" : ""} ${journey.reduced ? "entry-journey--quiet" : ""}`}
          tabIndex={-1}
          aria-label={t(
            "Perjalanan ke Desa Kenderan",
            "Journey to Kenderan Village",
          )}
        >
          <div role="status" aria-live="polite">
            <BaliJourney
              locale={journey.locale}
              reduced={journey.reduced}
              arriving={arriving}
              waiting={elapsed && !ready}
            />
          </div>
          {slow && !arriving ? (
            <div className="entry-journey__recovery">
              <p>
                {t(
                  "Koneksi agak lambat. Kamu bisa mencoba lagi.",
                  "The connection is taking a while. You can try again.",
                )}
              </p>
              <a href="/desa">
                <RotateCcw size={16} />
                {t("Muat ulang", "Reload")}
              </a>
              <button
                onClick={() => {
                  setJourney(null);
                  router.replace("/");
                }}
              >
                <X size={16} />
                {t("Kembali", "Go back")}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </JourneyContext.Provider>
  );
}
