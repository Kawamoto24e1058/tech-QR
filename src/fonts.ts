/**
 * 名刺の文字を「アウトライン（図形）」に変換するための仕組み。
 *
 * 入稿データでは文字をアウトライン化しておくのが安全（フォントが無い環境でも字形が変わらない・
 * 文字化けしない）。ここで Google Fonts から「その名刺に使う文字だけ」の小さなフォント(TTF, 数KB)を
 * 取得し、opentype.js で 1 文字ずつ輪郭を取り出して SVG の <path> にする。
 * 取得したフォントは Cache API に 1 週間保存するので、2 回目以降はほぼ即時。
 */
import { parse, type Font } from "opentype.js";

/** 名刺で使う書体（見た目を変えるときはここを書き換える） */
export const FONTS = {
  /** 英字の見出し・英名（Tech Club / Haru Kawamoto / 肩書きの英語）。主張しすぎない中太のグロテスク */
  display: { family: "Inter", weight: 700 },
  /** 日本語の氏名（極太。名刺で唯一の主役） */
  jp: { family: "Noto Sans JP", weight: 900 },
  /** 日本語の肩書き・案内文（太字） */
  jpBold: { family: "Noto Sans JP", weight: 700 },
  /** 等幅（連絡先・スキル・URL・ID） */
  mono: { family: "IBM Plex Mono", weight: 500 },
  /** ドット絵風（裏面の円の文字・校名。ホーディーの書体に合わせた） */
  pixel: { family: "Pixelify Sans", weight: 600 },
} as const;

export type FontName = keyof typeof FONTS;

/** `text` に含まれる文字だけを持つフォントを返す */
export type FontLoader = (name: FontName, text: string) => Promise<Font>;

export class FontError extends Error {}

/* ── Google Fonts からの取得（Cache API つき）────────────── */

function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

