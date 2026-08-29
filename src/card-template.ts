/**
 * 名刺SVGテンプレート（テック部 / 黒 × 白）
 *
 * - 日本標準名刺サイズ 91mm × 55mm（viewBox="0 0 910 550"）
 * - デザインは Figma Make の business-card-front / back.svg に準拠
 * - ロゴ（剣 + 蛇 + 回路のエンブレム）は src/logo.ts に PNG を base64 同梱し、
 *   feColorMatrix(logo-invert) で白黒反転して使う
 * - 裏面の QR は uqr で動的生成（Figma 版のダミー QR を実データに置換）
 *
 * テキストはライブテキスト。印刷入稿前に Illustrator 等でアウトライン化すること。
 */
import { encode } from "uqr";
import { LOGO_DATA_URI, LOGO_HEIGHT, LOGO_WIDTH } from "./logo";

const BG = "#0a0a0c";

export interface CardFields {
  nameJp: string;
  nameEn: string;
  roleJp: string;
  roleEn: string;
  email: string;
  /** 正規化済みハンドル（"octocat"）。空可 */
  githubId: string;
  /** 正規化済みハンドル（"octocat"）。空可 */
  xId: string;
  skillTags: string[];
}

/* ────────────────────────────────────────────────────────────
 *  共通 defs
 * ──────────────────────────────────────────────────────────── */

const FONT_STYLE = `<style><![CDATA[
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;700;800&family=Noto+Sans+JP:wght@300;400;500;700;800&display=swap');
    .hd { font-family: "Inter", "Noto Sans JP", "Hiragino Kaku Gothic ProN", "Yu Gothic", system-ui, sans-serif; }
    .mo { font-family: "Courier New", Courier, "SFMono-Regular", Menlo, monospace; }
  ]]></style>`;

const LOGO_SYMBOL = `<symbol id="logo" viewBox="0 0 ${LOGO_WIDTH} ${LOGO_HEIGHT}" preserveAspectRatio="xMidYMid meet">
    <image href="${LOGO_DATA_URI}" width="${LOGO_WIDTH}" height="${LOGO_HEIGHT}"/>
  </symbol>`;

const LOGO_INVERT_FILTER = `<filter id="logo-invert" color-interpolation-filters="sRGB">
    <feColorMatrix type="matrix" values="-1 0 0 0 1  0 -1 0 0 1  0 0 -1 0 1  0 0 0 1 0"/>
  </filter>`;

/** 白ロゴ（反転）を配置。w/h はバウンディングボックス、内部で縦横比維持 */
function logo(x: number, y: number, w: number, h: number, opacity = 1): string {
  const op = opacity === 1 ? "" : ` opacity="${opacity}"`;
  return `<use href="#logo" x="${x}" y="${y}" width="${w}" height="${h}" filter="url(#logo-invert)"${op}/>`;
}

/** 外枠 + 内側ヘアライン + 四隅マーク（表裏共通） */
const BORDER = `<rect x="14" y="14" width="882" height="522" rx="4" fill="none" stroke="#ffffff" stroke-width="1.2" opacity="0.9"/>
  <rect x="20" y="20" width="870" height="510" rx="2" fill="none" stroke="#ffffff" stroke-width="0.4" opacity="0.15"/>
  <g stroke="#ffffff" stroke-width="1" fill="none" opacity="0.4">
    <path d="M36 36 L72 36"/><path d="M36 36 L36 72"/>
    <path d="M874 36 L838 36"/><path d="M874 36 L874 72"/>
    <path d="M36 514 L72 514"/><path d="M36 514 L36 478"/>
    <path d="M874 514 L838 514"/><path d="M874 514 L874 478"/>
  </g>`;

/* ────────────────────────────────────────────────────────────
 *  表面
 * ──────────────────────────────────────────────────────────── */

