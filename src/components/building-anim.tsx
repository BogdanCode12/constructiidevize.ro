/*
 * Ilustrație izometrică animată pentru panou: blocul se ridică etaj cu etaj, apare fierul de pe acoperiș,
 * balustradele, fațada și materialele de pe șantier. Animația rulează o singură dată (~6 s), apoi rămâne fixă.
 * Doar SVG + CSS (fără JavaScript); cu „reduce motion” se afișează direct desenul final.
 */

const S = 13; // pixeli pe unitate
const H = 2.6; // înălțimea unui etaj
const FLOORS = 4;
const W = 8; // lungimea blocului (axa x)
const D = 5; // adâncimea (axa y)
const COLS_X = [0, 2, 4, 6, 8];
const COLS_Y = [0, 2.5, 5];

type Pt = [number, number, number];

const proj = ([x, y, z]: Pt) => [(x - y) * 0.866 * S, (x + y) * 0.5 * S - z * S];
function pt(p: Pt) {
  const [X, Y] = proj(p);
  return `${X.toFixed(1)},${Y.toFixed(1)}`;
}
const poly = (pts: Pt[]) => pts.map(pt).join(" ");

type Tone = { top: string; left: string; right: string; stroke?: string };
const CONCRETE: Tone = { top: "#f1f1ef", left: "#d9d9d6", right: "#c4c4c1", stroke: "#a3a3a0" };
const COLUMN: Tone = { top: "#e6e6e3", left: "#d2d2cf", right: "#b9b9b6", stroke: "#9b9b98" };

function Box({ a, b, tone, className, style }: { a: Pt; b: Pt; tone: Tone; className?: string; style?: React.CSSProperties }) {
  const [x0, y0, z0] = a;
  const [x1, y1, z1] = b;
  const sw = tone.stroke ? 0.6 : 0;
  return (
    <g className={className} style={style} stroke={tone.stroke ?? "none"} strokeWidth={sw} strokeLinejoin="round">
      <polygon points={poly([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]])} fill={tone.left} />
      <polygon points={poly([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]])} fill={tone.right} />
      <polygon points={poly([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]])} fill={tone.top} />
    </g>
  );
}

const line = (a: Pt, b: Pt) => {
  const [x1, y1] = pt(a).split(",");
  const [x2, y2] = pt(b).split(",");
  return { x1, y1, x2, y2 };
};

function Railing({ z }: { z: number }) {
  const r = 0.3;
  const segs: [Pt, Pt][] = [
    [[-r, D + r, z + 0.9], [W + r, D + r, z + 0.9]],
    [[-r, D + r, z + 0.45], [W + r, D + r, z + 0.45]],
    [[W + r, -r, z + 0.9], [W + r, D + r, z + 0.9]],
    [[W + r, -r, z + 0.45], [W + r, D + r, z + 0.45]],
  ];
  for (let x = -r; x <= W + r + 0.01; x += (W + 2 * r) / 8) segs.push([[x, D + r, z], [x, D + r, z + 0.9]]);
  for (let y = -r; y <= D + r + 0.01; y += (D + 2 * r) / 5) segs.push([[W + r, y, z], [W + r, y, z + 0.9]]);
  return (
    <g className="b-fade" style={{ animationDelay: `${3.6 + z * 0.05}s` }} stroke="#c71319" strokeWidth={0.75} strokeLinecap="round">
      {segs.map(([a, b], i) => <line key={i} {...line(a, b)} />)}
    </g>
  );
}

function Panels({ f }: { f: number }) {
  const z0 = f * H + 0.05;
  const z1 = (f + 1) * H - 0.3;
  const out: { pts: Pt[]; mull: [Pt, Pt][] }[] = [];
  for (const [ya, yb] of [[0.15, 2.35], [2.65, 4.85]]) {
    const xf = W + 0.06;
    out.push({
      pts: [[xf, ya, z0], [xf, yb, z0], [xf, yb, z1], [xf, ya, z1]],
      mull: [[[xf, (ya + yb) / 2, z0], [xf, (ya + yb) / 2, z1]], [[xf, ya, (z0 + z1) / 2], [xf, yb, (z0 + z1) / 2]]],
    });
  }
  const yf = D + 0.06;
  out.push({
    pts: [[6.15, yf, z0], [7.85, yf, z0], [7.85, yf, z1], [6.15, yf, z1]],
    mull: [[[7, yf, z0], [7, yf, z1]], [[6.15, yf, (z0 + z1) / 2], [7.85, yf, (z0 + z1) / 2]]],
  });
  return (
    <g className="b-panel" style={{ animationDelay: `${4.2 + f * 0.25}s` }}>
      {out.map((p, i) => (
        <g key={i}>
          <polygon points={poly(p.pts)} fill="#c71319" fillOpacity={0.62} stroke="#a20f14" strokeWidth={0.6} />
          {p.mull.map(([a, b], j) => <line key={j} {...line(a, b)} stroke="#f6c9cb" strokeWidth={0.5} />)}
        </g>
      ))}
    </g>
  );
}

