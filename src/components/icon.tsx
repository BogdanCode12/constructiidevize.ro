const PATHS: Record<string, string> = {
  home: "M3 11l9-7 9 7M5 10v10h14V10",
  folder: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  calc: "M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM8 7h8M8 12h2M14 12h2M8 16h2M14 16h2",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  spark: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z",
  megaphone: "M3 11v2a1 1 0 0 0 1 1h3l6 4V6L7 10H4a1 1 0 0 0-1 1zM17 8a5 5 0 0 1 0 8",
  doc: "M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v5h5M9 13h6M9 17h6",
  helmet: "M4 17h16M5 17a7 7 0 0 1 14 0M12 6v4M9 7.5V11M15 7.5V11",
  box: "M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8",
  building: "M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 9h4a1 1 0 0 1 1 1v11M3 21h18M8 8h3M8 12h3M8 16h3",
  card: "M3 6h18v12H3zM3 10h18M7 15h3",
  shield: "M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z",
  logout: "M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3M10 17l-5-5 5-5M5 12h11",
  menu: "M4 6h16M4 12h16M4 18h16",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
};

/** Iconițe desenate (PNG transparent în public/icons/meniu/), colorate prin mască cu culoarea textului (gri / roșu activ). */
const IMAGES: Record<string, string> = {
  birou: "/icons/meniu/birou.png",
  devize: "/icons/meniu/devize.png",
  materiale: "/icons/meniu/materiale.png",
  manopera: "/icons/meniu/manopera.png",
  santier: "/icons/meniu/santier.png",
  proiecte: "/icons/meniu/proiecte.png",
  asistent: "/icons/meniu/asistent.png",
  firma: "/icons/meniu/firma.png",
  abonament: "/icons/meniu/abonament.png",
  profil: "/icons/meniu/profil.png",
};

export function Icon({ name, className = "size-5" }: { name: string; className?: string }) {
  const img = IMAGES[name];
  if (img) {
    const mask = `url(${img}) center / contain no-repeat`;
    return <span aria-hidden className={`inline-block shrink-0 bg-current ${className}`} style={{ mask, WebkitMask: mask }} />;
  }
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={PATHS[name] ?? PATHS.doc} />
    </svg>
  );
}