export function buildFrontCard(f: CardFields): string {
  return `${svgOpen()}
  <defs>
    ${LOGO_INVERT_FILTER}
    ${LOGO_SYMBOL}
    ${FONT_STYLE}
  </defs>

  <rect width="910" height="550" fill="${BG}"/>
  ${logo(510, -30, 450, 620, 0.06)}

  ${BORDER}

  <line x1="36" y1="108" x2="874" y2="108" stroke="#3f3f46" stroke-width="0.75"/>
  <line x1="36" y1="442" x2="874" y2="442" stroke="#3f3f46" stroke-width="0.75"/>
  <line x1="610" y1="442" x2="610" y2="536" stroke="#3f3f46" stroke-width="0.75"/>

  ${logo(50, 30, 44, 56)}
  <text class="hd" x="104" y="51" font-size="11" font-weight="700" letter-spacing="3.5" fill="#ffffff">TECH CLUB</text>
  <text class="hd" x="104" y="68" font-size="8.5" font-weight="400" letter-spacing="2.5" fill="#52525b">DEV TEAM</text>

  <text class="hd" x="52" y="168" font-size="13" font-weight="300" letter-spacing="5" fill="#8a8f98">${esc(clip(f.roleJp, 18))}</text>
  <text class="hd" x="52" y="185" font-size="8.5" font-weight="400" letter-spacing="5" fill="#3f3f46">${esc(clip(f.roleEn.toUpperCase(), 34))}</text>

  <text class="hd" x="46" y="272" font-size="62" font-weight="800" letter-spacing="4" fill="#ffffff">${esc(clip(f.nameJp, 12))}</text>
  <text class="hd" x="52" y="308" font-size="11.5" font-weight="300" letter-spacing="11" fill="#8a8f98">${esc(clip(f.nameEn.toUpperCase(), 22))}</text>
  <line x1="52" y1="322" x2="260" y2="322" stroke="#3f3f46" stroke-width="0.75"/>

  ${skillChips(f.skillTags)}

  <text class="hd" x="858" y="456" font-size="7" font-weight="500" letter-spacing="3" fill="#3f3f46" text-anchor="end">CONTACT</text>
  ${contactBlock(f)}
${svgClose()}`;
}

function skillChips(tags: string[]): string {
  const H = 22;
  const Y = 458;
  const PAD = 12;
  const GAP = 10;
  const CHAR = 5.7; // Courier New 9.5px ≒ 5.7px/字
  let x = 52;
  return tags
    .slice(0, 3)
    .map((raw) => {
      const t = clip(raw, 16);
      const w = Math.round(PAD * 2 + t.length * CHAR);
      const chip = `<g transform="translate(${x} ${Y})">
    <rect width="${w}" height="${H}" rx="3" fill="#18181b"/>
    <rect width="2.5" height="${H}" rx="1" fill="#ffffff" opacity="0.5"/>
    <text class="mo" x="${PAD}" y="15" font-size="9.5" fill="#8a8f98">${esc(t)}</text>
  </g>`;
      x += w + GAP;
      return chip;
    })
    .join("\n  ");
}

const CONTACT_ICONS: Record<string, string> = {
  mail: `<rect x="0" y="0" width="14" height="10" rx="1.5" fill="none" stroke="#52525b" stroke-width="1.2"/><polyline points="0,0 7,6 14,0" fill="none" stroke="#52525b" stroke-width="1.2" stroke-linejoin="round"/>`,
  github: `<circle cx="7" cy="7" r="7" fill="none" stroke="#52525b" stroke-width="1.2"/><circle cx="7" cy="4.5" r="2.8" fill="none" stroke="#52525b" stroke-width="1"/><path d="M1.5 13 Q7 9.5 12.5 13" fill="none" stroke="#52525b" stroke-width="1" stroke-linecap="round"/>`,
  x: `<line x1="1" y1="0" x2="13" y2="12" stroke="#52525b" stroke-width="1.4" stroke-linecap="round"/><line x1="13" y1="0" x2="1" y2="12" stroke="#52525b" stroke-width="1.4" stroke-linecap="round"/>`,
};

function contactBlock(f: CardFields): string {
  const rows: Array<[string, string]> = [];
  if (f.email) rows.push(["mail", clip(f.email, 30)]);
  if (f.githubId) rows.push(["github", clip(`github.com/${f.githubId}`, 30)]);
  if (f.xId) rows.push(["x", clip(`@${f.xId}`, 30)]);

  const ys = [462, 486, 510];
  return rows
    .map(([icon, text], i) => {
      const y = ys[i];
      return `<g transform="translate(626 ${y})">${CONTACT_ICONS[icon]}</g>
  <text class="mo" x="652" y="${y + 9}" font-size="10" fill="#8a8f98">${esc(text)}</text>`;
    })
    .join("\n  ");
}

/* ────────────────────────────────────────────────────────────
 *  裏面
 * ──────────────────────────────────────────────────────────── */

