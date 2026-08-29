/**
 * 名刺SVG生成（テック部 / 黒 × 白）
 *
 * - 91mm × 55mm（viewBox="0 0 910 550"）、Figma Make のデザインに準拠
 * - 各テキスト/ロゴ/QRの座標・サイズ・書体は src/layout.ts の CardLayout で駆動。
 *   /editor が編集した差分は KV に保存され、resolveLayout() でデフォルトにマージされる。
 * - ロゴは src/logo.ts の PNG を base64 同梱し feColorMatrix で白黒反転
 * - QR は uqr で動的生成
 *
 * テキストはライブテキスト。印刷入稿前に Illustrator 等でアウトライン化すること。
 */
import { encode } from "uqr";
import { LOGO_DATA_URI, LOGO_HEIGHT, LOGO_WIDTH } from "./logo";
import {
  DEFAULT_LAYOUT,
  type CardLayout,
  type ChipsEl,
  type ContactEl,
  type Element,
  type LogoEl,
  type QrEl,
  type TextEl,
} from "./layout";

const BG = "#0a0a0c";

export interface CardFields {
  nameJp: string;
  nameEn: string;
  roleJp: string;
  roleEn: string;
  email: string;
  githubId: string;
  xId: string;
  skillTags: string[];
}

export type CardSide = "front" | "back";

/* ────────────────────────────────────────────────────────────
 *  共通 defs / chrome
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

/** 外枠 + 内側ヘアライン + 四隅マーク（表裏共通の固定装飾） */
const BORDER = `<rect x="14" y="14" width="882" height="522" rx="4" fill="none" stroke="#ffffff" stroke-width="1.2" opacity="0.9"/>
  <rect x="20" y="20" width="870" height="510" rx="2" fill="none" stroke="#ffffff" stroke-width="0.4" opacity="0.15"/>
  <g stroke="#ffffff" stroke-width="1" fill="none" opacity="0.4">
    <path d="M36 36 L72 36"/><path d="M36 36 L36 72"/>
    <path d="M874 36 L838 36"/><path d="M874 36 L874 72"/>
    <path d="M36 514 L72 514"/><path d="M36 514 L36 478"/>
    <path d="M874 514 L838 514"/><path d="M874 514 L874 478"/>
  </g>`;

const FRONT_CHROME = `<line x1="36" y1="108" x2="874" y2="108" stroke="#3f3f46" stroke-width="0.75"/>
  <line x1="36" y1="442" x2="874" y2="442" stroke="#3f3f46" stroke-width="0.75"/>
  <line x1="610" y1="442" x2="610" y2="536" stroke="#3f3f46" stroke-width="0.75"/>`;

const BACK_CHROME = `<rect width="910" height="550" fill="url(#grid-dots)"/>
  <rect width="910" height="550" fill="url(#vignette)"/>
  <line x1="170" y1="82" x2="320" y2="82" stroke="#3f3f46" stroke-width="0.75"/>
  <line x1="590" y1="82" x2="740" y2="82" stroke="#3f3f46" stroke-width="0.75"/>`;

const BACK_DEFS = `<pattern id="grid-dots" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
      <circle cx="0" cy="0" r="1.1" fill="#27272a"/>
    </pattern>
    <radialGradient id="vignette" cx="50%" cy="50%" r="58%">
      <stop offset="0%" stop-color="#0a0a0c" stop-opacity="0"/>
      <stop offset="100%" stop-color="#0a0a0c" stop-opacity="0.95"/>
    </radialGradient>
    <filter id="card-shadow" x="-15%" y="-15%" width="130%" height="130%">
      <feDropShadow dx="0" dy="6" stdDeviation="22" flood-color="#000000" flood-opacity="0.7"/>
    </filter>`;

const CONTACT_ICONS: Record<string, string> = {
  mail: `<rect x="0" y="0" width="14" height="10" rx="1.5" fill="none" stroke="#52525b" stroke-width="1.2"/><polyline points="0,0 7,6 14,0" fill="none" stroke="#52525b" stroke-width="1.2" stroke-linejoin="round"/>`,
  github: `<circle cx="7" cy="7" r="7" fill="none" stroke="#52525b" stroke-width="1.2"/><circle cx="7" cy="4.5" r="2.8" fill="none" stroke="#52525b" stroke-width="1"/><path d="M1.5 13 Q7 9.5 12.5 13" fill="none" stroke="#52525b" stroke-width="1" stroke-linecap="round"/>`,
  x: `<line x1="1" y1="0" x2="13" y2="12" stroke="#52525b" stroke-width="1.4" stroke-linecap="round"/><line x1="13" y1="0" x2="1" y2="12" stroke="#52525b" stroke-width="1.4" stroke-linecap="round"/>`,
};

/* ────────────────────────────────────────────────────────────
 *  公開 API
 * ──────────────────────────────────────────────────────────── */

export function buildFrontCard(f: CardFields, layout: CardLayout = DEFAULT_LAYOUT): string {
  return renderSide("front", f, "", layout);
}

export function buildBackCard(
  f: CardFields,
  qrTargetUrl: string,
  layout: CardLayout = DEFAULT_LAYOUT,
): string {
  return renderSide("back", f, qrTargetUrl, layout);
}

