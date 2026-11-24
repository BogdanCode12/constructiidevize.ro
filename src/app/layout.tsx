import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { CookieNotice } from "@/components/cookie-notice";
import { siteUrl } from "@/lib/site-url";

const inter = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  openGraph: { siteName: "DevizConstruct.ro", locale: "ro_RO", type: "website" },
  title: { default: "DevizConstruct.ro — devize și dosare de licitație pentru construcții", template: "%s · DevizConstruct.ro" },
  description:
    "Platformă pentru firme de construcții: devize F1–F5 și C5–C9, import F3 cu potrivire automată, asistent tehnic pentru caiete de sarcini, declarații, situații de lucrări și management de șantier.",
};

export const viewport: Viewport = { themeColor: "#ffffff" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro" className={inter.variable}>
      <body className="min-h-dvh font-sans antialiased">
        {children}
        <CookieNotice />
      </body>
    </html>
  );
}
