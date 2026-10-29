// src/logo.png（白背景・黒インクのロゴ）から、背景が透明な「白ロゴ」「黒ロゴ」を作って
// src/logo.ts に base64 で埋め込む。外部ライブラリなし。
// 使い方: ロゴを差し替えたいとき src/logo.png を置き換えて `npm run embed-logo`
import fs from "node:fs";
import zlib from "node:zlib";

const src = fs.readFileSync(new URL("../src/logo.png", import.meta.url));

/* ── PNG デコード（8bit RGBA / 非インターレースのみ）── */
let pos = 8, w = 0, h = 0, color = 0, bit = 0, interlace = 0;
const idat = [];
while (pos < src.length) {
  const len = src.readUInt32BE(pos), type = src.toString("ascii", pos + 4, pos + 8), data = src.subarray(pos + 8, pos + 8 + len);
  if (type === "IHDR") { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bit = data[8]; color = data[9]; interlace = data[12]; }
  else if (type === "IDAT") idat.push(data);
  pos += 12 + len;
  if (type === "IEND") break;
}
if (bit !== 8 || color !== 6 || interlace !== 0) {
  throw new Error(`src/logo.png は 8bit RGBA・非インターレースの PNG にしてください (bit=${bit} color=${color} interlace=${interlace})`);
}
const bpp = 4, stride = w * bpp, raw = zlib.inflateSync(Buffer.concat(idat)), px = Buffer.alloc(h * stride);
for (let y = 0; y < h; y++) {
  const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), o = y * stride;
  for (let i = 0; i < stride; i++) {
    const a = i >= bpp ? px[o + i - bpp] : 0, b = y ? px[o - stride + i] : 0, c = i >= bpp && y ? px[o - stride + i - bpp] : 0;
    let v = line[i];
    if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
    else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
    px[o + i] = v & 255;
  }
}

/** 白=透明・黒=不透明にして、指定色(0=黒/255=白)の透過 PNG を作る。紙のノイズ(輝度 244 以上)は完全透明 */
function encode(rgb) {
  const out = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * stride + x * 4, lum = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
      const alpha = lum >= 244 ? 0 : Math.min(255, Math.round(((244 - lum) / 244) * 255 * 1.08));
      const o = y * (stride + 1) + 1 + x * 4;
      out[o] = rgb; out[o + 1] = rgb; out[o + 2] = rgb; out[o + 3] = alpha;
    }
  }
  const chunk = (type, data) => {
    const b = Buffer.alloc(12 + data.length);
    b.writeUInt32BE(data.length, 0); b.write(type, 4, "ascii"); data.copy(b, 8);
    b.writeUInt32BE(zlib.crc32(b.subarray(4, 8 + data.length)), 8 + data.length);
    return b;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(out, { level: 9 })), chunk("IEND", Buffer.alloc(0)),
  ]);
}

const uri = (buf) => `data:image/png;base64,${buf.toString("base64")}`;
const white = uri(encode(255)), black = uri(encode(0));

fs.writeFileSync(
  new URL("../src/logo.ts", import.meta.url),
  `/**
 * テック部エンブレム（剣 + 蛇 + 回路）。src/logo.png から生成した「背景が透明」な PNG を base64 で同梱。
 * 差し替える場合は src/logo.png を置き換えて \`npm run embed-logo\`。
 */
export const LOGO_WIDTH = ${w};
export const LOGO_HEIGHT = ${h};
/** 黒地の上に置く白ロゴ */
export const LOGO_WHITE_DATA_URI =
  "${white}";
/** 白地の上に置く黒ロゴ */
export const LOGO_BLACK_DATA_URI =
  "${black}";
`,
);
console.log(`src/logo.ts regenerated (${w}x${h}) white=${white.length} black=${black.length} chars`);
