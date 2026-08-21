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
  title: "VaakSetu — Multilingual Speech & Translation Suite | BAIF",
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
    icon: [
      { url: "/favicon-32x32.png?v=10", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png?v=10", sizes: "16x16", type: "image/png" },
      { url: "/logo.svg?v=10", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.ico?v=10",
    apple: [
      { url: "/apple-touch-icon.png?v=10", sizes: "180x180", type: "image/png" },
    ],
  },
  openGraph: {
    title: "VaakSetu — Multilingual Speech & Translation Suite | BAIF",
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
      <head>
        <link rel="icon" href="/favicon-32x32.png?v=10" sizes="32x32" type="image/png" />
        <link rel="icon" href="/favicon-16x16.png?v=10" sizes="16x16" type="image/png" />
        <link rel="icon" href="/logo.svg?v=10" type="image/svg+xml" />
        <link rel="shortcut icon" href="/favicon.ico?v=10" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=10" />
        <link rel="apple-touch-icon-precomposed" href="/apple-touch-icon-precomposed.png?v=10" />
      </head>
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
