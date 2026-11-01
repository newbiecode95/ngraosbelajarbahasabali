import type { Metadata, Viewport } from "next";
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/outfit";
import "@fontsource/cormorant-garamond/latin-600.css";
import "@fontsource/cormorant-garamond/latin-600-italic.css";
import "./globals.css";
import "./refinements.css";
import "./gameplay.css";
import "./welcome.css";
import "./demo-journey.css";
import { EntryJourneyProvider } from "@/components/entry-journey";
import { BackgroundMusicProvider } from "@/components/background-music";
export const metadata: Metadata = {
  title: "Ngraos! — Dari Tamiu jadi Nyama",
  description:
    "Belajar Basa Bali lewat petualangan suara. Masuk ke desa, temui warga, dan mulai cerita pertamamu.",
  applicationName: "Ngraos!",
  robots: { index: true, follow: true },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
  themeColor: "#f7f8f2",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>
        <a className="skip-link" href="#main-content">
          Langsung ke konten
        </a>
        <BackgroundMusicProvider>
          <EntryJourneyProvider>{children}</EntryJourneyProvider>
        </BackgroundMusicProvider>
      </body>
    </html>
  );
}
