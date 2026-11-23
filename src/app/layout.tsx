import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "ConstructiiDevize.ro — devize și licitații pentru construcții", template: "%s · ConstructiiDevize.ro" },
  description:
    "Platformă pentru firme de construcții: devize, calcul manoperă și ore de regie, caiet de sarcini, declarații pentru licitații și management de șantier, cu asistent AI.",
};

export const viewport: Viewport = { themeColor: "#0f5c63" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro">
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
