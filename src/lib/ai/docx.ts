import "server-only";
import { AlignmentType, BorderStyle, Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";

function runs(text: string, size = 22): TextRun[] {
  const out: TextRun[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(new TextRun({ text: text.slice(last, m.index), size }));
    const t = m[0];
    if (t.startsWith("**")) out.push(new TextRun({ text: t.slice(2, -2), bold: true, size }));
    else out.push(new TextRun({ text: t.slice(1, -1), italics: !t.startsWith("`"), size }));
    last = m.index + t.length;
  }
  if (last < text.length) out.push(new TextRun({ text: text.slice(last), size }));
  return out;
}

const border = { style: BorderStyle.SINGLE, size: 4, color: "BFC9CA" };

/** Răspunsul AI (Markdown) → document Word editabil. */
export async function markdownToDocx(title: string, md: string): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: title, bold: true, size: 32 })], spacing: { after: 240 } }),
  ];
  const lines = md.replace(/\r/g, "").split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.startsWith("```")) { i++; continue; }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const level = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4][h[1].length];
      children.push(new Paragraph({ heading: level, children: runs(h[2].replace(/\*\*/g, ""), 26 - h[1].length * 2), spacing: { before: 240, after: 120 } }));
      i++;
      continue;
    }
    if (line.trim().startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        if (!/^\s*\|?\s*:?-{2,}/.test(lines[i])) rows.push(lines[i].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
        i++;
      }
      const cols = Math.max(...rows.map((r) => r.length));
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: rows.map((r, ri) => new TableRow({
          children: Array.from({ length: cols }, (_, c) => new TableCell({
            borders: { top: border, bottom: border, left: border, right: border },
            children: [new Paragraph({ children: ri === 0 ? [new TextRun({ text: (r[c] ?? "").replace(/\*\*/g, ""), bold: true, size: 20 })] : runs(r[c] ?? "", 20) })],
          })),
        })),
      }));
      children.push(new Paragraph({ children: [] }));
      continue;
    }
    const li = line.match(/^(\s*)([-*•]|\d+[.)])\s+(.*)$/);
    if (li) {
      children.push(new Paragraph({ bullet: { level: Math.min(3, Math.floor(li[1].length / 2)) }, children: runs(/\d/.test(li[2]) ? `${li[2]} ${li[3]}` : li[3]), spacing: { after: 60 } }));
      i++;
      continue;
    }
    children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, children: runs(line), spacing: { after: 120, line: 300 } }));
    i++;
  }
  const doc = new Document({
    creator: "DevizConstruct.ro",
    styles: { default: { document: { run: { font: "Arial" } } } },
    sections: [{ properties: { page: { margin: { top: 1134, bottom: 1134, left: 1247, right: 1134 } } }, children }],
  });
  return Packer.toBuffer(doc);
}
