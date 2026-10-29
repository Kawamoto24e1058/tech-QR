/**
 * 名刺 SVG（テック部 / 白黒）— デザイン「CIRCUIT」
 *
 * ロゴの回路を紙面全体へ延長し、計測目盛り・十字・ID 表記で「エンジニアの身分証」に見立てたデザイン。
 *
 * - 91mm × 55mm（viewBox 0 0 910 550。1 単位 = 0.1mm）。塗り足し 3mm 付きなら 97mm × 61mm（viewBox -30 -30 970 610）
 * - 文字はすべて**アウトライン（図形）**で出力するので、入稿データでフォントが変わらない（src/fonts.ts）
 * - 見た目を直すときはこのファイルの数値を書き換えて再デプロイ。名刺はこの 1 デザインに固定（組織で統一）
 * - 安全域: 枠線は仕上がり線から 4mm、文字・ロゴは 6.4mm 以上内側。背景と回路の線は塗り足しまで伸ばす
 * - 黒は #0a0a0c（画面用）。印刷所には「リッチブラック（K100 + C/M/Y 少量）」を指定するときれいに出る
 */
import { encode } from "uqr";
import { buildTypesetter, fitSize, googleFontLoader, type FontLoader, type Typesetter } from "./fonts";
import { LOGO_HEIGHT, LOGO_WHITE_DATA_URI, LOGO_WIDTH } from "./logo";

const INK = "#0a0a0c";
const PAPER = "#ffffff";
const SOFT = "#e4e4e7";
const DIM = "#c4c4cc";
const BLEED = 30;
/** 枠線の内側余白（仕上がり線から 4mm）と、コンテンツの左右端 */
const FRAME = 40;
const LEFT = 64;
const RIGHT = 846;

export interface CardFields {
  /** メンバー ID（QR の URL と、名刺上の ID 表記に使う） */
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
  /** 白ロゴを埋め込まず URL 参照にする（管理画面の軽量プレビュー用） */
  logoHref?: string;
  /** フォント取得処理の差し替え（テスト用） */
  fontLoader?: FontLoader;
}

/* ────────────────────────────────────────────────────────────
 *  公開 API
 * ──────────────────────────────────────────────────────────── */

export async function buildFrontCard(f: CardFields, opts: RenderOpts = {}): Promise<string> {
  const logo = opts.logoHref ?? LOGO_WHITE_DATA_URI;
  const ts = await buildTypesetter((t) => front(t, f), opts.fontLoader ?? googleFontLoader);
  return svg(front(ts, f), logo, opts.bleed ?? true);
}

export async function buildBackCard(_f: CardFields, qrTargetUrl: string, opts: RenderOpts = {}): Promise<string> {
  const logo = opts.logoHref ?? LOGO_WHITE_DATA_URI;
  const ts = await buildTypesetter((t) => back(t, qrTargetUrl), opts.fontLoader ?? googleFontLoader);
  return svg(back(ts, qrTargetUrl), logo, opts.bleed ?? true);
}

