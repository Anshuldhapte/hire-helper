import type { Metadata, Viewport } from "next";
import { Baloo_2, Rozha_One } from "next/font/google";
import "./globals.css";

// Rozha One: the bold "काम पक्का" logo. Baloo 2: every other word on the page.
// Both include Devanagari, so Marathi and Hindi look right next to English.
const rozha = Rozha_One({
  variable: "--font-rozha",
  weight: "400",
  subsets: ["latin", "devanagari"],
});
const baloo = Baloo_2({
  variable: "--font-baloo",
  subsets: ["latin", "devanagari"],
});

export const metadata: Metadata = {
  title: "Kaam Pakka",
  description: "A shortlist of 3 trusted workers, not 40 random calls.",
};

export const viewport: Viewport = {
  themeColor: "#fff9f0",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${rozha.variable} ${baloo.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
