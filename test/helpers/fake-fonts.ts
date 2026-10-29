/**
 * テスト用の疑似 Google Fonts。
 * CSS API と gstatic のファイル取得を模倣し、要求された文字だけを持つ「四角いグリフ」の TTF を opentype.js で生成して返す。
 * これで本物の取得コード（fonts.ts）をネットワークなしで通せる。
 */
import * as opentype from "opentype.js";

const ot = opentype as any;

function fakeTtf(text: string): ArrayBuffer {
  const chars = [...new Set([...text])];
  const notdef = new ot.Glyph({ name: ".notdef", unicode: 0, advanceWidth: 600, path: new ot.Path() });
  const glyphs = chars.map((ch) => {
    const path = new ot.Path();
    if (ch.trim() !== "") {
      path.moveTo(50, 0);
      path.lineTo(550, 0);
      path.lineTo(550, 700);
      path.lineTo(50, 700);
      path.close();
    }
    return new ot.Glyph({ name: `u${ch.codePointAt(0)}`, unicode: ch.codePointAt(0), advanceWidth: ch === " " ? 300 : 600, path });
  });
  return new ot.Font({ familyName: "Fake", styleName: "Regular", unitsPerEm: 1000, ascender: 800, descender: -200, glyphs: [notdef, ...glyphs] }).toArrayBuffer();
}

/** フォント関連のリクエストなら疑似レスポンスを返し、それ以外は null */
export function fakeFontResponse(url: URL): Response | null {
  if (url.host === "fonts.googleapis.com") {
    const text = url.searchParams.get("text") ?? "";
    const file = `https://fonts.gstatic.com/l/font?kit=fake&text=${encodeURIComponent(text)}`;
    return new Response(`@font-face { font-family: 'Fake'; src: url(${file}) format('truetype'); }`, {
      headers: { "Content-Type": "text/css" },
    });
  }
  if (url.host === "fonts.gstatic.com") {
    return new Response(fakeTtf(url.searchParams.get("text") ?? ""), { headers: { "Content-Type": "font/ttf" } });
  }
  return null;
}
