import type { Metadata, Viewport } from "next";
import { Noto_Sans_Devanagari, Plus_Jakarta_Sans, Rozha_One } from "next/font/google";
import "./globals.css";

// Plus Jakarta Sans for English; Noto Sans Devanagari picks up Hindi and Marathi letters
// automatically (the browser falls back per character). Rozha One is only for the logo.
const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"] });
const devanagari = Noto_Sans_Devanagari({ variable: "--font-devanagari", subsets: ["devanagari"] });
const rozha = Rozha_One({ variable: "--font-rozha", weight: "400", subsets: ["latin", "devanagari"] });

export const metadata: Metadata = {
  title: "Kaam Pakka",
  description: "A shortlist of 3 trusted workers, not 40 random calls.",
};

export const viewport: Viewport = {
  themeColor: "#f8f9fa",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${jakarta.variable} ${devanagari.variable} ${rozha.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
