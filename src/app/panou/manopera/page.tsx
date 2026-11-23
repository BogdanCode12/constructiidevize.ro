import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { loadEstimate } from "@/lib/estimate/repo";
import { chapterMachineHours, fmtMoney, fmtQty, recap, schedule } from "@/lib/estimate/calc";
import type { EstimateDoc } from "@/lib/estimate/types";

export const metadata = { title: "Manoperă & utilaje" };

const dateFmt = new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium" });

function addWorkdays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`);
  let left = days;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) left--;
  }
  return d;
}

export default async function LaborPage() {
  const user = await requireUser();
  const companyId = user.company?.id ?? 0;
  const ids = await query<{ id: number }>("SELECT id FROM estimates WHERE company_id = ? ORDER BY updated_at DESC LIMIT 50", [companyId]);
  const docs = (await Promise.all(ids.map((e) => loadEstimate(e.id, companyId)))).filter((d): d is EstimateDoc => !!d);

  const rows = docs.map((d) => {
    const r = recap(d);
    const sch = schedule(d);
    const days = Math.max(0, ...sch.map((s) => s.end));
    const machine = d.chapters.reduce((s, ch) => s + chapterMachineHours(ch), 0);
    return { d, r, days, machine, maxTeam: Math.max(0, ...sch.filter((s) => s.days > 0).map((s) => s.teamSize)) };
  });

  return (
    <>
      <PageHeader title="Manoperă & utilaje" subtitle="Ore-om, ore de utilaj, durată și cost de manoperă pe fiecare deviz. Echipele și datele se setează în tabul „Grafic execuție” al devizului." />
      <Card className="overflow-x-auto p-0">
        {rows.length === 0 ? (
          <p className="px-5 py-12 text-center text-muted">Niciun deviz încă.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-muted">
              <tr>
                {["Deviz", "Proiect", "Ore-om", "Cost manoperă", "Ore utilaj/transport", "Cost utilaje", "Echipă max.", "Durată", "Început → final"].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map(({ d, r, days, machine, maxTeam }) => (
                <tr key={d.id} className="hover:bg-canvas">
                  <td className="px-4 py-3 font-medium"><Link href={`/panou/devize/${d.id}`} className="text-brand-700 hover:underline">{d.name}</Link></td>
                  <td className="px-4 py-3">{d.projectName}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmtQty(r.laborHours)}</td>
                  <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">{fmtMoney(r.direct.manopera)} lei</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmtQty(machine)}</td>
                  <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">{fmtMoney(r.direct.utilaj + r.direct.transport)} lei</td>
                  <td className="px-4 py-3 text-right tabular-nums">{maxTeam || "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{days} zile</td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted">
                    {d.startDate && days > 0 ? `${dateFmt.format(new Date(`${d.startDate}T00:00:00`))} → ${dateFmt.format(addWorkdays(d.startDate, days - 1))}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
