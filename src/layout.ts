/**
 * 名刺の見た目（配置・サイズ・書体・色）を決める唯一の場所。
 *
 * カードは 910 × 550 の固定キャンバス。メンバーが触れるのは Notion のデータだけで、
 * 見た目はこのファイルの LAYOUT 1 つに固定（組織で統一）。微調整はここの数値を直して再デプロイする。
 * 座標の単位は SVG の viewBox（= mm × 10）。
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
 *  レイアウト（Figma Make のデザインに対応）
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

export const LAYOUT: CardLayout = {
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
