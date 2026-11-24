/** Întrebări frecvente din Markdown („## Întrebare” + răspuns), editabile din admin → Pagini. */
export function parseFaq(markdown: string): { q: string; a: string }[] {
  return markdown
    .split(/\n(?=## )/)
    .map((b) => b.trim())
    .filter((b) => b.startsWith("## "))
    .map((b) => {
      const [q, ...rest] = b.split("\n");
      return { q: q.replace(/^##\s+/, ""), a: rest.join("\n").trim() };
    });
}

export function Faq({ markdown }: { markdown: string }) {
  const items = parseFaq(markdown);
  return (
    <div className="divide-y divide-line border-y border-line">
      {items.map((it, i) => (
        <details key={i} className="group py-5" open={i === 0}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-lg font-semibold">
            {it.q}
            <span className="grid size-7 shrink-0 place-items-center rounded-full border border-line text-muted transition group-open:rotate-45 group-open:border-brand-700 group-open:text-brand-700">+</span>
          </summary>
          <p className="mt-3 leading-relaxed whitespace-pre-line text-muted">{it.a}</p>
        </details>
      ))}
    </div>
  );
}