function Floor({ f }: { f: number }) {
  const z0 = f * H;
  const zTop = (f + 1) * H;
  const cols = COLS_X.flatMap((x) => COLS_Y.map((y) => [x, y] as const)).sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
  return (
    <g className="b-rise" style={{ animationDelay: `${0.5 + f * 0.75}s` }}>
      {/* pereții din spate (interiorul se vede mai închis) */}
      <polygon points={poly([[0, 0, z0], [W, 0, z0], [W, 0, zTop], [0, 0, zTop]])} fill="#cfcfcc" />
      <polygon points={poly([[0, 0, z0], [0, D, z0], [0, D, zTop], [0, 0, zTop]])} fill="#bdbdba" />
      {/* casa scării */}
      <Box a={[0.4, 0.3, z0]} b={[2.2, 1.9, zTop - 0.3]} tone={CONCRETE} />
      {cols.map(([x, y]) => (
        <Box key={`${x}-${y}`} a={[x - 0.2, y - 0.2, z0]} b={[x + 0.2, y + 0.2, zTop - 0.3]} tone={COLUMN} />
      ))}
      {f > 0 && <Panels f={f} />}
      {f > 0 && <Railing z={z0} />}
      <Box a={[-0.3, -0.3, zTop - 0.3]} b={[W + 0.3, D + 0.3, zTop]} tone={CONCRETE} />
    </g>
  );
}

function Rebar() {
  const top = FLOORS * H;
  const bars: [Pt, Pt][] = [];
  for (const x of COLS_X) for (const y of COLS_Y) {
    for (const [dx, dy] of [[-0.1, -0.1], [0.1, 0.1], [0.1, -0.1]]) bars.push([[x + dx, y + dy, top], [x + dx, y + dy, top + 1.7]]);
  }
  bars.sort((a, b) => a[0][0] + a[0][1] - (b[0][0] + b[0][1]));
  return (
    <g className="b-grow" style={{ animationDelay: "3.4s" }} stroke="#5f6266" strokeWidth={0.7} strokeLinecap="round">
      {bars.map(([a, b], i) => <line key={i} {...line(a, b)} />)}
    </g>
  );
}

function Scaffold() {
  const x = W + 0.9;
  const top = FLOORS * H + 1;
  const ys = [-0.3, 1.1, 2.5, 3.9, 5.3];
  const segs: [Pt, Pt][] = [];
  for (const y of ys) segs.push([[x, y, 0], [x, y, top]], [[x + 0.7, y, 0], [x + 0.7, y, top]]);
  for (let z = 0; z <= top + 0.01; z += H / 2) {
    segs.push([[x, ys[0], z], [x, ys[ys.length - 1], z]], [[x + 0.7, ys[0], z], [x + 0.7, ys[ys.length - 1], z]]);
  }
  for (let i = 0; i < ys.length - 1; i++) for (let z = 0; z < top - 0.1; z += H) segs.push([[x + 0.7, ys[i], z], [x + 0.7, ys[i + 1], z + H / 2]]);
  return (
    <g className="b-fade" style={{ animationDelay: "2.6s" }} stroke="#8d8f92" strokeWidth={0.5}>
      {segs.map(([a, b], i) => <line key={i} {...line(a, b)} />)}
    </g>
  );
}

function Crane() {
  const cx = 11.5, cy = -2.2, top = 14.2;
  const segs: [Pt, Pt][] = [
    [[cx - 0.3, cy, 0], [cx - 0.3, cy, top]], [[cx + 0.3, cy, 0], [cx + 0.3, cy, top]],
    [[cx - 11, cy, top], [cx + 3.5, cy, top]], [[cx - 9, cy, top + 0.9], [cx + 3.5, cy, top + 0.9]],
    [[cx, cy, top + 2.4], [cx - 9, cy, top + 0.9]], [[cx, cy, top + 2.4], [cx + 3.5, cy, top + 0.9]],
    [[cx, cy, top], [cx, cy, top + 2.4]],
  ];
  for (let z = 0; z < top; z += 1.1) segs.push([[cx - 0.3, cy, z], [cx + 0.3, cy, z + 1.1]]);
  for (let x = cx - 11; x < cx + 3.4; x += 1.2) segs.push([[x, cy, top], [x + 0.6, cy, top + 0.9 * Math.min(1, (x - (cx - 11)) / 2 + 0.3)]]);
  const hx = 6.2;
  return (
    <g className="b-fade" style={{ animationDelay: "0.2s" }}>
      <g stroke="#2a2c2f" strokeWidth={0.55} strokeLinecap="round">
        {segs.map(([a, b], i) => <line key={i} {...line(a, b)} />)}
      </g>
      <Box a={[cx + 2.2, cy - 0.4, top - 1.1]} b={[cx + 3.5, cy + 0.4, top]} tone={{ top: "#e0464b", left: "#c71319", right: "#a20f14" }} />
      <g className="b-hook">
        <line {...line([hx, cy, top], [hx, cy, top - 3.5])} stroke="#2a2c2f" strokeWidth={0.45} />
        <Box a={[hx - 0.6, cy - 0.6, top - 4.6]} b={[hx + 0.6, cy + 0.6, top - 3.5]} tone={{ top: "#eef1f4", left: "#cfd8e1", right: "#a9b8c7", stroke: "#8899aa" }} />
      </g>
    </g>
  );
}

