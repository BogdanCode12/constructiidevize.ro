"use client";

import { NumInput } from "./parts";
import { fmtQty, schedule } from "@/lib/estimate/calc";
import type { EstChapter, EstimateDoc } from "@/lib/estimate/types";

/** Adaugă zile lucrătoare (luni–vineri) la o dată ISO. */
export function addWorkdays(iso: string, days: number): Date {
  const d = new Date(`${iso}T00:00:00`);
  let left = days;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  return d;
}

const dateFmt = new Intl.DateTimeFormat("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" });

export function Gantt({ doc, onDoc, onChapter }: {
  doc: EstimateDoc;
  onDoc: (fn: (d: EstimateDoc) => EstimateDoc) => void;
  onChapter: (ci: number, fn: (c: EstChapter) => EstChapter) => void;
}) {
  const rows = schedule(doc);
  const total = Math.max(1, ...rows.map((r) => r.end));
  const step = total <= 30 ? 1 : total <= 120 ? 5 : 20;
  const ticks = Array.from({ length: Math.floor(total / step) + 1 }, (_, i) => i * step);
  const date = (day: number) => (doc.startDate ? dateFmt.format(addWorkdays(doc.startDate, day)) : `ziua ${day + 1}`);
  const totalHours = rows.reduce((s, r) => s + r.hours, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-6 rounded-xl border border-line bg-white p-5 text-sm">
        <label className="block">
          <span className="mb-1 block text-muted">Data de început</span>
          <input type="date" value={doc.startDate ?? ""} onChange={(e) => onDoc((d) => ({ ...d, startDate: e.target.value || null }))}
            className="rounded-md border border-line px-3 py-1.5" />
        </label>
        <label className="block">
          <span className="mb-1 block text-muted">Ore de lucru pe zi</span>
          <span className="block w-24 rounded-md border border-line"><NumInput value={doc.hoursPerDay} onChange={(n) => onDoc((d) => ({ ...d, hoursPerDay: n || 8 }))} /></span>
        </label>
        <div>
          <div className="text-muted">Durată totală</div>
          <div className="text-lg font-bold">{total} zile lucrătoare</div>
        </div>
        <div>
          <div className="text-muted">Total manoperă</div>
          <div className="text-lg font-bold">{fmtQty(totalHours)} ore-om</div>
        </div>
        {doc.startDate && (
          <div>
            <div className="text-muted">Finalizare estimată</div>
            <div className="text-lg font-bold">{date(Math.max(0, total - 1))}</div>
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b border-line text-left text-xs text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Capitol</th>
              <th className="w-20 px-2 py-2 text-right font-medium">Ore-om</th>
              <th className="w-20 px-2 py-2 text-right font-medium">Echipă</th>
              <th className="w-20 px-2 py-2 text-right font-medium">Zile</th>
              <th className="w-24 px-2 py-2 text-right font-medium" title="Gol = după capitolul anterior">Start (zi)</th>
              <th className="w-[45%] px-3 py-2 font-medium">
                <div className="relative h-4">
                  {ticks.map((t) => (
                    <span key={t} className="absolute -translate-x-1/2 text-[10px]" style={{ left: `${(t / total) * 100}%` }}>{t}</span>
                  ))}
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r, ci) => (
              <tr key={r.key}>
                <td className="px-3 py-2">
                  <div className="font-medium">{ci + 1}. {r.name}</div>
                  <div className="text-xs text-muted">{r.days > 0 ? `${date(r.start)} → ${date(r.end - 1)}` : "fără manoperă în ore"}</div>
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{fmtQty(r.hours)}</td>
                <td className="px-1 py-1"><NumInput value={doc.chapters[ci].teamSize} onChange={(n) => onChapter(ci, (c) => ({ ...c, teamSize: Math.max(1, Math.round(n ?? 1)) }))} /></td>
                <td className="px-2 py-2 text-right font-semibold tabular-nums">{r.days}</td>
                <td className="px-1 py-1">
                  <NumInput value={doc.chapters[ci].startDay === null ? null : doc.chapters[ci].startDay! + 1} nullable placeholder="auto"
                    onChange={(n) => onChapter(ci, (c) => ({ ...c, startDay: n === null ? null : Math.max(0, Math.round(n) - 1) }))} />
                </td>
                <td className="px-3 py-2">
                  <div className="relative h-6 rounded bg-canvas">
                    {ticks.map((t) => <span key={t} className="absolute inset-y-0 w-px bg-line" style={{ left: `${(t / total) * 100}%` }} />)}
                    {r.days > 0 && (
                      <div className="absolute inset-y-0.5 rounded bg-brand-600 text-[10px] leading-5 font-semibold text-white"
                        style={{ left: `${(r.start / total) * 100}%`, width: `${Math.max(1.5, (r.days / total) * 100)}%` }}>
                        <span className="px-1.5">{r.days}z</span>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">
        Durata = ore-om ale capitolului ÷ (echipă × ore pe zi). Orele vin din resursele de manoperă cu U.M. „ora”. Zilele sunt lucrătoare (luni–vineri).
        Pune „Start” pentru capitole care se execută în paralel; gol = începe după capitolul anterior.
      </p>
    </div>
  );
}
