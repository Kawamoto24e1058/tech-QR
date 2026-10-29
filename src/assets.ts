import { LOGO_BLACK_DATA_URI, LOGO_WHITE_DATA_URI } from "./logo";

const cache = new Map<string, Uint8Array>();

function decode(dataUri: string): Uint8Array {
  const hit = cache.get(dataUri);
  if (hit) return hit;
  const bin = atob(dataUri.slice(dataUri.indexOf(",") + 1));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  cache.set(dataUri, bytes);
  return bytes;
}

/** 黒地用の白ロゴ（背景透明）。プロフィールページの <img> 用 */
export const logoWhitePng = () => decode(LOGO_WHITE_DATA_URI);
/** 白地用の黒ロゴ（背景透明）。管理画面の名刺プレビューが参照する */
export const logoBlackPng = () => decode(LOGO_BLACK_DATA_URI);