function renderSide(side: CardSide, f: CardFields, qrUrl: string, layout: CardLayout): string {
  const defs =
    side === "back"
      ? `${LOGO_INVERT_FILTER}\n    ${LOGO_SYMBOL}\n    ${FONT_STYLE}\n    ${BACK_DEFS}`
      : `${LOGO_INVERT_FILTER}\n    ${LOGO_SYMBOL}\n    ${FONT_STYLE}`;

  const chrome = side === "back" ? BACK_CHROME : FRONT_CHROME;
  const body = Object.entries(layout[side])
    .map(([key, el]) => {
      const inner = renderElement(el, side, f, qrUrl);
      return inner ? `<g data-el="${key}">${inner}</g>` : "";
    })
    .join("\n  ");

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 910 550" width="91mm" height="55mm">
  <defs>
    ${defs}
  </defs>
  <rect width="910" height="550" fill="${BG}"/>
  ${chrome}
  ${BORDER}
  ${body}
</svg>`;
}

/* ────────────────────────────────────────────────────────────
 *  要素レンダリング
 * ──────────────────────────────────────────────────────────── */

function renderElement(el: Element, side: CardSide, f: CardFields, qrUrl: string): string {
  if (!el.visible) return "";
  switch (el.type) {
    case "logo":
      return renderLogo(el);
    case "text":
      return renderText(el, f, qrUrl);
    case "chips":
      return renderChips(el, f.skillTags);
    case "contact":
      return renderContact(el, f);
    case "qr":
      return renderQrPanel(el, qrUrl);
  }
}

function renderLogo(el: LogoEl): string {
  const op = el.opacity === 1 ? "" : ` opacity="${el.opacity}"`;
  return `<use href="#logo" x="${num(el.x)}" y="${num(el.y)}" width="${num(el.w)}" height="${num(el.h)}" filter="url(#logo-invert)"${op}/>`;
}

function bindValue(bind: string, f: CardFields, qrUrl: string): string {
  switch (bind) {
    case "nameJp":
      return f.nameJp;
    case "nameEn":
      return f.nameEn;
    case "roleJp":
      return f.roleJp;
    case "roleEn":
      return f.roleEn;
    case "email":
      return f.email;
    case "github":
      return f.githubId ? `github.com/${f.githubId}` : "";
    case "x":
      return f.xId ? `@${f.xId}` : "";
    case "qrUrl":
      return qrUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "");
    case "year":
      return String(new Date().getFullYear());
    default:
      return "";
  }
}

function renderText(el: TextEl, f: CardFields, qrUrl: string): string {
  let content = el.bind ? bindValue(el.bind, f, qrUrl) : (el.text ?? "");
  content = clip(content, el.bind === "nameJp" ? 14 : 44);
  if (el.transform === "upper") content = content.toUpperCase();
  if (!content) return "";

  const ls = el.tracking ? ` letter-spacing="${num(el.tracking)}"` : "";
  const op = el.opacity === 1 ? "" : ` fill-opacity="${el.opacity}"`;
  const anc = el.anchor === "start" ? "" : ` text-anchor="${el.anchor}"`;
  return `<text class="${el.font}" x="${num(el.x)}" y="${num(el.y)}" font-size="${num(el.size)}" font-weight="${el.weight}"${ls}${anc} fill="${el.fill}"${op}>${esc(content)}</text>`;
}

function renderChips(el: ChipsEl, tags: string[]): string {
  const PAD = 12;
  const CHAR = el.size * 0.6;
  let x = el.x;
  return tags
    .slice(0, 3)
    .map((raw) => {
      const t = clip(raw, 16);
      const w = Math.round(PAD * 2 + t.length * CHAR);
      const g = `<g transform="translate(${num(x)} ${num(el.y)})">
    <rect width="${w}" height="${num(el.height)}" rx="3" fill="#18181b"/>
    <rect width="2.5" height="${num(el.height)}" rx="1" fill="#ffffff" opacity="0.5"/>
    <text class="mo" x="${PAD}" y="${num(el.height / 2 + el.size * 0.35)}" font-size="${num(el.size)}" fill="#8a8f98">${esc(t)}</text>
  </g>`;
      x += w + el.gap;
      return g;
    })
    .join("\n  ");
}

function renderContact(el: ContactEl, f: CardFields): string {
  const rows: Array<[string, string]> = [];
  if (f.email) rows.push(["mail", clip(f.email, 30)]);
  if (f.githubId) rows.push(["github", clip(`github.com/${f.githubId}`, 30)]);
  if (f.xId) rows.push(["x", clip(`@${f.xId}`, 30)]);

  return rows
    .map(([icon, text], i) => {
      const y = el.y + i * el.rowGap;
      return `<g transform="translate(${num(el.x)} ${num(y)})" style="color:#ffffff" fill-opacity="0.85">
    <g opacity="0.55">${CONTACT_ICONS[icon]}</g>
    <text class="mo" x="26" y="9" font-size="${num(el.size)}" fill="#8a8f98">${esc(text)}</text>
  </g>`;
    })
    .join("\n  ");
}

function renderQrPanel(el: QrEl, qrUrl: string): string {
  const panel = `<rect x="${num(el.x)}" y="${num(el.y)}" width="${num(el.w)}" height="${num(el.h)}" rx="24" fill="#ffffff" filter="url(#card-shadow)"/>`;
  const size = Math.min(el.w, el.h) - 42;
  const qx = el.x + (el.w - size) / 2;
  const qy = el.y + (el.h - size) / 2;
  return `${panel}\n  ${renderQr(qrUrl || "https://example.com", qx, qy, size)}`;
}

/* ────────────────────────────────────────────────────────────
 *  QR（実データ・丸みモジュール・1:1:3:1:1 比のファインダー）
 * ──────────────────────────────────────────────────────────── */

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

function num(n: number): string {
  return Number(n.toFixed(2)).toString();
}

function clip(s: string, max: number): string {
  const t = s.trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
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
const esc = escapeXml;
