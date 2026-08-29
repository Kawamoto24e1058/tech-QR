// src/logo.png を読み込んで src/logo.ts（base64 データURI）を再生成する。
// 使い方: ロゴを差し替えたいとき src/logo.png を置き換えて `npm run embed-logo`
import { readFileSync, writeFileSync } from "node:fs";

const png = readFileSync(new URL("../src/logo.png", import.meta.url));
if (png.toString("ascii", 1, 4) !== "PNG") {
  throw new Error("src/logo.png is not a valid PNG");
}
// IHDR: width/height は 8バイトシグネチャ + 4(len) + 4('IHDR') の後
const width = png.readUInt32BE(16);
const height = png.readUInt32BE(20);
const uri = `data:image/png;base64,${png.toString("base64")}`;

const out = `/**
 * テック部エンブレム（剣 + 蛇 + 回路）。黒ロゴ PNG を base64 で同梱。
 * 白で表示する箇所は SVG 側の feColorMatrix フィルタ(logo-invert)で反転する。
 * 差し替える場合は src/logo.png を置き換えて \`npm run embed-logo\` を実行。
 */
export const LOGO_WIDTH = ${width};
export const LOGO_HEIGHT = ${height};
export const LOGO_DATA_URI =
  "${uri}";
`;
writeFileSync(new URL("../src/logo.ts", import.meta.url), out);
console.log(`src/logo.ts regenerated (${width}x${height}, ${uri.length} chars)`);