export function buildBackCard(_f: CardFields, qrTargetUrl: string): string {
  const displayUrl = clip(qrTargetUrl.replace(/^https?:\/\//, "").replace(/\/+$/, ""), 40);
  const year = new Date().getFullYear();

  return `${svgOpen()}
  <defs>
    ${LOGO_INVERT_FILTER}
    ${LOGO_SYMBOL}
    ${FONT_STYLE}
    <pattern id="grid-dots" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
      <circle cx="0" cy="0" r="1.1" fill="#27272a"/>
    </pattern>
    <radialGradient id="vignette" cx="50%" cy="50%" r="58%">
      <stop offset="0%" stop-color="#0a0a0c" stop-opacity="0"/>
      <stop offset="100%" stop-color="#0a0a0c" stop-opacity="0.95"/>
    </radialGradient>
    <filter id="card-shadow" x="-15%" y="-15%" width="130%" height="130%">
      <feDropShadow dx="0" dy="6" stdDeviation="22" flood-color="#000000" flood-opacity="0.7"/>
    </filter>
  </defs>

  <rect width="910" height="550" fill="${BG}"/>
  <rect width="910" height="550" fill="url(#grid-dots)"/>
  <rect width="910" height="550" fill="url(#vignette)"/>

  ${logo(-80, -20, 340, 420, 0.06)}
  ${logo(650, -20, 340, 420, 0.06)}

  ${BORDER}

  <text class="hd" x="455" y="88" font-size="9" font-weight="500" letter-spacing="6" fill="#52525b" text-anchor="middle">SCAN TO CONNECT</text>
  <line x1="170" y1="82" x2="320" y2="82" stroke="#3f3f46" stroke-width="0.75"/>
  <line x1="590" y1="82" x2="740" y2="82" stroke="#3f3f46" stroke-width="0.75"/>

  <rect x="305" y="100" width="300" height="310" rx="24" fill="#ffffff" filter="url(#card-shadow)"/>
  ${renderQr(qrTargetUrl, 326, 121, 258)}

  <text class="mo" x="455" y="436" font-size="11.5" letter-spacing="1.5" fill="#8a8f98" text-anchor="middle">${esc(displayUrl)}</text>
  <line x1="375" y1="447" x2="524" y2="447" stroke="#3f3f46" stroke-width="0.75"/>
  <polygon points="524,444 529,447 524,450" fill="#3f3f46"/>
  <polygon points="375,444 370,447 375,450" fill="#3f3f46"/>

  ${logo(431, 462, 48, 60, 0.25)}

  <text class="hd" x="455" y="532" font-size="8" font-weight="400" letter-spacing="5" fill="#3f3f46" text-anchor="middle">BUILD · LEARN · SHIP</text>
  <text class="mo" x="52" y="532" font-size="7.5" letter-spacing="2" fill="#3f3f46">TECH CLUB</text>
  <text class="mo" x="858" y="532" font-size="7.5" letter-spacing="2" fill="#3f3f46" text-anchor="end">${year}</text>
${svgClose()}`;
}

/**
 * 実データの QR を描画（Figma 版のダミー QR を置換）。
 * モジュールは僅かに角丸、ファインダーは 1:1:3:1:1 比を厳守。
 * `size` は 4 モジュール分のクワイエットゾーンを含む。
 */
function renderQr(text: string, ox: number, oy: number, size: number): string {
  const { data, size: n } = encode(text, { ecc: "Q", border: 0 });
  const quiet = 4;
  const cell = size / (n + quiet * 2);
  const inFinder = (r: number, c: number) =>
    (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);

  let dots = "";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!data[r][c] || inFinder(r, c)) continue;
      const s = cell * 0.9;
      const gx = ox + (quiet + c) * cell + (cell - s) / 2;
      const gy = oy + (quiet + r) * cell + (cell - s) / 2;
      dots += `<rect x="${num(gx)}" y="${num(gy)}" width="${num(s)}" height="${num(s)}" rx="${num(s * 0.16)}"/>`;
    }
  }

  const eye = (r: number, c: number): string => {
    const x = ox + (quiet + c) * cell;
    const y = oy + (quiet + r) * cell;
    return (
      `<rect x="${num(x)}" y="${num(y)}" width="${num(cell * 7)}" height="${num(cell * 7)}" rx="${num(cell * 0.9)}"/>` +
      `<rect x="${num(x + cell)}" y="${num(y + cell)}" width="${num(cell * 5)}" height="${num(cell * 5)}" rx="${num(cell * 0.7)}" fill="#ffffff"/>` +
      `<rect x="${num(x + cell * 2)}" y="${num(y + cell * 2)}" width="${num(cell * 3)}" height="${num(cell * 3)}" rx="${num(cell * 0.45)}" fill="${BG}"/>`
    );
  };

  return `<g fill="${BG}">${dots}${eye(0, 0)}${eye(0, n - 7)}${eye(n - 7, 0)}</g>`;
}

/* ────────────────────────────────────────────────────────────
 *  ユーティリティ
 * ──────────────────────────────────────────────────────────── */

function svgOpen(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 910 550" width="91mm" height="55mm">`;
}
function svgClose(): string {
  return `</svg>`;
}

function num(n: number): string {
  return Number(n.toFixed(2)).toString();
}

/** 文字数で頭から切り詰め（レイアウト崩れ防止）。全角も1文字換算 */
function clip(s: string, max: number): string {
  const t = s.trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/** XML/HTML 特殊文字をエスケープ（SVG テキストへの注入対策） */
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
const esc = escapeXml;
