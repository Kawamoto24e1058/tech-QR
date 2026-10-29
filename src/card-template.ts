/**
 * 名刺 SVG（テック部 / 白黒）— デザイン「QUIET」（主役は氏名と QR だけ。装飾は上部の白帯のみ）
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

/** 全部大文字の英名・肩書きは「Haru Kawamoto」の形に直す（大文字の羅列は強すぎるため）。混在していればそのまま */
function nice(s: string): string {
  return /[A-Z]/.test(s) && s === s.toUpperCase() ? s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()) : s;
}

function front(ts: Typesetter, f: CardFields, logoHref: string): string {
  const out: string[] = [];
  const L = 56;
  const R = 854;

  // 上部の白帯（唯一の反転部分）: ロゴ + 団体名 / 右に肩書き
  out.push(`<rect x="${-BLEED}" y="${-BLEED}" width="${910 + 2 * BLEED}" height="${128 + BLEED}" fill="${PAPER}"/>`);
  out.push(`<image href="${logoHref}" x="${L}" y="36" width="38" height="58" preserveAspectRatio="xMidYMid meet"/>`);
  out.push(ts.text("display", "Tech Club", 112, 66, 28, { fill: INK, tracking: -0.3 }));
  const sub = `DEV TEAM / ${f.id.toUpperCase()}`;
  out.push(ts.text("mono", sub, 113, 90, fitSize(ts, "mono", sub, 15, 400, 11, 2), { fill: INK, opacity: 0.6, tracking: 2 }));

  const roleEn = nice(f.roleEn);
  if (f.roleJp || roleEn) {
    const jw = f.roleJp ? ts.width("jpBold", f.roleJp, 28) : 0;
    const gap = f.roleJp && roleEn ? 14 : 0;
    const ew = roleEn ? ts.width("mono", roleEn, 16, 0.5) : 0;
    const x0 = R - (jw + gap + ew);
    if (f.roleJp) out.push(ts.text("jpBold", f.roleJp, x0, 74, 28, { fill: INK }));
    if (roleEn) out.push(ts.text("mono", roleEn, x0 + jw + gap, 73, 16, { fill: INK, opacity: 0.6, tracking: 0.5 }));
  }

  // 氏名（主役）+ 英名
  const nameMain = f.nameJp || f.nameEn || f.id;
  out.push(ts.text("jp", nameMain, L - 6, 280, fitSize(ts, "jp", nameMain, 118, R - L + 6, 56, -2), { tracking: -2 }));
  if (f.nameJp && f.nameEn) {
    const en = nice(f.nameEn);
    out.push(ts.text("display", en, L, 330, fitSize(ts, "display", en, 36, R - L, 18, -0.4), { tracking: -0.4 }));
  }
  out.push(`<rect x="${L}" y="356" width="${R - L}" height="2" fill="${PAPER}" fill-opacity=".35"/>`);

  // スキル（先頭 3 つ。枠は付けず、区切りの / だけ）
  const tags = f.skillTags.slice(0, 3).map((t) => clip(t, 16));
  if (tags.length) {
    const sep = 40;
    let size = 19;
    const widthAt = (s: number) => tags.reduce((a, t) => a + ts.width("mono", t, s), 0) + sep * (tags.length - 1);
    while (size > 14 && widthAt(size) > R - L) size -= 0.5;
    let x = L;
    tags.forEach((t, i) => {
      out.push(ts.text("mono", t, x, 404, size));
      x += ts.width("mono", t, size);
      if (i < tags.length - 1) {
        out.push(ts.text("mono", "/", x + sep / 2, 404, size, { anchor: "middle", opacity: 0.4 }));
        x += sep;
      }
    });
  }

  // 連絡先（存在するものを順に: 左 1 行目 → 左 2 行目 → 右 1 行目）
  const items = [f.email, f.githubId && `github.com/${f.githubId}`, f.xId && `@${f.xId}`].filter(Boolean) as string[];
  const slots = [
    { x: L, y: 466, max: 480, anchor: "start" as const },
    { x: L, y: 502, max: 480, anchor: "start" as const },
    { x: R, y: 466, max: 280, anchor: "end" as const },
  ];
  items.forEach((t, i) => {
    const s = slots[i];
    out.push(ts.text("mono", t, s.x, s.y, fitSize(ts, "mono", t, 20, s.max, 14), { fill: SOFT, anchor: s.anchor }));
  });

  return out.join("\n  ");
}

/* ────────────────────────────────────────────────────────────
 *  裏面（QR だけが目立つ。それ以外は静かに）
 * ──────────────────────────────────────────────────────────── */

function back(ts: Typesetter, qrUrl: string): string {
  const out: string[] = [];
  const cx = 455;

  const cta = "プロフィールとリンクを見る →";
  out.push(ts.text("jpBold", cta, cx, 96, fitSize(ts, "jpBold", cta, 26, 760, 18), { anchor: "middle" }));

  // QR は白い角丸パネルいっぱい（パネルの余白がそのまま QR の静かな領域になる）
  const pw = 270;
  const px = cx - pw / 2;
  const py = 132;
  out.push(`<rect x="${px}" y="${py}" width="${pw}" height="${pw}" rx="20" fill="${PAPER}"/>`);
  out.push(qr(qrUrl || "https://example.com", px, py, pw));

  const shown = qrUrl.replace(/^https?:\/\//, "");
  if (shown) {
    out.push(ts.text("mono", shown, cx, 452, fitSize(ts, "mono", shown, 17, 760, 11), { anchor: "middle", fill: SOFT, opacity: 0.7 }));
  }
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
