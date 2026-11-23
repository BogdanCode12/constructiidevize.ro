export const PROJECT_FILE_LABELS = {
  caiet_sarcini: "Caiet de sarcini / fișa de date",
  clarificari: "Clarificări / erate",
  contract: "Contract / model de contract",
  planse: "Planșe / memorii (DTAC, PTh)",
  f3: "Liste de cantități (F3)",
  altele: "Altele",
} as const;

export type ProjectFileLabel = keyof typeof PROJECT_FILE_LABELS;
