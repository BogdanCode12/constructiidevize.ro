/** Modulele din panou. `ready: false` = pagină „în curând” până le construim. */
export const MODULES = [
  { slug: "", label: "Dashboard", icon: "home", ready: true },
  { slug: "proiecte", label: "Proiecte", icon: "folder", ready: true },
  { slug: "devize", label: "Devize", icon: "calc", ready: true, description: "Devize pe materiale, manoperă și utilaje, cu export F1–F3 și C5–C9." },
  { slug: "manopera", label: "Manoperă & utilaje", icon: "clock", ready: true, description: "Normă × cantitate → oameni, zile și ore de regie, cu grafic de execuție." },
  { slug: "asistent", label: "Asistent tehnic", icon: "spark", ready: true, description: "Încarcă planuri DTAC / PTh, PDF sau Excel și primești antemăsurătoarea." },
  { slug: "documente", label: "Documente", icon: "doc", ready: true, description: "Caiet de sarcini și declarații pentru SEAP, precompletate din datele firmei." },
  { slug: "santier", label: "Șantier", icon: "helmet", ready: true, description: "Jurnal de șantier, pontaj și situații de lucrări lunare față de deviz." },
  { slug: "resurse", label: "Resurse", icon: "box", ready: true, description: "Bazele tale de materiale, manoperă și utilaje, cu prețuri proprii." },
] as const;

export const ACCOUNT_LINKS = [
  { slug: "firma", label: "Firmă & utilizatori", icon: "building" },
  { slug: "abonament", label: "Abonament", icon: "card" },
  { slug: "cont", label: "Contul meu", icon: "user" },
] as const;
