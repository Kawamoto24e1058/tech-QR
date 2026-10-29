import { LOGO_DATA_URI } from "./logo";

let bytes: Uint8Array | null = null;

/** LOGO_DATA_URI(base64) をデコードした PNG バイト列（初回のみ計算）。プロフィールページの <img> 用 */
export function logoPngBytes(): Uint8Array {
  if (!bytes) {
    const bin = atob(LOGO_DATA_URI.slice(LOGO_DATA_URI.indexOf(",") + 1));
    bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  }
  return bytes;
}
