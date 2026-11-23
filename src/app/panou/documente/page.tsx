import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { getCompany } from "@/lib/company";
import { DOC_CATEGORIES, expiryStatus, type DocCategory } from "@/lib/documents";
import { listTemplates } from "@/lib/templates";
import { deleteDocumentAction } from "./actions";
import { UploadForm } from "./upload-form";

export const metadata = { title: "Documente" };

const TONE = { ok: "bg-brand-50 text-brand-800", soon: "bg-amber-100 text-amber-800", expired: "bg-red-100 text-red-700", none: "bg-canvas text-muted" };
const size = (b: number | null) => (b ? (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.ceil(b / 1024)} KB`) : "");

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ tab?: string; proiect?: string; deviz?: string }> }) {
  const user = await requireUser();
  const companyId = user.company?.id ?? 0;
  const sp = await searchParams;
  const tab = sp.tab === "declaratii" ? "declaratii" : "dosar";

  return (
    <>
      <PageHeader title="Documente" subtitle="Dosarul permanent al firmei și declarațiile generate automat pentru licitații." />
      <nav className="mb-6 flex gap-1 border-b border-line">
        {[["dosar", "Dosarul firmei"], ["declaratii", "Declarații & formulare"]].map(([id, label]) => (
          <Link key={id} href={`/panou/documente?tab=${id}`}
            className={`border-b-2 px-3 py-2.5 text-sm font-medium ${tab === id ? "border-brand-700 text-brand-800" : "border-transparent text-muted hover:text-ink"}`}>
            {label}
          </Link>
        ))}
      </nav>
      {tab === "dosar" ? <Dossier companyId={companyId} /> : <Declarations companyId={companyId} projectId={Number(sp.proiect) || null} estimateId={Number(sp.deviz) || null} />}
    </>
  );
}

async function Dossier({ companyId }: { companyId: number }) {
  const docs = await query<{
    id: number; category: DocCategory; title: string; issuer: string | null; doc_number: string | null;
    expires_at: Date | null; file_name: string | null; file_size: number | null; notes: string | null;
  }>(
    "SELECT id, category, title, issuer, doc_number, expires_at, file_name, file_size, notes FROM company_documents WHERE company_id = ? ORDER BY category, (expires_at IS NULL), expires_at, title",
    [companyId],
  );
  const groups = (Object.keys(DOC_CATEGORIES) as DocCategory[]).map((c) => [c, docs.filter((d) => d.category === c)] as const).filter(([, l]) => l.length);
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        {groups.length === 0 && (
          <Card className="py-12 text-center text-muted">
            Încarcă certificatele, autorizațiile, experiența similară, CV-urile și lista de utilaje o singură dată — le refolosești la fiecare licitație și primești alertă înainte să expire.
          </Card>
        )}
        {groups.map(([cat, list]) => (
          <Card key={cat} className="p-0">
            <div className="border-b border-line px-5 py-3 font-semibold">{DOC_CATEGORIES[cat]} <span className="font-normal text-muted">({list.length})</span></div>
            <ul className="divide-y divide-line">
              {list.map((d) => {
                const st = expiryStatus(d.expires_at);
                return (
                  <li key={d.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{d.title}</div>
                      <div className="text-muted">{[d.issuer, d.doc_number && `nr. ${d.doc_number}`, d.notes].filter(Boolean).join(" · ") || "—"}</div>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${TONE[st.tone]}`}>{st.label}</span>
                    {d.file_name ? (
                      <a href={`/api/documente/${d.id}`} target="_blank" className="font-semibold text-brand-700 hover:underline" title={d.file_name}>Deschide <span className="font-normal text-muted">{size(d.file_size)}</span></a>
                    ) : <span className="text-muted">fără fișier</span>}
                    <form action={deleteDocumentAction}>
                      <input type="hidden" name="id" value={d.id} />
                      <ConfirmSubmit message={`Ștergi „${d.title}”?`}>Șterge</ConfirmSubmit>
                    </form>
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}
      </div>
      <Card className="h-fit">
        <h2 className="mb-4 font-bold">Adaugă document</h2>
        <UploadForm />
        <p className="mt-3 text-xs text-muted">PDF, imagini, Word, Excel sau ZIP, maxim 25 MB. Primești alertă cu 30, 7 și 1 zi înainte de expirare.</p>
      </Card>
    </div>
  );
}

async function Declarations({ companyId, projectId, estimateId }: { companyId: number; projectId: number | null; estimateId: number | null }) {
  const [company, projects, templates] = await Promise.all([
    getCompany(companyId),
    query<{ id: number; name: string }>("SELECT id, name FROM projects WHERE company_id = ? ORDER BY created_at DESC", [companyId]),
    listTemplates(),
  ]);
  const pid = projectId ?? projects[0]?.id ?? null;
  const estimates = pid
    ? await query<{ id: number; name: string }>("SELECT id, name FROM estimates WHERE project_id = ? AND company_id = ? ORDER BY created_at", [pid, companyId])
    : [];
  const missing = [
    !company?.cui && "CUI", !company?.address && "adresa", !company?.legal_rep && "reprezentantul legal", !company?.legal_rep_role && "funcția reprezentantului",
  ].filter(Boolean);
  const qs = (tplId: number) => `/panou/documente/genereaza?${new URLSearchParams({ sablon: String(tplId), ...(pid ? { proiect: String(pid) } : {}), ...(estimateId ? { deviz: String(estimateId) } : {}) })}`;

  return (
    <div className="space-y-6">
      {missing.length > 0 && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm">
          Lipsesc din datele firmei: <b>{missing.join(", ")}</b>. Completează-le în <Link href="/panou/firma" className="font-semibold text-brand-700 underline">Firmă & utilizatori</Link> ca să apară în documente.
        </p>
      )}
      <Card>
        <form className="flex flex-wrap items-end gap-3" action="/panou/documente">
          <input type="hidden" name="tab" value="declaratii" />
          <label className="block min-w-64 flex-1">
            <span className="mb-1.5 block text-sm font-medium">Proiect / licitație</span>
            <select name="proiect" defaultValue={pid ?? ""} className="w-full rounded-lg border border-line bg-white px-3 py-2">
              {projects.length === 0 && <option value="">— niciun proiect —</option>}
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="block min-w-56">
            <span className="mb-1.5 block text-sm font-medium">Valoarea ofertei din devizul</span>
            <select name="deviz" defaultValue={estimateId ?? ""} className="w-full rounded-lg border border-line bg-white px-3 py-2">
              <option value="">primul deviz al proiectului</option>
              {estimates.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </label>
          <button className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold hover:border-brand-200">Aplică</button>
          {pid && <a href={`/panou/proiecte/${pid}/dosar`} className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800">Descarcă dosarul complet (ZIP)</a>}
        </form>
      </Card>
      <Card className="p-0">
        <ul className="divide-y divide-line">
          {templates.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5 text-sm">
              <span className="w-24 shrink-0 text-xs font-medium text-muted uppercase">{t.category}</span>
              <span className="flex-1 font-medium">{t.name}</span>
              <a href={qs(t.id)} className="font-semibold text-brand-700 hover:underline">Descarcă Word</a>
            </li>
          ))}
        </ul>
      </Card>
      <p className="text-xs text-muted">
        Documentele sunt modele completate automat cu datele firmei, ale proiectului și valoarea din deviz. Verifică-le întotdeauna cu formularele din documentația de atribuire înainte de semnare.
      </p>
    </div>
  );
}
