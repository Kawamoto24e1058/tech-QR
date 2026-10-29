/**
 * 名刺 SVG（テック部 / 白黒）— デザイン「BADGE」
 *
 * - 91mm × 55mm（viewBox 0 0 910 550。1 単位 = 0.1mm）。塗り足し 3mm 付きなら 97mm × 61mm（viewBox -30 -30 970 610）
 * - 文字はすべて**アウトライン（図形）**で出力するので、入稿データでフォントが変わらない（src/fonts.ts）
 * - 見た目を直すときはこのファイルの数値を書き換えて再デプロイ。名刺はこの 1 デザインに固定（組織で統一）
 * - 安全域: 文字・ロゴは仕上がり線から 3mm 以上内側（左右 ≥ 40 / 上下 ≥ 36）。背景・白帯は塗り足しまで伸ばす
 * - 黒は #0a0a0c（画面用）。印刷所には「リッチブラック（K100 + C/M/Y 少量）」を指定するときれいに出る
 */
import { encode } from "uqr";
import { buildTypesetter, fitSize, googleFontLoader, type FontLoader, type Typesetter } from "./fonts";
import { LOGO_BLACK_DATA_URI } from "./logo";

const INK = "#0a0a0c";
const PAPER = "#ffffff";
const SOFT = "#e4e4e7";
const BLEED = 30;

export interface CardFields {
  /** メンバー ID（QR の URL と、名刺上の ID 表記・バーコード柄に使う） */
  id: string;
  nameJp: string;
  nameEn: string;
  roleJp: string;
  roleEn: string;
  email: string;
  githubId: string;
  xId: string;
  skillTags: string[];
}

export interface RenderOpts {
  /** 塗り足し 3mm 付き（97×61mm）で出力する。入稿用の既定は true、画面プレビューは false */
  bleed?: boolean;
  /** 黒ロゴを埋め込まず URL 参照にする（管理画面の軽量プレビュー用） */
  logoHref?: string;
  /** フォント取得処理の差し替え（テスト用） */
  fontLoader?: FontLoader;
}

/* ────────────────────────────────────────────────────────────
 *  公開 API
 * ──────────────────────────────────────────────────────────── */

export async function buildFrontCard(f: CardFields, opts: RenderOpts = {}): Promise<string> {
  const logo = opts.logoHref ?? LOGO_BLACK_DATA_URI;
  const ts = await buildTypesetter((t) => front(t, f, logo), opts.fontLoader ?? googleFontLoader);
  return svg(front(ts, f, logo), opts.bleed ?? true);
}

export async function buildBackCard(f: CardFields, qrTargetUrl: string, opts: RenderOpts = {}): Promise<string> {
  const ts = await buildTypesetter((t) => back(t, qrTargetUrl), opts.fontLoader ?? googleFontLoader);
  return svg(back(ts, qrTargetUrl), opts.bleed ?? true);
}