function svg(inner: string, logoHref: string, bleed: boolean): string {
  const vb = bleed ? `${-BLEED} ${-BLEED} ${910 + 2 * BLEED} ${550 + 2 * BLEED}` : "0 0 910 550";
  const [w, h] = bleed ? [97, 61] : [91, 55];
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${vb}" width="${w}mm" height="${h}mm">
  <defs>
    <symbol id="lg" viewBox="0 0 ${LOGO_WIDTH} ${LOGO_HEIGHT}" preserveAspectRatio="xMidYMid meet"><image href="${logoHref}" width="${LOGO_WIDTH}" height="${LOGO_HEIGHT}"/></symbol>
    <linearGradient id="cf" gradientUnits="userSpaceOnUse" x1="950" y1="0" x2="330" y2="0">
      <stop offset="0" stop-color="${PAPER}" stop-opacity=".4"/><stop offset="1" stop-color="${PAPER}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect x="${-BLEED}" y="${-BLEED}" width="${910 + 2 * BLEED}" height="${550 + 2 * BLEED}" fill="${INK}"/>
  ${inner}
</svg>`;
}

const logo = (x: number, y: number, w: number, h: number, opacity = 1) =>
  `<use href="#lg" xlink:href="#lg" x="${x}" y="${y}" width="${w}" height="${h}"${opacity < 1 ? ` opacity="${opacity}"` : ""}/>`;

/* ────────────────────────────────────────────────────────────
 *  表面
 * ──────────────────────────────────────────────────────────── */

function front(ts: Typesetter, f: CardFields): string {
  const out: string[] = [];
  const id = f.id.toUpperCase();

  out.push(`<g>${traces(7, 18)}</g>`);
  out.push(logo(560, 30, 330, 517, 0.14));
  out.push(frame("top"));

  // ヘッダ
  out.push(logo(LEFT, 64, 44, 70));
  out.push(ts.text("display", "TECH CLUB", 124, 94, 26, { tracking: 5 }));
  out.push(ts.text("mono", "DEV TEAM", 125, 124, 18, { fill: DIM, tracking: 3 }));
  out.push(ts.text("mono", "MEMBER CARD", RIGHT, 94, 18, { fill: DIM, tracking: 2, anchor: "end" }));
  const idLine = `ID / ${id}`;
  out.push(ts.text("mono", idLine, RIGHT, 124, fitSize(ts, "mono", idLine, 18, 380, 12, 2), { tracking: 2, anchor: "end" }));
  out.push(rule(158, 0.5));

  // 肩書き（枠線のピル）
  const roleEn = f.roleEn.toUpperCase();
  if (f.roleJp || roleEn) {
    const jw = f.roleJp ? ts.width("jpBold", f.roleJp, 26) : 0;
    const ew = roleEn ? ts.width("mono", roleEn, 18, 3) : 0;
    const gap = f.roleJp && roleEn ? 14 : 0;
    const w = 24 + jw + gap + ew + 24;
    out.push(`<rect x="${LEFT}" y="180" width="${num(w)}" height="46" rx="23" fill="none" stroke="${PAPER}" stroke-width="2"/>`);
    if (f.roleJp) out.push(ts.text("jpBold", f.roleJp, LEFT + 24, 212, 26));
    if (roleEn) out.push(ts.text("mono", roleEn, LEFT + 24 + jw + gap, 210, 18, { fill: SOFT, tracking: 3 }));
  }

  // 氏名
  const nameMain = f.nameJp || f.nameEn || f.id;
  out.push(ts.text("jp", nameMain, 60, 330, fitSize(ts, "jp", nameMain, 104, RIGHT - 60, 52, 2), { tracking: 2 }));
  if (f.nameJp && f.nameEn) {
    const en = f.nameEn.toUpperCase();
    out.push(ts.text("display", en, LEFT, 376, fitSize(ts, "display", en, 30, RIGHT - LEFT, 18, 9), { fill: SOFT, tracking: 9 }));
  }

  // スキル（先頭 3 つを [ ] で囲む）
  const tags = f.skillTags.slice(0, 3).map((t) => `[ ${clip(t, 16)} ]`);
  if (tags.length) {
    const widthAt = (s: number) => tags.reduce((a, t) => a + ts.width("mono", t, s), 0) + 28 * (tags.length - 1);
    let size = 20;
    while (size > 14 && widthAt(size) > RIGHT - LEFT) size -= 0.5;
    let x = LEFT;
    for (const t of tags) {
      out.push(ts.text("mono", t, x, 426, size, { fill: SOFT }));
      x += ts.width("mono", t, size) + 28;
    }
  }

  // 連絡先（アイコン + 文字を 1 行に並べる）
  out.push(rule(452, 0.5));
  const items: Array<{ icon: (x: number, y: number) => string; text: string }> = [];
  if (f.email) items.push({ icon: iconMail, text: f.email });
  if (f.githubId) items.push({ icon: iconGit, text: `github.com/${f.githubId}` });
  if (f.xId) items.push({ icon: iconX, text: `@${f.xId}` });
  if (items.length) {
    const ICON = 22 + 12;
    const GAP = 34;
    const widthAt = (s: number) => items.reduce((a, it) => a + ICON + ts.width("mono", it.text, s), 0) + GAP * (items.length - 1);
    let size = 20;
    while (size > 14 && widthAt(size) > RIGHT - LEFT) size -= 0.5;
    let x = LEFT;
    for (const it of items) {
      out.push(it.icon(x, 478));
      out.push(ts.text("mono", it.text, x + ICON, 494, size));
      x += ICON + ts.width("mono", it.text, size) + GAP;
    }
  }
  return out.join("\n  ");
}

/* ────────────────────────────────────────────────────────────
 *  裏面
 * ──────────────────────────────────────────────────────────── */

function back(ts: Typesetter, qrUrl: string): string {
  const out: string[] = [];
  out.push(`<g>${traces(21, 22)}</g>`);
  out.push(`<g transform="translate(910 0) scale(-1 1)">${traces(5, 14)}</g>`);
  out.push(frame("bottom"));

  out.push(ts.text("display", "SCAN TO CONNECT", 455, 90, 22, { tracking: 9, anchor: "middle" }));

  // QR（白いパネルの中）。パネル四隅に細いカギ括弧
  const px = 315, py = 112, pw = 280;
  out.push(`<rect x="${px}" y="${py}" width="${pw}" height="${pw}" rx="22" fill="${PAPER}"/>`);
  out.push(qr(qrUrl || "https://example.com", px + 8, py + 8, pw - 16));
  for (const [cx, cy, sx, sy] of [[px - 14, py - 14, 1, 1], [px + pw + 14, py - 14, -1, 1], [px - 14, py + pw + 14, 1, -1], [px + pw + 14, py + pw + 14, -1, -1]]) {
    out.push(`<path d="M${cx} ${cy + 20 * sy} V${cy} H${cx + 20 * sx}" fill="none" stroke="${PAPER}" stroke-width="2"/>`);
  }

  const shown = qrUrl.replace(/^https?:\/\//, "");
  out.push(ts.text("mono", shown, 455, py + pw + 44, fitSize(ts, "mono", shown, 20, 700, 13), { anchor: "middle" }));

  out.push(logo(433, 430, 44, 54));
  out.push(ts.text("mono", "TECH CLUB", LEFT, 484, 18, { fill: DIM, tracking: 3 }));
  out.push(ts.text("mono", String(new Date().getFullYear()), RIGHT, 484, 18, { fill: DIM, tracking: 3, anchor: "end" }));
  return out.join("\n  ");
}

/* ────────────────────────────────────────────────────────────
 *  装飾
 * ──────────────────────────────────────────────────────────── */

/** 外枠 + 四隅の十字 + 目盛り（上辺 or 下辺） */
function frame(ticks: "top" | "bottom"): string {
  const x0 = FRAME, y0 = FRAME, x1 = 910 - FRAME, y1 = 550 - FRAME;
  const cross = (x: number, y: number) => `<path d="M${x - 8} ${y} h16 M${x} ${y - 8} v16" stroke="${PAPER}" stroke-width="2"/>`;
  let t = "";
  for (let i = 0; i <= 38; i++) {
    const x = 70 + i * 20;
    const len = i % 5 === 0 ? 12 : 6;
    t += ticks === "top" ? `M${x} ${y0 + 6} v${len}` : `M${x} ${y1 - 6} v${-len}`;
  }
  return `<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="none" stroke="${PAPER}" stroke-width="2"/>
  ${cross(x0, y0)}${cross(x1, y0)}${cross(x0, y1)}${cross(x1, y1)}
  <path d="${t}" stroke="${PAPER}" stroke-opacity=".4" stroke-width="1.4" fill="none"/>`;
}

const rule = (y: number, op: number) =>
  `<path d="M${LEFT} ${y} H${RIGHT}" stroke="${PAPER}" stroke-opacity="${op}" stroke-width="1.5"/>`;

/** 回路の配線（右端の塗り足しの外から左へ伸び、90°/45°で曲がり、端にノード）。左へ行くほど薄くなる */
function traces(seed: number, n: number): string {
  let a = seed >>> 0;
  const rnd = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const y0 = 30, y1 = 520, xMin = 330;
  let s = "";
  for (let i = 0; i < n; i++) {
    let y = Math.round((y0 + rnd() * (y1 - y0)) / 10) * 10;
    let x = 950;
    let d = `M${x} ${y}`;
    const segs = 2 + Math.floor(rnd() * 3);
    const stop = xMin + rnd() * 570 * 0.55;
    for (let k = 0; k < segs && x > stop; k++) {
      x = Math.max(x - (50 + rnd() * 150), stop);
      d += ` H${num(x)}`;
      if (k < segs - 1) {
        const dy = (rnd() < 0.5 ? -1 : 1) * (20 + rnd() * 50);
        y = Math.min(y1, Math.max(y0, y + dy));
        x -= Math.abs(dy) * 0.6;
        d += ` L${num(x)} ${num(y)}`;
      }
    }
    s += `<path d="${d}" fill="none" stroke="url(#cf)" stroke-width="1.8" stroke-linejoin="round"/>`;
    const op = Math.max(0, Math.min(0.7, ((x - xMin) / 620) * 0.9 + 0.25));
    s += rnd() < 0.5
      ? `<circle cx="${num(x)}" cy="${num(y)}" r="5" fill="${INK}" stroke="${PAPER}" stroke-opacity="${num(op)}" stroke-width="1.8"/>`
      : `<circle cx="${num(x)}" cy="${num(y)}" r="3.4" fill="${PAPER}" fill-opacity="${num(op)}"/>`;
  }
  return s;
}

const iconMail = (x: number, y: number) =>
  `<g transform="translate(${x} ${y})" fill="none" stroke="${PAPER}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"><rect x="0" y="0" width="22" height="16" rx="2.5"/><path d="M1.5 2.5 L11 10 L20.5 2.5"/></g>`;
const iconGit = (x: number, y: number) =>
  `<g transform="translate(${x} ${y - 2})" fill="none" stroke="${PAPER}" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="10.5"/><circle cx="11" cy="8.6" r="3.6"/><path d="M4.2 18.2 Q11 12.6 17.8 18.2"/></g>`;
const iconX = (x: number, y: number) =>
  `<g transform="translate(${x + 1} ${y - 1})" stroke="${PAPER}" stroke-width="2.2" stroke-linecap="round"><path d="M1 1 L19 19 M19 1 L1 19"/></g>`;

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
      dots += `<rect x="${num(ox + (quiet + c) * cell + (cell - s) / 2)}" y="${num(oy + (quiet + r) * cell + (cell - s) / 2)}" width="${num(s)}" height="${num(s)}" rx="${num(s * 0.16)}"/>`;
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
