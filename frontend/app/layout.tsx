import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import { GamificationPreferenceProvider } from "@/components/providers/gamification-preference-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
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
      className={`${spaceGrotesk.variable} ${ibmPlexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <GamificationPreferenceProvider>
          <QueryProvider>{children}</QueryProvider>
        </GamificationPreferenceProvider>
      </body>
    </html>
  );
}
