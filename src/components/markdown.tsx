import { Fragment, type ReactNode } from "react";

/** Markdown simplu → elemente React (fără HTML brut, deci sigur pentru textul generat de AI). */
function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    const k = `${keyBase}-${i++}`;
    if (t.startsWith("**")) out.push(<strong key={k}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith("`")) out.push(<code key={k} className="rounded bg-canvas px-1 text-[0.9em]">{t.slice(1, -1)}</code>);
    else out.push(<em key={k}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const cells = (line: string) => line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let k = 0;
  while (i < lines.length) {
    const line = lines[i];
    const key = `b${k++}`;
    if (!line.trim()) { i++; continue; }

    if (line.startsWith("```")) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) code.push(lines[i++]);
      i++;
      blocks.push(<pre key={key} className="overflow-x-auto rounded-lg bg-canvas p-3 text-sm">{code.join("\n")}</pre>);
      continue;
    }
    if (line.startsWith(">")) {
      const quote: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) quote.push(lines[i++].replace(/^>\s?/, ""));
      blocks.push(<blockquote key={key} className="my-3 rounded-lg border-l-4 border-amber-400 bg-amber-50 px-4 py-2.5">{inline(quote.join(" "), key)}</blockquote>);
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const cls = ["", "text-xl font-bold mt-6", "text-lg font-bold mt-6", "font-bold mt-4", "font-semibold mt-3"][h[1].length];
      blocks.push(<p key={key} className={`${cls} mb-2`}>{inline(h[2], key)}</p>);
      i++;
      continue;
    }
    if (line.trim().startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        if (!/^\s*\|?\s*:?-{2,}/.test(lines[i])) rows.push(cells(lines[i]));
        i++;
      }
      const [head, ...body] = rows;
      blocks.push(
        <div key={key} className="my-3 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead><tr>{head.map((c, j) => <th key={j} className="border border-line bg-canvas px-2.5 py-1.5 text-left font-semibold">{inline(c, `${key}h${j}`)}</th>)}</tr></thead>
            <tbody>{body.map((r, ri) => <tr key={ri}>{r.map((c, j) => <td key={j} className="border border-line px-2.5 py-1.5 align-top">{inline(c, `${key}${ri}-${j}`)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
      continue;
    }
    const li = line.match(/^(\s*)([-*•]|\d+[.)])\s+(.*)$/);
    if (li) {
      const ordered = /\d/.test(li[2]);
      const items: { indent: number; text: string }[] = [];
      while (i < lines.length) {
        const m = lines[i].match(/^(\s*)([-*•]|\d+[.)])\s+(.*)$/);
        if (!m) break;
        items.push({ indent: m[1].length, text: m[3] });
        i++;
      }
      const List = ordered ? "ol" : "ul";
      blocks.push(
        <List key={key} className={`my-2 space-y-1 pl-6 ${ordered ? "list-decimal" : "list-disc"}`}>
          {items.map((it, j) => <li key={j} style={{ marginLeft: it.indent * 6 }}>{inline(it.text, `${key}${j}`)}</li>)}
        </List>,
      );
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|```|>|\s*\||\s*([-*•]|\d+[.)])\s)/.test(lines[i])) para.push(lines[i++]);
    blocks.push(
      <p key={key} className="my-2 leading-relaxed">
        {para.map((p, j) => <Fragment key={j}>{j > 0 && <br />}{inline(p, `${key}${j}`)}</Fragment>)}
      </p>,
    );
  }
  return <div className="text-[15px]">{blocks}</div>;
}
