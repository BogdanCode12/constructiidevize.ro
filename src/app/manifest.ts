import type { MetadataRoute } from "next";

/** Aplicația instalabilă (PWA): iconiță pe desktop / telefon, fereastră proprie, deschide direct contul. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/panou",
    name: "DevizConstruct.ro",
    short_name: "DevizConstruct",
    description: "Devize de construcții F1–F5 și C5–C9, dosare de licitație și urmărirea lucrărilor.",
    lang: "ro",
    start_url: "/panou?sursa=aplicatie",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone"],
    orientation: "any",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    categories: ["business", "productivity"],
    icons: [
      { src: "/pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/pwa/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Devize", url: "/panou/devize", icons: [{ src: "/pwa/icon-192.png", sizes: "192x192" }] },
      { name: "Proiecte", url: "/panou/proiecte", icons: [{ src: "/pwa/icon-192.png", sizes: "192x192" }] },
      { name: "Resurse și prețuri", url: "/panou/resurse", icons: [{ src: "/pwa/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
