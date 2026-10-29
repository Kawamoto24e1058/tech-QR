/**
 * 名刺 SVG（テック部 / 白黒）— デザイン「FRAME」
 *
 * - 91mm × 55mm（viewBox 0 0 910 550。1 単位 = 0.1mm）。塗り足し 3mm 付きなら 97mm × 61mm（viewBox -30 -30 970 610）
 * - 文字はすべて**アウトライン（図形）**で出力するので、入稿データでフォントが変わらない（src/fonts.ts）
 * - 見た目を直すときはこのファイルの数値を書き換えて再デプロイ。名刺はこの 1 デザインに固定（組織で統一）
 * - 黒地に白。細い枠線とコーナー十字で額装し、主役は氏名（表）と QR（裏）。白いベタ面は使わない
 * - 安全域: 文字・ロゴ・枠線は仕上がり線から 3.6mm 以上内側。背景は塗り足しまで伸ばす
 * - 黒は #0a0a0c（画面用）。印刷所には「リッチブラック（K100 + C/M/Y 少量）」を指定するときれいに出る
 */
import { encode } from "uqr";
import { buildTypesetter, fitSize, googleFontLoader, type FontLoader, type Typesetter } from "./fonts";
import { LOGO_HEIGHT, LOGO_WHITE_DATA_URI, LOGO_WIDTH } from "./logo";

const INK = "#0a0a0c";
const PAPER = "#ffffff";
const SOFT = "#e4e4e7";
const BLEED = 30;
/** 枠線の内側の余白（仕上がり線から） */
const FRAME = 36;
/** 本文の左端 / 右端 */
const L = 68;
const R = 842;

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
  const ts = await buildTypesetter((t) => front(t, f), opts.fontLoader ?? googleFontLoader);
  return svg(front(ts, f), opts);
}

/** 裏面は QR とロゴだけで文字がないので、フォントの取得は要らない */
export async function buildBackCard(_f: CardFields, qrTargetUrl: string, opts: RenderOpts = {}): Promise<string> {
  return svg(back(qrTargetUrl), opts);
}

/** ロゴは 1 度だけ <symbol> として定義し、何度でも <use> で置く（SVG が太らない） */
function svg(inner: string, opts: RenderOpts): string {
  const bleed = opts.bleed ?? true;
  const vb = bleed ? `${-BLEED} ${-BLEED} ${910 + 2 * BLEED} ${550 + 2 * BLEED}` : "0 0 910 550";
  const [w, h] = bleed ? [97, 61] : [91, 55];
  const href = opts.logoHref ?? LOGO_WHITE_DATA_URI;
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${vb}" width="${w}mm" height="${h}mm">
  <defs><symbol id="lg" viewBox="0 0 ${LOGO_WIDTH} ${LOGO_HEIGHT}"><image href="${href}" xlink:href="${href}" width="${LOGO_WIDTH}" height="${LOGO_HEIGHT}"/></symbol></defs>
  <rect x="${-BLEED}" y="${-BLEED}" width="${910 + 2 * BLEED}" height="${550 + 2 * BLEED}" fill="${INK}"/>
  ${inner}
</svg>`;
}

/* ────────────────────────────────────────────────────────────
 *  共通部品
 * ──────────────────────────────────────────────────────────── */

/** 全部大文字の英名・肩書きは「Haru Kawamoto」の形に直す（大文字の羅列は強すぎるため）。混在していればそのまま */
function nice(s: string): string {
  return /[A-Z]/.test(s) && s === s.toUpperCase() ? s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()) : s;
}

function logo(x: number, y: number, w: number, opacity = 1): string {
  const h = (w * LOGO_HEIGHT) / LOGO_WIDTH;
  const o = opacity < 1 ? ` opacity="${opacity}"` : "";
  return `<use href="#lg" xlink:href="#lg" x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}"${o}/>`;
}

/** 枠線 + 四隅の十字 */
function frame(): string {
  const a = FRAME;
  const b = { x: 910 - FRAME, y: 550 - FRAME };
  const cross = (x: number, y: number) => `M${x - 10} ${y}h20M${x} ${y - 10}v20`;
  return (
    `<rect x="${a}" y="${a}" width="${b.x - a}" height="${b.y - a}" fill="none" stroke="${PAPER}" stroke-opacity=".7" stroke-width="2"/>` +
    `<path d="${cross(a, a)}${cross(b.x, a)}${cross(a, b.y)}${cross(b.x, b.y)}" stroke="${PAPER}" stroke-opacity=".9" stroke-width="2"/>`
  );
}

const ICON = { fill: "none", stroke: PAPER, "stroke-width": 1.7, "stroke-linecap": "round", "stroke-linejoin": "round" };
function icon(kind: "mail" | "github" | "x", x: number, y: number): string {
  const attrs = Object.entries(ICON).map(([k, v]) => `${k}="${v}"`).join(" ");
  const body = {
    mail: `<rect x="0" y="3" width="22" height="16" rx="2.5"/><path d="M1.5 5.5 11 13l9.5-7.5"/>`,
    github: `<circle cx="11" cy="11" r="10.5"/><circle cx="11" cy="8.6" r="3.6"/><path d="M4.2 18.2Q11 12.6 17.8 18.2"/>`,
    x: `<path d="M2 2l18 18M20 2 2 20" stroke-width="2"/>`,
  }[kind];
  return `<g transform="translate(${x} ${y})" ${attrs}>${body}</g>`;
}

