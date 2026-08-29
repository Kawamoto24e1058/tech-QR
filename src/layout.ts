/**
 * 名刺レイアウトのスキーマとデフォルト値。
 *
 * カードは 910 × 550 の固定キャンバス。各要素は key で識別し、
 * /editor が編集した差分を KV に JSON で保存する。
 * 保存値は認証なしで POST されうるので、resolveLayout() で必ずサニタイズする。
 */

export type Anchor = "start" | "middle" | "end";
export type FontClass = "hd" | "mo";
export type TextTransform = "none" | "upper";

/** 動的テキストのバインド先（fields のキー / 特殊値） */
export type DataBind =
  | "nameJp"
  | "nameEn"
  | "roleJp"
  | "roleEn"
  | "email"
  | "github"
  | "x"
  | "skills"
  | "qrUrl"
  | "year";

export interface TextEl {
  type: "text";
  x: number;
  y: number;
  size: number;
  weight: number;
  tracking: number;
  anchor: Anchor;
  fill: string;
  opacity: number;
  font: FontClass;
  transform: TextTransform;
  visible: boolean;
  /** 動的な内容。未指定なら text を使う */
  bind?: DataBind;
  /** 固定文字列 */
  text?: string;
}

export interface LogoEl {
  type: "logo";
  x: number;
  y: number;
  w: number;
  h: number;
  opacity: number;
  visible: boolean;
}

/** スキルタグのチップ列（先頭の座標から右に流す） */
export interface ChipsEl {
  type: "chips";
  x: number;
  y: number;
  size: number;
  gap: number;
  height: number;
  visible: boolean;
}

/** 連絡先ブロック（アイコン + テキストの行を縦に並べる） */
export interface ContactEl {
  type: "contact";
  x: number;
  y: number;
  size: number;
  rowGap: number;
  visible: boolean;
}

/** 裏面の QR 白パネル（QR 本体はこの中で自動センタリング） */
export interface QrEl {
  type: "qr";
  x: number;
  y: number;
  w: number;
  h: number;
  visible: boolean;
}

export type Element = TextEl | LogoEl | ChipsEl | ContactEl | QrEl;

export interface CardLayout {
  version: 1;
  front: Record<string, Element>;
  back: Record<string, Element>;
}

/* ────────────────────────────────────────────────────────────
 *  デフォルトレイアウト（Figma Make のデザインに対応）
 * ──────────────────────────────────────────────────────────── */

const T = (
  x: number,
  y: number,
  size: number,
  opts: Partial<TextEl> = {},
): TextEl => ({
  type: "text",
  x,
  y,
  size,
  weight: 400,
  tracking: 0,
  anchor: "start",
  fill: "#ffffff",
  opacity: 1,
  font: "hd",
  transform: "none",
  visible: true,
  ...opts,
});

export const DEFAULT_LAYOUT: CardLayout = {
  version: 1,
  front: {
    logoWatermark: { type: "logo", x: 510, y: -30, w: 450, h: 620, opacity: 0.06, visible: true },
    logoHeader: { type: "logo", x: 50, y: 30, w: 44, h: 56, opacity: 1, visible: true },
    orgName: T(104, 51, 11, { weight: 700, tracking: 3.5, text: "TECH CLUB" }),
    orgSub: T(104, 68, 8.5, { tracking: 2.5, fill: "#52525b", text: "DEV TEAM" }),
    roleJp: T(52, 168, 13, { weight: 300, tracking: 5, fill: "#8a8f98", bind: "roleJp" }),
    roleEn: T(52, 185, 8.5, { tracking: 5, fill: "#3f3f46", transform: "upper", bind: "roleEn" }),
    nameJp: T(46, 272, 62, { weight: 800, tracking: 4, bind: "nameJp" }),
    nameEn: T(52, 308, 11.5, { weight: 300, tracking: 11, fill: "#8a8f98", transform: "upper", bind: "nameEn" }),
    skills: { type: "chips", x: 52, y: 458, size: 9.5, gap: 10, height: 22, visible: true },
    contactLabel: T(858, 456, 7, { weight: 500, tracking: 3, fill: "#3f3f46", anchor: "end", text: "CONTACT" }),
    contact: { type: "contact", x: 626, y: 462, size: 10, rowGap: 24, visible: true },
  },
  back: {
    logoWmLeft: { type: "logo", x: -80, y: -20, w: 340, h: 420, opacity: 0.06, visible: true },
    logoWmRight: { type: "logo", x: 650, y: -20, w: 340, h: 420, opacity: 0.06, visible: true },
    scanLabel: T(455, 88, 9, { weight: 500, tracking: 6, fill: "#52525b", anchor: "middle", text: "SCAN TO CONNECT" }),
    qrPanel: { type: "qr", x: 305, y: 100, w: 300, h: 310, visible: true },
    qrUrl: T(455, 436, 11.5, { tracking: 1.5, fill: "#8a8f98", anchor: "middle", font: "mo", bind: "qrUrl" }),
    logoBottom: { type: "logo", x: 431, y: 462, w: 48, h: 60, opacity: 0.25, visible: true },
    slogan: T(455, 532, 8, { tracking: 5, fill: "#3f3f46", anchor: "middle", text: "BUILD · LEARN · SHIP" }),
    footerLeft: T(52, 532, 7.5, { tracking: 2, fill: "#3f3f46", font: "mo", text: "TECH CLUB" }),
    footerRight: T(858, 532, 7.5, { tracking: 2, fill: "#3f3f46", font: "mo", anchor: "end", bind: "year" }),
  },
};

