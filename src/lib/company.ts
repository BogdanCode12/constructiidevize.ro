import "server-only";
import { query, queryOne } from "./db";

export type Company = {
  id: number; name: string; cui: string | null; reg_com: string | null; address: string | null; county: string | null;
  phone: string | null; legal_rep: string | null; legal_rep_role: string | null; email: string | null;
  iban: string | null; bank: string | null; caen: string | null;
};

export async function getCompany(id: number): Promise<Company | null> {
  return queryOne<Company>(
    "SELECT id, name, cui, reg_com, address, county, phone, legal_rep, legal_rep_role, email, iban, bank, caen FROM companies WHERE id = ?",
    [id],
  );
}

export async function listMemberships(userId: number) {
  return query<{ id: number; name: string; role: string }>(
    "SELECT c.id, c.name, cm.role FROM company_members cm JOIN companies c ON c.id = cm.company_id WHERE cm.user_id = ? ORDER BY cm.created_at",
    [userId],
  );
}

export type AnafCompany = { name: string; address: string; regCom: string; phone: string; caen: string; county: string; vat: boolean; active: string };

/** Date publice despre firmă din API-ul ANAF (gratuit, fără cheie). */
export async function anafLookup(cuiRaw: string): Promise<AnafCompany | null> {
  const cui = Number(cuiRaw.replace(/^RO/i, "").replace(/\D/g, ""));
  if (!cui) return null;
  const today = new Date().toISOString().slice(0, 10);
  const res = await fetch("https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify([{ cui, data: today }]),
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`ANAF a răspuns cu ${res.status}`);
  const json = (await res.json()) as {
    found?: {
      date_generale?: Record<string, string | number | boolean>;
      inregistrare_scop_Tva?: { scpTVA?: boolean };
      adresa_sediu_social?: Record<string, string>;
    }[];
  };
  const f = json.found?.[0];
  const g = f?.date_generale;
  if (!g) return null;
  return {
    name: String(g.denumire ?? ""),
    address: String(g.adresa ?? ""),
    regCom: String(g.nrRegCom ?? ""),
    phone: String(g.telefon ?? ""),
    caen: String(g.cod_CAEN ?? ""),
    county: String(f?.adresa_sediu_social?.sdenumire_Judet ?? ""),
    vat: !!f?.inregistrare_scop_Tva?.scpTVA,
    active: String(g.stare_inregistrare ?? ""),
  };
}