function svg(inner: string, bleed: boolean): string {
  const vb = bleed ? `${-BLEED} ${-BLEED} ${910 + 2 * BLEED} ${550 + 2 * BLEED}` : "0 0 910 550";
  const [w, h] = bleed ? [97, 61] : [91, 55];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${w}mm" height="${h}mm">
  <rect x="${-BLEED}" y="${-BLEED}" width="${910 + 2 * BLEED}" height="${550 + 2 * BLEED}" fill="${INK}"/>
  ${inner}
</svg>`;
}

/* ────────────────────────────────────────────────────────────
 *  表面
 * ──────────────────────────────────────────────────────────── */

function front(ts: Typesetter, f: CardFields, logoHref: string): string {
  const out: string[] = [];
  const id = f.id.toUpperCase();

  // 背面に敷く巨大なアウトライン文字（英名の最初の単語。無ければ ID）
  const giant = (f.nameEn.toUpperCase().match(/[A-Z0-9]+/)?.[0] ?? id).slice(0, 6);
  if (giant) {
    const size = fitSize(ts, "display", giant, 196, 560, 80, -3);
    const w = ts.width("display", giant, size, -3);
    out.push(ts.text("display", giant, 948 - w, 330, size, { fill: "none", stroke: PAPER, strokeWidth: 2, opacity: 0.3, tracking: -3 }));
  }

  out.push(halftone(560, -30, 380, 190));

  // 白帯 + ロゴ + 団体名
  out.push(`<rect x="${-BLEED}" y="${-BLEED}" width="${560 + BLEED}" height="130" fill="${PAPER}"/>`);
  out.push(`<image href="${logoHref}" x="44" y="32" width="38" height="58" preserveAspectRatio="xMidYMid meet"/>`);
  out.push(ts.text("display", "TECH CLUB", 104, 58, 30, { fill: INK, tracking: 1 }));
  const sub = `DEV TEAM / ${id}`;
  out.push(ts.text("mono", sub, 105, 84, fitSize(ts, "mono", sub, 18, 430, 12, 3), { fill: INK, tracking: 3 }));

  // 肩書き（白抜きの反転ブロック）
  const roleEn = f.roleEn.toUpperCase();
  if (f.roleJp || roleEn) {
    const jw = f.roleJp ? ts.width("jp", f.roleJp, 28) : 0;
    const ew = roleEn ? ts.width("mono", roleEn, 18, 4) : 0;
    const pad = 16;
    const gap = f.roleJp && roleEn ? 16 : 0;
    out.push(`<rect x="50" y="130" width="${num(pad * 2 + jw + gap + ew)}" height="50" fill="${PAPER}"/>`);
    if (f.roleJp) out.push(ts.text("jp", f.roleJp, 50 + pad, 166, 28, { fill: INK }));
    if (roleEn) out.push(ts.text("mono", roleEn, 50 + pad + jw + gap, 164, 18, { fill: INK, tracking: 4 }));
  }

  // 氏名
  const nameMain = f.nameJp || f.nameEn || f.id;
  out.push(ts.text("jp", nameMain, 44, 296, fitSize(ts, "jp", nameMain, 124, 806, 56, -2), { tracking: -2 }));
  if (f.nameJp && f.nameEn) {
    const en = f.nameEn.toUpperCase();
    out.push(ts.text("display", en, 52, 342, fitSize(ts, "display", en, 34, 806, 18, 3), { tracking: 3 }));
  }
  out.push(`<rect x="52" y="364" width="806" height="5" fill="${PAPER}"/>`);

  // スキル（先頭 3 つ）
  const tags = f.skillTags.slice(0, 3).map((t) => clip(t, 16));
  if (tags.length) {
    let size = 19;
    const widthAt = (s: number) => tags.reduce((a, t) => a + ts.width("mono", t, s) + 36, 0) + 20 * (tags.length - 1);
    while (size > 14 && widthAt(size) > 806) size -= 0.5;
    let x = 52;
    for (const t of tags) {
      const w = ts.width("mono", t, size) + 36;
      out.push(`<rect x="${num(x)}" y="388" width="${num(w)}" height="38" fill="none" stroke="${PAPER}" stroke-width="2.4"/>`);
      out.push(ts.text("mono", t, x + w / 2, 413, size, { anchor: "middle" }));
      x += w + 20;
    }
  }

  // 連絡先（存在するものを順に 3 つの枠へ）
  const items = [f.email, f.githubId && `github.com/${f.githubId}`, f.xId && `@${f.xId}`].filter(Boolean) as string[];
  const slots = [
    { x: 52, y: 468, max: 590 },
    { x: 52, y: 504, max: 440 },
    { x: 520, y: 504, max: 338 },
  ];
  items.forEach((t, i) => {
    const s = slots[i];
    out.push(ts.text("mono", t, s.x, s.y, fitSize(ts, "mono", t, 21, s.max, 14)));
  });

  out.push(barcode(668, 448, 190, 30, f.id));
  return out.join("\n  ");
}

/* ────────────────────────────────────────────────────────────
 *  裏面
 * ──────────────────────────────────────────────────────────── */

function back(ts: Typesetter, qrUrl: string): string {
  const out: string[] = [];
  out.push(`<rect x="${-BLEED}" y="${-BLEED}" width="${520 + BLEED}" height="${550 + 2 * BLEED}" fill="${PAPER}"/>`);
  out.push(qr(qrUrl || "https://example.com", 42, 48, 466));

  out.push(ts.text("display", "SCAN", 560, 150, 96, { tracking: 2 }));
  out.push(ts.text("display", "ME", 560, 236, 96, { fill: "none", stroke: PAPER, strokeWidth: 2.4, tracking: 2 }));
  out.push(`<rect x="560" y="266" width="300" height="5" fill="${PAPER}"/>`);
  const tagline = "読み取って、つながる。";
  out.push(ts.text("jp", tagline, 560, 312, fitSize(ts, "jp", tagline, 26, 310, 18)));

  const [host, path = ""] = qrUrl.replace(/^https?:\/\//, "").split(/(?=\/p\/)/);
  if (host) out.push(ts.text("mono", host, 560, 350, fitSize(ts, "mono", host, 18, 310, 12), { fill: SOFT }));
  if (path) out.push(ts.text("mono", path, 560, 376, fitSize(ts, "mono", path, 18, 310, 12)));

  out.push(halftone(560, 410, 300, 60));
  out.push(barcode(560, 480, 300, 34, qrUrl));
  return out.join("\n  ");
}

/* ────────────────────────────────────────────────────────────
 *  装飾・QR
 * ──────────────────────────────────────────────────────────── */

/** ハーフトーン（左が大きく右へ小さくなる網点） */
function halftone(x0: number, y0: number, w: number, h: number): string {
  const step = 14;
  let d = "";
  for (let i = 0; i * step <= w; i++) {
    for (let j = 0; j * step <= h; j++) {
      const r = (1 - (i * step) / 350) * 5.2 * (1 - ((j * step) / 160) * 0.35);
      if (r > 0.5) d += `<circle cx="${x0 + i * step}" cy="${y0 + j * step}" r="${num(r)}"/>`;
    }
  }
  return `<g fill="${PAPER}" fill-opacity=".9">${d}</g>`;
}

/** 文字列から決まる擬似バーコード（メンバーごとに柄が変わる） */
function barcode(x: number, y: number, w: number, h: number, seed: string): string {
  let a = 2166136261;
  for (const ch of seed) a = Math.imul(a ^ ch.charCodeAt(0), 16777619);
  const rnd = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let d = "";
  for (let cx = x; cx < x + w; ) {
    const bw = 2 + Math.floor(rnd() * 4);
    d += `<rect x="${cx}" y="${y}" width="${Math.min(bw, x + w - cx)}" height="${h}"/>`;
    cx += bw + 2 + Math.floor(rnd() * 3);
  }
  return `<g fill="${PAPER}">${d}</g>`;
}

/** 実データの QR（丸みのあるモジュール。ファインダーは 1:1:3:1:1 比を厳守）。size は 4 モジュールの余白を含む */
function qr(text: string, ox: number, oy: number, size: number): string {
  const { data, size: n } = encode(text, { ecc: "Q", border: 0 });
  const quiet = 4;
  const cell = size / (n + quiet * 2);
  const inFinder = (r: number, c: number) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);

  let dots = "";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!data[r][c] || inFinder(r, c)) continue;
      const s = cell * 0.9;
      dots += `<rect x="${num(ox + (quiet + c) * cell + (cell - s) / 2)}" y="${num(oy + (quiet + r) * cell + (cell - s) / 2)}" width="${num(s)}" height="${num(s)}" rx="${num(s * 0.06)}"/>`;
    }
  }
  const eye = (r: number, c: number) => {
    const x = ox + (quiet + c) * cell;
    const y = oy + (quiet + r) * cell;
    return (
      `<rect x="${num(x)}" y="${num(y)}" width="${num(cell * 7)}" height="${num(cell * 7)}" rx="${num(cell * 0.9)}"/>` +
      `<rect x="${num(x + cell)}" y="${num(y + cell)}" width="${num(cell * 5)}" height="${num(cell * 5)}" rx="${num(cell * 0.7)}" fill="${PAPER}"/>` +
      `<rect x="${num(x + cell * 2)}" y="${num(y + cell * 2)}" width="${num(cell * 3)}" height="${num(cell * 3)}" rx="${num(cell * 0.45)}"/>`
    );
  };
  return `<g fill="${INK}">${dots}${eye(0, 0)}${eye(0, n - 7)}${eye(n - 7, 0)}</g>`;
}

/* ────────────────────────────────────────────────────────────
 *  ユーティリティ
 * ──────────────────────────────────────────────────────────── */

function num(n: number): string {
  return Number(n.toFixed(2)).toString();
}

function clip(s: string, max: number): string {
  const t = s.trim();
  return [...t].length > max ? `${[...t].slice(0, max - 1).join("")}…` : t;
}

export function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}
