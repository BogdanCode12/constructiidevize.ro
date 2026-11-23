import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { CookieNotice } from "@/components/cookie-notice";

// Font geometric pentru titluri, apropiat de cel din siglă; textul curent rămâne Helvetica.
const outfit = Outfit({ subsets: ["latin", "latin-ext"], weight: ["500", "600", "700"], variable: "--font-outfit", display: "swap" });

export const metadata: Metadata = {
  title: { default: "DevizBuild.ro — devize și dosare de licitație pentru construcții", template: "%s · DevizBuild.ro" },
  description:
    "Platformă pentru firme de construcții: devize F1–F5 și C5–C9, import F3 cu potrivire automată, asistent AI pentru caiete de sarcini, declarații, situații de lucrări și management de șantier.",
};

export const viewport: Viewport = { themeColor: "#ffffff" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro" className={outfit.variable}>
      <body className="min-h-dvh font-sans antialiased">
        {children}
        <CookieNotice />
      </body>
    </html>
  );
}
