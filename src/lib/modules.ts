/**
 * Meniul contului, grupat după etapele unei lucrări: Ofertare → Execuție → Firma.
 * `ready: false` = pagină „în curând” până o construim.
 */
export type ModuleGroup = "" | "Ofertare" | "Execuție";

export const MODULES = [
  { slug: "", label: "Birou", group: "", icon: "birou", ready: true },
  { slug: "proiecte", label: "Licitații & proiecte", group: "Ofertare", icon: "proiecte", ready: true },
  { slug: "devize", label: "Devize", group: "Ofertare", icon: "devize", ready: true, description: "Devize pe materiale, manoperă și utilaje, cu export F1–F3 și C5–C9." },
  { slug: "resurse", label: "Prețuri & materiale", group: "Ofertare", icon: "materiale", ready: true, description: "Bazele tale de materiale, manoperă și utilaje, cu prețuri proprii." },
  { slug: "manopera", label: "Manoperă & utilaje", group: "Ofertare", icon: "manopera", ready: true, description: "Normă × cantitate → oameni, zile și ore de regie, cu grafic de execuție." },
  { slug: "asistent", label: "Asistent tehnic", group: "Ofertare", icon: "asistent", ready: true, description: "Încarcă planuri DTAC / PTh, PDF sau Excel și primești antemăsurătoarea." },
  { slug: "documente", label: "Dosarul firmei", group: "Ofertare", icon: "dosar", ready: true, description: "Caiet de sarcini și declarații pentru SEAP, precompletate din datele firmei." },
  { slug: "santier", label: "Șantier", group: "Execuție", icon: "santier", ready: true, description: "Jurnal de șantier, pontaj și situații de lucrări lunare față de deviz." },
] as const satisfies readonly { slug: string; label: string; group: ModuleGroup; icon: string; ready: boolean; description?: string }[];

export const ACCOUNT_LINKS = [
  { slug: "firma", label: "Firmă & echipă", icon: "firma" },
  { slug: "abonament", label: "Abonament", icon: "abonament" },
  { slug: "cont", label: "Profilul meu", icon: "profil" },
] as const;