function Materials() {
  const BLOCK: Tone = { top: "#f2f2f0", left: "#dcdcd9", right: "#c8c8c5", stroke: "#a9a9a6" };
  const BRICK: Tone = { top: "#ecdcbf", left: "#d9c29b", right: "#c4aa80", stroke: "#a8916b" };
  const STEEL: Tone = { top: "#c4d1de", left: "#9fb1c4", right: "#7e93a8", stroke: "#6b7f94" };
  const items: { a: Pt; b: Pt; tone: Tone; d: number }[] = [
    { a: [-2.6, 6.4, 0], b: [-1.2, 7.6, 1.1], tone: BLOCK, d: 1.2 },
    { a: [-1, 6.4, 0], b: [0.4, 7.6, 1.1], tone: BLOCK, d: 1.35 },
    { a: [-2.6, 6.4, 1.1], b: [-1.2, 7.6, 2.2], tone: BLOCK, d: 1.5 },
    { a: [2.2, 8.4, 0], b: [7.4, 9.2, 0.55], tone: STEEL, d: 1.9 },
    { a: [10.6, 4.8, 0], b: [11.9, 6, 1], tone: BRICK, d: 2.2 },
    { a: [10.6, 6.4, 0], b: [11.9, 7.6, 1], tone: BRICK, d: 2.35 },
    { a: [12.3, 0.2, 0], b: [13.7, 1.4, 1.1], tone: BLOCK, d: 2.5 },
    { a: [12.3, 1.7, 0], b: [13.7, 2.9, 1.1], tone: BLOCK, d: 2.6 },
  ];
  items.sort((p, q) => p.a[0] + p.a[1] - (q.a[0] + q.a[1]));
  return (
    <>
      {items.map((m, i) => <Box key={i} a={m.a} b={m.b} tone={m.tone} className="b-drop" style={{ animationDelay: `${m.d}s` }} />)}
    </>
  );
}

function Ground() {
  const lines: [Pt, Pt][] = [];
  for (let x = -3; x <= 14; x += 1) lines.push([[x, -3, 0], [x, 9.6, 0]]);
  for (let y = -3; y <= 9; y += 1) lines.push([[-3, y, 0], [14, y, 0]]);
  return (
    <g className="b-fade" style={{ animationDelay: "0s" }}>
      <polygon points={poly([[-3, -3, 0], [14, -3, 0], [14, 9.6, 0], [-3, 9.6, 0]])} fill="#fafaf9" />
      <g stroke="#ececea" strokeWidth={0.4}>{lines.map(([a, b], i) => <line key={i} {...line(a, b)} />)}</g>
      <Box a={[-0.6, -0.6, 0]} b={[W + 0.6, D + 0.6, 0.3]} tone={CONCRETE} />
    </g>
  );
}

/** Cadrul desenului: colțurile terenului și vârful macaralei. */
const VIEWBOX = (() => {
  const pts = ([[-3, -3, 0], [14, -3, 0], [14, 9.6, 0], [-3, 9.6, 0], [0.5, -2.2, 16.6], [15, -2.2, 15.1]] as Pt[]).map(proj);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const pad = 4;
  const x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - pad;
  return `${x0.toFixed(0)} ${y0.toFixed(0)} ${(Math.max(...xs) - x0 + pad).toFixed(0)} ${(Math.max(...ys) - y0 + pad).toFixed(0)}`;
})();

export function BuildingAnim({ className = "" }: { className?: string }) {
  const body = (
    <>
      <Ground />
      <Crane />
      {Array.from({ length: FLOORS }, (_, f) => <Floor key={f} f={f} />)}
      <g className="b-rise" style={{ animationDelay: `${0.5 + FLOORS * 0.75}s` }}>
        <Railing z={FLOORS * H} />
        <Box a={[0.4, 0.3, FLOORS * H]} b={[2.2, 1.9, FLOORS * H + 1.6]} tone={CONCRETE} />
        <Box a={[4.6, 1, FLOORS * H]} b={[6.2, 2.4, FLOORS * H + 1.2]} tone={CONCRETE} />
      </g>
      <Rebar />
      <Scaffold />
      <Materials />
    </>
  );
  return (
    <svg viewBox={VIEWBOX} className={`building-anim ${className}`} role="img" aria-label="Bloc în construcție: structura, fierul și materialele de pe șantier">
      {body}
    </svg>
  );
}