export const googleFontLoader: FontLoader = async (name, text) => {
  const { family, weight } = FONTS[name];
  const chars = [...new Set([...text])].sort().join("");
  const key = new Request(`https://tech-qr.cache/font/${encodeURIComponent(family)}/${weight}/${hash(chars)}`);
  const cache = caches.default;

  let buf: ArrayBuffer;
  const hit = await cache.match(key);
  if (hit) {
    buf = await hit.arrayBuffer();
  } else {
    // UA を持たない（ブラウザではない）リクエストには TrueType が返る = opentype.js でそのまま読める
    const cssUrl = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@${weight}&text=${encodeURIComponent(chars)}`;
    const cssRes = await fetch(cssUrl);
    if (!cssRes.ok) throw new FontError(`Google Fonts CSS ${cssRes.status} (${family})`);
    const fontUrl = (await cssRes.text()).match(/url\(([^)]+)\)/)?.[1];
    if (!fontUrl) throw new FontError(`フォント URL が見つかりません (${family})`);
    const fontRes = await fetch(fontUrl);
    if (!fontRes.ok) throw new FontError(`Google Fonts file ${fontRes.status} (${family})`);
    buf = await fontRes.arrayBuffer();
    await cache
      .put(key, new Response(buf.slice(0), { headers: { "Cache-Control": "public, max-age=604800" } }))
      .catch(() => {});
  }

  try {
    return parse(buf);
  } catch (e) {
    throw new FontError(`フォントを読み込めません (${family}): ${String(e)}`);
  }
};

/* ── 組版（Typesetter）───────────────────────────────── */

export interface PaintOpts {
  /** 字間（SVG 座標の単位）。負も可 */
  tracking?: number;
  fill?: string;
  /** 指定すると輪郭線（アウトライン文字）。fill は "none" にすること */
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  /** x を左端 / 中央 / 右端のどれとして扱うか */
  anchor?: "start" | "middle" | "end";
}

export interface Typesetter {
  /** 描画したときの幅（字間を含む） */
  width(font: FontName, text: string, size: number, tracking?: number): number;
  /** 文字を <g><path/></g> として返す（baseline は y） */
  text(font: FontName, text: string, x: number, y: number, size: number, o?: PaintOpts): string;
  /**
   * 文字を円（中心 cx,cy・半径 r の円周が baseline）に沿って時計回りに並べる。字の上側が円の外を向く。
   * centerDeg は文字列の中心の角度（真上が 0°、時計回り）
   */
  arc(font: FontName, text: string, cx: number, cy: number, r: number, centerDeg: number, size: number, o?: PaintOpts): string;
}

/** 1 回目の「どの書体でどの文字を使うか」を集めるだけの組版。描画はしない */
export class CollectingTypesetter implements Typesetter {
  readonly used = new Map<FontName, Set<string>>();
  width(font: FontName, text: string, size: number, tracking = 0): number {
    const set = this.used.get(font) ?? new Set<string>();
    for (const ch of text) set.add(ch);
    this.used.set(font, set);
    // 仮の幅（実際の幅は 2 回目で確定する）。全角は 1em、半角は 0.62em
    return [...text].reduce((w, ch) => w + (ch.charCodeAt(0) > 0x2e7f ? 1 : 0.62) * size + tracking, 0) - tracking;
  }
  text(font: FontName, text: string, _x: number, _y: number, size: number, o: PaintOpts = {}): string {
    this.width(font, text, size, o.tracking);
    return "";
  }
  arc(font: FontName, text: string, _cx: number, _cy: number, _r: number, _deg: number, size: number, o: PaintOpts = {}): string {
    return this.text(font, text, 0, 0, size, o);
  }
}

const num = (n: number) => Number(n.toFixed(2)).toString();
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** フォントの輪郭から <path> を作る本番の組版 */
export class OutlineTypesetter implements Typesetter {
  constructor(private readonly fonts: Record<FontName, Font>) {}

  private advance(font: Font, ch: string, size: number): number {
    const g = font.charToGlyph(ch);
    return ((g.advanceWidth ?? font.unitsPerEm * 0.25) * size) / font.unitsPerEm;
  }

  width(name: FontName, text: string, size: number, tracking = 0): number {
    const font = this.fonts[name];
    const chars = [...text];
    let w = 0;
    chars.forEach((ch, i) => {
      w += this.advance(font, ch, size);
      if (i < chars.length - 1) {
        w += tracking + (font.getKerningValue(font.charToGlyph(ch), font.charToGlyph(chars[i + 1])) * size) / font.unitsPerEm;
      }
    });
    return w;
  }

  text(name: FontName, text: string, x: number, y: number, size: number, o: PaintOpts = {}): string {
    if (!text) return "";
    const font = this.fonts[name];
    const tracking = o.tracking ?? 0;
    const w = this.width(name, text, size, tracking);
    let cx = o.anchor === "middle" ? x - w / 2 : o.anchor === "end" ? x - w : x;

    const chars = [...text];
    let d = "";
    chars.forEach((ch, i) => {
      const g = font.charToGlyph(ch);
      if (ch.trim() !== "") d += g.getPath(cx, y, size).toPathData(2);
      cx += this.advance(font, ch, size);
      if (i < chars.length - 1) {
        cx += tracking + (font.getKerningValue(g, font.charToGlyph(chars[i + 1])) * size) / font.unitsPerEm;
      }
    });

    const fill = o.fill ?? "#fff";
    const attrs =
      `fill="${fill}"` +
      (o.stroke ? ` stroke="${o.stroke}" stroke-width="${num(o.strokeWidth ?? 1)}" stroke-linejoin="round"` : "") +
      (o.opacity !== undefined && o.opacity !== 1 ? ` opacity="${o.opacity}"` : "");
    return `<g role="img" aria-label="${esc(text)}"><path ${attrs} d="${d}"/></g>`;
  }

  arc(name: FontName, text: string, cx: number, cy: number, r: number, centerDeg: number, size: number, o: PaintOpts = {}): string {
    if (!text) return "";
    const font = this.fonts[name];
    const tracking = o.tracking ?? 0;
    const chars = [...text];
    let s = -this.width(name, text, size, tracking) / 2; // 文字列の中心からの弧の長さ
    let d = "";
    chars.forEach((ch, i) => {
      const g = font.charToGlyph(ch);
      const adv = this.advance(font, ch, size);
      if (ch.trim() !== "") {
        // 1 文字ぶんの輪郭を、その位置の接線方向に合わせて回して置く
        const th = ((centerDeg + (((s + adv / 2) / r) * 180) / Math.PI) * Math.PI) / 180;
        const [sin, cos] = [Math.sin(th), Math.cos(th)];
        const px = cx + r * sin;
        const py = cy - r * cos;
        const rot = (x: number, y: number): [number, number] => [px + x * cos - y * sin, py + x * sin + y * cos];
        const path = g.getPath(-adv / 2, 0, size);
        for (const c of path.commands) {
          if (c.x !== undefined && c.y !== undefined) [c.x, c.y] = rot(c.x, c.y);
          if (c.x1 !== undefined && c.y1 !== undefined) [c.x1, c.y1] = rot(c.x1, c.y1);
          if (c.x2 !== undefined && c.y2 !== undefined) [c.x2, c.y2] = rot(c.x2, c.y2);
        }
        d += path.toPathData(2);
      }
      s += adv;
      if (i < chars.length - 1) s += tracking + (font.getKerningValue(g, font.charToGlyph(chars[i + 1])) * size) / font.unitsPerEm;
    });
    const attrs = `fill="${o.fill ?? "#fff"}"` + (o.opacity !== undefined && o.opacity !== 1 ? ` opacity="${o.opacity}"` : "");
    return `<g role="img" aria-label="${esc(text)}"><path ${attrs} d="${d}"/></g>`;
  }
}

/** 使う文字を集めて（1 回目）、フォントを読み込み（2 回目の準備）、本番の組版を返す */
export async function buildTypesetter(
  collect: (ts: Typesetter) => unknown,
  loader: FontLoader,
): Promise<OutlineTypesetter> {
  const c = new CollectingTypesetter();
  collect(c);
  const names = Object.keys(FONTS) as FontName[];
  const loaded = await Promise.all(
    names.map((n) => loader(n, [...(c.used.get(n) ?? new Set<string>()), " ", "?"].join(""))),
  );
  return new OutlineTypesetter(Object.fromEntries(names.map((n, i) => [n, loaded[i]])) as Record<FontName, Font>);
}

/** 幅 maxWidth に収まるまで文字サイズを縮める（minSize 未満にはしない） */
export function fitSize(
  ts: Typesetter,
  font: FontName,
  text: string,
  size: number,
  maxWidth: number,
  minSize: number,
  tracking = 0,
): number {
  let s = size;
  while (s > minSize && ts.width(font, text, s, tracking) > maxWidth) s -= 0.5;
  return Math.max(minSize, s);
}