/* ────────────────────────────────────────────────────────────
 *  サニタイズ / マージ
 * ──────────────────────────────────────────────────────────── */

const HEX = /^#[0-9a-fA-F]{6}$/;
const ANCHORS: Anchor[] = ["start", "middle", "end"];
const FONTS: FontClass[] = ["hd", "mo"];
const TRANSFORMS: TextTransform[] = ["none", "upper"];

function nz(v: unknown, fallback: number, min = -2000, max = 4000): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
function pick<T>(v: unknown, allowed: T[], fallback: T): T {
  return allowed.includes(v as T) ? (v as T) : fallback;
}
function hex(v: unknown, fallback: string): string {
  return typeof v === "string" && HEX.test(v) ? v : fallback;
}
function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function mergeEl(def: Element, raw: unknown): Element {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  switch (def.type) {
    case "text": {
      const d = def;
      const el: TextEl = {
        type: "text",
        x: nz(o.x, d.x),
        y: nz(o.y, d.y),
        size: nz(o.size, d.size, 1, 400),
        weight: nz(o.weight, d.weight, 100, 900),
        tracking: nz(o.tracking, d.tracking, -20, 60),
        anchor: pick(o.anchor, ANCHORS, d.anchor),
        fill: hex(o.fill, d.fill),
        opacity: nz(o.opacity, d.opacity, 0, 1),
        font: pick(o.font, FONTS, d.font),
        transform: pick(o.transform, TRANSFORMS, d.transform),
        visible: bool(o.visible, d.visible),
      };
      if (d.bind) el.bind = d.bind;
      const t = typeof o.text === "string" ? o.text.slice(0, 120) : d.text;
      if (t !== undefined) el.text = t;
      return el;
    }
    case "logo": {
      const d = def;
      return {
        type: "logo",
        x: nz(o.x, d.x),
        y: nz(o.y, d.y),
        w: nz(o.w, d.w, 4, 3000),
        h: nz(o.h, d.h, 4, 3000),
        opacity: nz(o.opacity, d.opacity, 0, 1),
        visible: bool(o.visible, d.visible),
      };
    }
    case "chips": {
      const d = def;
      return {
        type: "chips",
        x: nz(o.x, d.x),
        y: nz(o.y, d.y),
        size: nz(o.size, d.size, 4, 40),
        gap: nz(o.gap, d.gap, 0, 60),
        height: nz(o.height, d.height, 10, 60),
        visible: bool(o.visible, d.visible),
      };
    }
    case "contact": {
      const d = def;
      return {
        type: "contact",
        x: nz(o.x, d.x),
        y: nz(o.y, d.y),
        size: nz(o.size, d.size, 4, 40),
        rowGap: nz(o.rowGap, d.rowGap, 8, 80),
        visible: bool(o.visible, d.visible),
      };
    }
    case "qr": {
      const d = def;
      return {
        type: "qr",
        x: nz(o.x, d.x),
        y: nz(o.y, d.y),
        w: nz(o.w, d.w, 80, 900),
        h: nz(o.h, d.h, 80, 550),
        visible: bool(o.visible, d.visible),
      };
    }
  }
}

function mergeSide(
  def: Record<string, Element>,
  raw: unknown,
): Record<string, Element> {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: Record<string, Element> = {};
  for (const [key, defEl] of Object.entries(def)) {
    out[key] = mergeEl(defEl, o[key]);
  }
  return out;
}

/** 保存値（信頼できない）をデフォルトにマージし、必ず妥当なレイアウトを返す */
export function resolveLayout(raw: unknown): CardLayout {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    version: 1,
    front: mergeSide(DEFAULT_LAYOUT.front, o.front),
    back: mergeSide(DEFAULT_LAYOUT.back, o.back),
  };
}
