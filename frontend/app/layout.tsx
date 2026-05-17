import type { Metadata } from "next";
import { IBM_Plex_Mono, Orbitron, Space_Grotesk } from "next/font/google";
import { GamificationPreferenceProvider } from "@/components/providers/gamification-preference-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { DisplayShortcutsProvider } from "@/components/providers/display-shortcuts-provider";
import { TextScalePreferenceProvider } from "@/components/providers/text-scale-preference-provider";
import { ThemePreferenceProvider } from "@/components/providers/theme-preference-provider";
import { WebVitalsReporter } from "@/components/providers/web-vitals-reporter";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "GitRank",
    template: "%s | GitRank",
  },
  description:
    "GitRank turns meaningful open-source work into explainable reputation signals, XP, badges, and public proof.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${spaceGrotesk.variable} ${ibmPlexMono.variable} ${orbitron.variable} h-full antialiased`}
    >
      <body className="min-h-full text-foreground">
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <WebVitalsReporter />
        <ThemePreferenceProvider>
          <TextScalePreferenceProvider>
            <DisplayShortcutsProvider>
              <GamificationPreferenceProvider>
                <QueryProvider>{children}</QueryProvider>
              </GamificationPreferenceProvider>
            </DisplayShortcutsProvider>
          </TextScalePreferenceProvider>
        </ThemePreferenceProvider>
      </body>
    </html>
  );
}