/* ────────────────────────────────────────────────────────────
 *  表面
 * ──────────────────────────────────────────────────────────── */

function front(ts: Typesetter, f: CardFields): string {
  const out: string[] = [];

  // 右奥に大きく薄いロゴ（枠の外へはみ出して切れる）
  out.push(logo(590, 110, 330, 0.11));
  out.push(frame());

  // ヘッダ: ロゴ + 団体名
  out.push(logo(L, 62, 40));
  out.push(ts.text("display", "Tech Club", L + 56, 92, 28, { tracking: -0.3 }));
  const sub = `DEV TEAM / ${f.id.toUpperCase()}`;
  out.push(ts.text("mono", sub, L + 57, 116, fitSize(ts, "mono", sub, 15, 400, 11, 2), { opacity: 0.6, tracking: 2 }));

  // 氏名（主役）
  const nameMain = f.nameJp || f.nameEn || f.id;
  out.push(ts.text("jp", nameMain, L - 6, 284, fitSize(ts, "jp", nameMain, 118, R - L + 6, 56, -2), { tracking: -2 }));

  // 英名 | 肩書き（英名の右に区切り線を挟んで同じ行に置く）
  const en = f.nameJp && f.nameEn ? nice(f.nameEn) : "";
  const roleEn = nice(f.roleEn);
  const y = 332;
  let x = L;
  if (en) {
    const size = fitSize(ts, "display", en, 36, R - L, 18, -0.4);
    out.push(ts.text("display", en, x, y, size, { tracking: -0.4 }));
    x += ts.width("display", en, size, -0.4);
  }
  if (f.roleJp || roleEn) {
    const jw = f.roleJp ? ts.width("jpBold", f.roleJp, 26) : 0;
    const gap = f.roleJp && roleEn ? 14 : 0;
    const ew = roleEn ? ts.width("mono", roleEn, 16, 0.5) : 0;
    const lead = en ? 24 : 0;
    const x0 = x + lead + (en ? 22 : 0);
    // 入りきらないときは英語の肩書きを省く
    const showEn = !!roleEn && x0 + jw + gap + ew <= R;
    if (en) out.push(`<rect x="${num(x + lead)}" y="${y - 28}" width="2" height="34" fill="${PAPER}" fill-opacity=".4"/>`);
    if (f.roleJp) out.push(ts.text("jpBold", f.roleJp, x0, y, 26));
    if (showEn) out.push(ts.text("mono", roleEn, x0 + jw + gap, y - 1, 16, { opacity: 0.7, tracking: 0.5 }));
    else if (!f.roleJp && roleEn) out.push(ts.text("mono", roleEn, x0, y - 1, 16, { opacity: 0.7, tracking: 0.5 }));
  }
  out.push(`<rect x="${L}" y="358" width="${R - L}" height="2" fill="${PAPER}" fill-opacity=".4"/>`);

  // スキル（先頭 3 つ。枠だけのピル）
  const tags = f.skillTags.slice(0, 3).map((t) => clip(t, 16));
  if (tags.length) {
    const gap = 18;
    let size = 17;
    const widthAt = (s: number) => tags.reduce((a, t) => a + ts.width("mono", t, s) + 40, 0) + gap * (tags.length - 1);
    while (size > 13 && widthAt(size) > R - L) size -= 0.5;
    let px = L;
    for (const t of tags) {
      const w = ts.width("mono", t, size) + 40;
      out.push(`<rect x="${num(px)}" y="378" width="${num(w)}" height="36" rx="18" fill="none" stroke="${PAPER}" stroke-opacity=".8" stroke-width="2"/>`);
      out.push(ts.text("mono", t, px + w / 2, 402, size, { anchor: "middle" }));
      px += w + gap;
    }
  }

  // 連絡先（存在するものを順に: 左 1 行目 → 左 2 行目 → 右 1 行目）。アイコン付き
  const items = [
    { kind: "mail" as const, text: f.email },
    { kind: "github" as const, text: f.githubId && `github.com/${f.githubId}` },
    { kind: "x" as const, text: f.xId && `@${f.xId}` },
  ].filter((i) => i.text);
  const slots = [
    { x: L, y: 456, max: 440 },
    { x: L, y: 488, max: 440 },
    { x: 560, y: 456, max: R - 560 - 36 },
  ];
  items.forEach((it, i) => {
    const s = slots[i];
    out.push(icon(it.kind, s.x, s.y - 17));
    out.push(ts.text("mono", it.text, s.x + 36, s.y, fitSize(ts, "mono", it.text, 19, s.max, 13), { fill: SOFT }));
  });

  return out.join("\n  ");
}

/* ────────────────────────────────────────────────────────────
 *  裏面（QR とロゴだけ）
 * ──────────────────────────────────────────────────────────── */

function back(qrUrl: string): string {
  const out: string[] = [];
  out.push(frame());

  // 中央に QR（白い角丸パネルいっぱい。パネルの余白がそのまま QR の静かな領域になる）
  const pw = 300;
  const px = (910 - pw) / 2;
  const py = 84;
  out.push(`<rect x="${px}" y="${py}" width="${pw}" height="${pw}" rx="22" fill="${PAPER}"/>`);
  out.push(qr(qrUrl || "https://example.com", px, py, pw));

  // 下にロゴだけ
  const lw = 34;
  out.push(logo((910 - lw) / 2, 420, lw));
  return out.join("\n  ");
}

/* ────────────────────────────────────────────────────────────
 *  QR
 * ──────────────────────────────────────────────────────────── */

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
