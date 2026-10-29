/**
 * 名刺の裏面「SEAL」の絵。メダル／認印のような円形のエンブレムと、QR を載せた白いパネル、背景の模様。
 *
 * - 円の外側: 5 つの言葉（合理的・利他的・徹底的・革新的・懐疑的）を 72° ごとに等間隔で一周
 * - 円の内側（二重の輪の間）: 校訓の一文を左右の弧で。剣先としっぽ（上下）は避ける
 * - 背景: 円の中心から広がる波紋 + ドット格子（端へ向かって薄れる）+ QR のパネルをチップに見立てた配線
 * - 白（#fff）の線だけで描く。最小の線幅は 1.4 単位（0.14mm）
 * ロゴ（剣と蛇）は呼び出し側（card-template.ts）が円の中心に置く。
 */
import type { Typesetter } from "./fonts";

const W = "#ffffff";
const K = "#0a0a0c";

const num = (n: number) => Number(n.toFixed(1)).toString();

/** 円（エンブレム）の中心と半径 */
export const SEAL = { cx: 285, cy: 275, rOut: 200, rIn: 150 } as const;
/** ロゴの高さ（円の直径と同じ。剣先としっぽが円周に届く） */
export const SEAL_LOGO_HEIGHT = 400;
/** QR を載せる白いパネル（一辺 23mm。パネルの余白がそのまま QR の静かな領域になる） */
export const PANEL = { x: 578, y: 160, size: 230 } as const;

/** 外側に並べる 5 つの言葉 */
const WORDS = ["Rational", "Altruistic", "Thorough", "Innovative", "Skeptical"];
/** 内側の一文（左の弧 / 右の弧） */
const PHRASE: [string, string] = ["We live to create a future", "that has yet to be seen."];
export const SCHOOL = "St. Andrew's University";

/* ── 円と文字 ──────────────────────────────────────── */

export function seal(ts: Typesetter): string {
  const { cx, cy, rOut, rIn } = SEAL;
  const out: string[] = [];
  out.push(`<circle cx="${cx}" cy="${cy}" r="${rOut}" fill="none" stroke="${W}" stroke-width="2.4"/>`);
  out.push(`<circle cx="${cx}" cy="${cy}" r="${rIn}" fill="none" stroke="${W}" stroke-opacity=".5" stroke-width="1.4"/>`);

  // 内側: 左の弧は下から上へ、右の弧は上から下へ（どちらも時計回り）。上下 9° ずつは剣先としっぽのため空ける
  const rPhrase = 167;
  const gap = 9;
  const arcLen = ((rPhrase * Math.PI * (180 - 2 * gap)) / 180) * 0.96;
  PHRASE.forEach((line, i) => {
    const target = i === 0 ? arcLen : (arcLen * PHRASE[1].length) / PHRASE[0].length;
    const tracking = (target - ts.width("pixel", line, 24)) / (line.length - 1);
    out.push(ts.arc("pixel", line, cx, cy, rPhrase, i === 0 ? 270 : 90, 24, { tracking }));
  });

  // 外側: 5 語を 72° ごと。語と語の間に菱形
  const rWord = 211;
  WORDS.forEach((w, i) => {
    out.push(ts.arc("pixel", w, cx, cy, rWord, i * 72, 26, { tracking: 3 }));
    const a = ((i * 72 + 36) * Math.PI) / 180;
    const [x, y] = [cx + 218 * Math.sin(a), cy - 218 * Math.cos(a)];
    out.push(`<rect x="${num(x - 3.5)}" y="${num(y - 3.5)}" width="7" height="7" fill="${W}" transform="rotate(${num(i * 72 + 36 + 45)} ${num(x)} ${num(y)})"/>`);
  });
  return out.join("\n  ");
}

/* ── 背景 ──────────────────────────────────────────── */

const trace = (d: string) => `<path d="${d}" fill="none" stroke="${W}" stroke-opacity=".55" stroke-width="1.8" stroke-linejoin="round"/>`;
const pad = (x: number, y: number, w: number, h: number) => `<rect x="${num(x - w / 2)}" y="${num(y - h / 2)}" width="${w}" height="${h}" fill="${W}" fill-opacity=".85"/>`;
const via = (x: number, y: number, r = 4.5) =>
  `<circle cx="${num(x)}" cy="${num(y)}" r="${r}" fill="${K}" stroke="${W}" stroke-opacity=".85" stroke-width="1.8"/><circle cx="${num(x)}" cy="${num(y)}" r="1.6" fill="${W}"/>`;

export function backdrop(): string {
  const { cx, cy } = SEAL;
  const { x: px, y: py, size: ps } = PANEL;
  const pcy = py + ps / 2;
  const pr = px + ps;

  let rings = "";
  for (let r = 262; r < 760; r += 22) rings += `<circle cx="${cx}" cy="${cy}" r="${r}"/>`;
  let dots = "";
  for (let y = 48; y <= 502; y += 22) for (let x = 48; x <= 862; x += 22) dots += `M${x} ${y}h0`; // 長さ 0 の線 + 丸い線端 = 点

  const o: string[] = [];
  o.push(
    `<defs><radialGradient id="bd-fade" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="560"><stop offset=".38" stop-color="${W}"/><stop offset="1" stop-color="${W}" stop-opacity="0"/></radialGradient>` +
      `<mask id="bd-mask"><rect x="-30" y="-30" width="970" height="610" fill="url(#bd-fade)"/></mask>` +
      `<clipPath id="bd-clip"><rect x="37" y="37" width="836" height="476"/></clipPath></defs>`,
  );
  o.push(
    `<g mask="url(#bd-mask)" clip-path="url(#bd-clip)"><g fill="none" stroke="${W}" stroke-opacity=".16" stroke-width="1.4">${rings}</g>` +
      `<path d="${dots}" fill="none" stroke="${W}" stroke-opacity=".2" stroke-width="3" stroke-linecap="round"/></g>`,
  );

  // 配線: 左（円とパネルをつなぐバス）・上（斜めに広がる）・右（枠へ）
  const t: string[] = [];
  for (let i = 0; i < 5; i++) {
    const y = pcy - 40 + i * 20;
    t.push(trace(`M532 ${y}H${px - 6}`), pad(532, y, 8, 8), pad(px - 6, y, 8, 8));
  }
  for (let i = 0; i < 5; i++) {
    const x = px + 40 + (i * (ps - 80)) / 4;
    const tx = x + (i - 2) * 18;
    t.push(trace(`M${x} ${py - 2}V${py - 30}L${num(tx)} ${num(py - 30 - Math.abs(tx - x))}V76`), i % 2 ? via(tx, 64) : pad(tx, 64, 7, 10));
  }
  for (let i = 0; i < 5; i++) {
    const y = pcy - 40 + i * 20;
    const ey = y + (i - 2) * 8;
    t.push(trace(`M${pr + 2} ${y}H${pr + 14 + (i % 2) * 10}L${pr + 30 + (i % 2) * 10} ${ey}H854`), pad(854, ey, 8, 8));
  }
  o.push(`<g clip-path="url(#bd-clip)">${t.join("")}</g>`);
  return o.join("\n  ");
}
