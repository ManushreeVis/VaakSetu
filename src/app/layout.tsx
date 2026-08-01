import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_Devanagari } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/app/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoDevanagari = Noto_Sans_Devanagari({
  variable: "--font-noto-devanagari",
  subsets: ["devanagari"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "VaakSetu — Offline Multilingual Translation Suite",
  description:
    "VaakSetu (वाक्सेतु) is an offline-capable translation suite for BAIF: transcribe, translate and voice Marathi, Hindi & English from text, audio and video — fully on-premises with open-source models.",
  keywords: [
    "VaakSetu",
    "BAIF",
    "IndicTrans2",
    "Marathi translation",
    "Hindi translation",
    "offline translation",
    "speech to text",
    "subtitles",
    "open-source NLP",
  ],
  authors: [{ name: "VaakSetu — Tech for Good" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "VaakSetu — Offline Multilingual Translation Suite",
    description: "Transcribe, translate & voice Marathi, Hindi & English — fully on-prem, open-source.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${notoDevanagari.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
