import { ActionForm } from "@/components/action-form";
import { Card, Field, PageHeader } from "@/components/ui";
import { query, queryOne } from "@/lib/db";
import { aiConfigured, getAiModel } from "@/lib/ai/claude";
import { AI_MODELS, modelPrice } from "@/lib/ai/models";
import { listAiTasks } from "@/lib/ai/jobs";
import { getSettings } from "@/lib/settings";
import { setAiModelAction, updateAiTaskAction } from "../actions";

export const metadata = { title: "AI · Admin" };

const EFFORTS = [["low", "Scăzut — rapid, ieftin"], ["medium", "Mediu"], ["high", "Ridicat — recomandat pentru analize"], ["xhigh", "Foarte ridicat"], ["max", "Maxim — cel mai scump"]];
const num = new Intl.NumberFormat("ro-RO");

export default async function AdminAiPage() {
  const [tasks, settings, model] = await Promise.all([listAiTasks(false), getSettings(), getAiModel()]);
  const month = await queryOne<{ jobs: number; chats: number; tin: number; tout: number; errors: number }>(
    `SELECT (SELECT COUNT(*) FROM ai_jobs WHERE created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')) AS jobs,
            (SELECT COUNT(*) FROM ai_chat_messages WHERE role = 'assistant' AND created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')) AS chats,
            (SELECT COALESCE(SUM(input_tokens),0) FROM ai_jobs WHERE created_at >= DATE_FORMAT(NOW(), '%Y-%m-01'))
              + (SELECT COALESCE(SUM(input_tokens),0) FROM ai_chat_messages WHERE created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')) AS tin,
            (SELECT COALESCE(SUM(output_tokens),0) FROM ai_jobs WHERE created_at >= DATE_FORMAT(NOW(), '%Y-%m-01'))
              + (SELECT COALESCE(SUM(output_tokens),0) FROM ai_chat_messages WHERE created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')) AS tout,
            (SELECT COUNT(*) FROM ai_jobs WHERE status = 'error' AND created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')) AS errors`,
  );
  // Costul se calculează pe modelul fiecărei cereri; pentru cereri fără model cunoscut se folosesc prețurile din Setări.
  const byModel = await query<{ model: string | null; tin: number; tout: number }>(
    `SELECT model, SUM(tin) AS tin, SUM(tout) AS tout FROM (
       SELECT model, COALESCE(input_tokens,0) AS tin, COALESCE(output_tokens,0) AS tout FROM ai_jobs WHERE created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')
       UNION ALL
       SELECT model, COALESCE(input_tokens,0), COALESCE(output_tokens,0) FROM ai_chat_messages WHERE role = 'assistant' AND created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')
     ) t GROUP BY model`,
  );
  const cost = byModel.reduce((sum, r) => {
    const p = modelPrice(r.model) ?? { input: settings.ai_price_input_per_mtok, output: settings.ai_price_output_per_mtok };
    return sum + (Number(r.tin) * p.input + Number(r.tout) * p.output) / 1_000_000;
  }, 0);
  const cacheStats = await queryOne<{ recipes: number; cached: number; hits: number }>(
    "SELECT (SELECT COUNT(*) FROM recipes) AS recipes, (SELECT COUNT(*) FROM ai_match_cache) AS cached, (SELECT COALESCE(SUM(hits),0) FROM ai_match_cache) AS hits",
  );
  const top = await query<{ name: string; n: number }>(
    `SELECT c.name, COUNT(*) AS n FROM ai_jobs j JOIN companies c ON c.id = j.company_id
      WHERE j.created_at >= DATE_FORMAT(NOW(), '%Y-%m-01') GROUP BY c.id ORDER BY n DESC LIMIT 5`,
  );

  return (
    <>
      <PageHeader title="Asistent AI" subtitle={`Model: ${AI_MODELS.find((m) => m.id === model)?.label ?? model}. Limita pe firmă (${settings.ai_monthly_requests} cereri/lună) se schimbă din Setări.`} />
      <div className={`mb-6 rounded-lg px-4 py-3 text-sm ${aiConfigured() ? "bg-brand-50 text-brand-800" : "bg-amber-50"}`}>
        {aiConfigured()
          ? process.env.AI_MOCK === "1" ? "Mod de test (AI_MOCK=1): răspunsurile sunt simulate, fără cost." : "AI activ — cheia ANTHROPIC_API_KEY este configurată."
          : "AI inactiv — adaugă variabila ANTHROPIC_API_KEY în cPanel (Setup Node.js App → Environment variables) și repornește aplicația."}
      </div>
      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        {[["Analize luna aceasta", month?.jobs], ["Mesaje chat", month?.chats], ["Tokeni intrare", month?.tin], ["Tokeni ieșire", month?.tout], ["Erori", month?.errors]].map(([l, v]) => (
          <Card key={String(l)}><div className="text-sm text-muted">{l}</div><div className="mt-1 text-2xl font-bold">{num.format(Number(v ?? 0))}</div></Card>
        ))}
        <Card><div className="text-sm text-muted">Cost estimat luna aceasta</div><div className="mt-1 text-2xl font-bold">${cost.toFixed(2)}</div></Card>
        <Card><div className="text-sm text-muted">Rețete în bază</div><div className="mt-1 text-2xl font-bold">{num.format(Number(cacheStats?.recipes ?? 0))}</div></Card>
        <Card><div className="text-sm text-muted">Potriviri AI salvate / refolosite</div><div className="mt-1 text-2xl font-bold">{num.format(Number(cacheStats?.cached ?? 0))} / {num.format(Number(cacheStats?.hits ?? 0))}</div></Card>
      </div>
      <Card className="mb-8">
        <h2 className="font-bold">Model</h2>
        <p className="mt-1 mb-4 text-sm text-muted">Se aplică tuturor sarcinilor și chat-ului, de la următoarea cerere (fără repornire). Prețuri în $ pe 1M tokeni, intrare / ieșire.</p>
        <ActionForm action={setAiModelAction} submitLabel="Salvează modelul" className="space-y-3">
          {AI_MODELS.map((m) => (
            <label key={m.id} className="flex cursor-pointer items-start gap-3 rounded-lg border-2 border-ink/10 px-4 py-3 has-[:checked]:border-brand-700">
              <input type="radio" name="model" value={m.id} defaultChecked={m.id === model} className="mt-1 accent-brand-700" />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <b>{m.label}</b>
                  <span className="text-sm tabular-nums text-muted">${m.input} / ${m.output}</span>
                </span>
                <span className="block text-sm text-muted">{m.note}</span>
              </span>
            </label>
          ))}
        </ActionForm>
      </Card>
      {byModel.length > 1 && (
        <p className="-mt-5 mb-6 text-sm text-muted">Luna aceasta pe modele: {byModel.map((r) => `${r.model ?? "necunoscut"}: ${num.format(Number(r.tin))} / ${num.format(Number(r.tout))} tokeni`).join(" · ")}.</p>
      )}
      {top.length > 0 && <p className="mb-6 text-sm text-muted">Cei mai activi clienți luna aceasta: {top.map((t) => `${t.name} (${t.n})`).join(", ")}.</p>}

      <h2 className="mb-1 text-lg font-bold">Sarcini AI</h2>
      <p className="mb-4 text-sm text-muted">Instrucțiunile de mai jos sunt trimise AI-ului la fiecare analiză. Le poți ajusta oricând; schimbările se aplică de la următoarea analiză.</p>
      <div className="space-y-5">
        {tasks.map((t) => (
          <Card key={t.slug}>
            <ActionForm action={updateAiTaskAction} submitLabel="Salvează">
              <input type="hidden" name="slug" value={t.slug} />
              <div className="grid gap-3 md:grid-cols-[1fr_1fr_200px_90px]">
                <Field label="Nume" name="name" defaultValue={t.name} />
                <Field label="Descriere scurtă" name="description" defaultValue={t.description} />
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">Efort</span>
                  <select name="effort" defaultValue={t.effort} className="w-full rounded-lg border border-line bg-white px-3 py-2.5">
                    {EFFORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </label>
                <Field label="Ordine" name="position" defaultValue={String(t.position)} />
              </div>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Instrucțiuni pentru AI</span>
                <textarea name="prompt" rows={8} defaultValue={t.prompt} className="w-full rounded-lg border border-line bg-white px-3.5 py-2.5 font-mono text-sm outline-none focus:border-brand-500" />
              </label>
              <div className="flex flex-wrap gap-6 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" name="active" defaultChecked={t.active === 1} className="size-4 accent-brand-700" /> Activă</label>
                <label className="flex items-center gap-2"><input type="checkbox" name="needs_files" defaultChecked={t.needs_files === 1} className="size-4 accent-brand-700" /> Necesită documente încărcate</label>
                <label className="flex items-center gap-2" title="Implicit se trimite textul extras (de câteva ori mai ieftin). Bifează doar dacă sarcina trebuie să vadă desene, tabele scanate sau ștampile."><input type="checkbox" name="send_originals" defaultChecked={t.send_originals === 1} className="size-4 accent-brand-700" /> Trimite PDF-urile originale (mai scump)</label>
              </div>
            </ActionForm>
          </Card>
        ))}
      </div>
    </>
  );
}
