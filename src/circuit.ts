/**
 * 名刺の裏面に敷く「基板（PCB）」の絵。QR を載せる IC（U1）を中心に、実際の基板で見かける部品と配線を並べる。
 *
 * - 配線は 45° の折れ線（直角と斜め）。信号線は細く、電源線だけ太く
 * - U1（QFP）の 4 辺に 11 ピン。左はピンヘッダ J1、右はテストポイントと IC（U2）、上は水晶（Y1）・
 *   差動ペア・蛇行配線（長さ合わせ）、下はビア
 * - 抵抗・コンデンサは実際の部品と同じく「2 つのパッド + 外形」。基準番号（R1 など）をシルク印刷風に
 * - 隅は取り付け穴、縁にはグランドのビアフェンス、角にグランドのベタ（斜線）
 * - 白（#fff）の線だけで描く。最小の線幅は 1.4 単位（0.14mm）、線どうしの間隔は 0.4mm 以上
 */
import type { Typesetter } from "./fonts";

const W = "#ffffff";
const K = "#0a0a0c";

type Pt = [number, number];

const num = (n: number) => Number(n.toFixed(1)).toString();

/** U1（QR を載せる IC）の外形。裏面の QR パネルはこの内側に置く */
export const CHIP = { x0: 295, y0: 115, x1: 615, y1: 435, pins: 11 } as const;

const pitch = (CHIP.x1 - CHIP.x0 - 16) / (CHIP.pins - 1);
/** U1 の左右ピンの y / 上下ピンの x */
const pinY = (i: number) => CHIP.y0 + 8 + i * pitch;
const pinX = (i: number) => CHIP.x0 + 8 + i * pitch;

/* ── 部品 ───────────────────────────────────────────── */

/** 配線（折れ線）。w は線幅、o は不透明度 */
function trace(pts: Pt[], w = 1.8, o = 0.66): string {
  return `<path d="M${pts.map((p) => `${num(p[0])} ${num(p[1])}`).join("L")}" fill="none" stroke="${W}" stroke-opacity="${o}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"/>`;
}

const pad = (x: number, y: number, w: number, h: number) =>
  `<rect x="${num(x - w / 2)}" y="${num(y - h / 2)}" width="${w}" height="${h}" fill="${W}"/>`;

/** スルーホールのパッド（白い輪に穴） */
const ring = (x: number, y: number, r = 7, hole = 3) =>
  `<circle cx="${num(x)}" cy="${num(y)}" r="${r}" fill="${W}"/><circle cx="${num(x)}" cy="${num(y)}" r="${hole}" fill="${K}"/>`;

/** ビア（層を貫く穴） */
const via = (x: number, y: number, r = 4.5) =>
  `<circle cx="${num(x)}" cy="${num(y)}" r="${r}" fill="${K}" stroke="${W}" stroke-opacity=".85" stroke-width="1.8"/><circle cx="${num(x)}" cy="${num(y)}" r="1.5" fill="${W}"/>`;

/** 抵抗・コンデンサ（2 つのパッド + 外形）。horizontal=true なら横向き */
function passive(x: number, y: number, horizontal: boolean, kind: "r" | "c"): string {
  const [dx, dy] = horizontal ? [11, 0] : [0, 11];
  const [pw, ph] = horizontal ? [9, 12] : [12, 9];
  const [bw, bh] = horizontal ? [18, 11] : [11, 18];
  const body =
    kind === "r"
      ? `<rect x="${num(x - bw / 2)}" y="${num(y - bh / 2)}" width="${bw}" height="${bh}" fill="none" stroke="${W}" stroke-opacity=".55" stroke-width="1.4"/>`
      : `<path d="${horizontal ? `M${x - 2.5} ${y - 6}v12M${x + 2.5} ${y - 6}v12` : `M${x - 6} ${y - 2.5}h12M${x - 6} ${y + 2.5}h12`}" stroke="${W}" stroke-opacity=".7" stroke-width="1.8"/>`;
  return pad(x - dx, y - dy, pw, ph) + pad(x + dx, y + dy, pw, ph) + body;
}

/** QFP/QFN 風の IC。size は一辺、pins は一辺のピン数 */
function ic(x: number, y: number, size: number, pins: number, pinLen: number): string {
  const step = (size - 16) / (pins - 1);
  let s = `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="5" fill="${K}" stroke="${W}" stroke-opacity=".9" stroke-width="2"/><circle cx="${x + 9}" cy="${y + 9}" r="3" fill="${W}"/><g fill="${W}">`;
  for (let i = 0; i < pins; i++) {
    const t = 8 + i * step - 2.5;
    s += `<rect x="${num(x - pinLen)}" y="${num(y + t)}" width="${pinLen}" height="5"/><rect x="${x + size}" y="${num(y + t)}" width="${pinLen}" height="5"/>`;
    s += `<rect x="${num(x + t)}" y="${num(y - pinLen)}" width="5" height="${pinLen}"/><rect x="${num(x + t)}" y="${y + size}" width="5" height="${pinLen}"/>`;
  }
  return s + "</g>";
}

/** 取り付け穴（穴・輪・十字の禁止領域） */
const hole = (x: number, y: number) =>
  `<g fill="none" stroke="${W}"><circle cx="${x}" cy="${y}" r="11" stroke-opacity=".8" stroke-width="2"/><circle cx="${x}" cy="${y}" r="4" stroke-opacity=".8" stroke-width="2"/><path d="M${x - 19} ${y}h6m14 0h6M${x} ${y - 19}v6m0 14v6" stroke-opacity=".55" stroke-width="1.6"/></g>`;

/** グランドのベタ（斜線の塗り）。長方形の中を 45° の線で埋める */
function hatch(x: number, y: number, w: number, h: number, id: string): string {
  let d = "";
  for (let k = -h; k < w; k += 9) d += `M${x + k} ${y + h}l${h} ${-h}`;
  return `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath><g clip-path="url(#${id})"><path d="${d}" stroke="${W}" stroke-opacity=".3" stroke-width="1.4"/></g><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${W}" stroke-opacity=".5" stroke-width="1.4"/>`;
}

/** 蛇行配線（長さ合わせ）。(x0,y) から x1 へ、振幅 amp・ピッチ pitchX で上下に折れる */
function meander(x0: number, y: number, x1: number, amp: number, step: number): Pt[] {
  const pts: Pt[] = [[x0, y]];
  let x = x0;
  let up = true;
  while (x + step * 2 <= x1) {
    pts.push([x + step / 2, y], [x + step / 2, up ? y - amp : y + amp], [x + step * 1.5, up ? y - amp : y + amp], [x + step * 1.5, y]);
    x += step * 1.5;
    up = !up;
  }
  pts.push([x1, y]);
  return pts;
}

/* ── 基板全体 ──────────────────────────────────────────── */

/**
 * 裏面の基板。U1 の本体とピン、配線、周辺部品、シルク印刷を返す。
 * QR のパネルは呼び出し側が U1 の内側に重ねる。ロゴの部品枠も（ロゴ自体は呼び出し側が置く）ここで描く。
 */
export function board(ts: Typesetter): string {
  const o: string[] = [];
  const silk = (t: string, x: number, y: number, anchor: "start" | "middle" | "end" = "start") =>
    ts.text("mono", t, x, y, 14, { opacity: 0.6, tracking: 1, anchor });

  // グランドのベタ
  o.push(hatch(160, 462, 90, 46, "h1"), hatch(690, 462, 96, 46, "h2"));

  // 縁のビアフェンス
  for (let y = 112; y <= 440; y += 26) o.push(via(50, y, 3.2), via(860, y, 3.2));

  // 取り付け穴
  for (const [x, y] of [[70, 70], [840, 70], [70, 480], [840, 480]] as Pt[]) o.push(hole(x, y));

  // ── 左: ピンヘッダ J1（8 ピン）と U1 を結ぶバス。1 番ピンは四角いパッド、電源線は太く
  for (let i = 0; i < 8; i++) {
    const y = pinY(i);
    const ty = 150 + i * 30;
    const dy = ty - y;
    const pts: Pt[] = [[CHIP.x0 - 14, y], [232, y], [232 - Math.abs(dy), ty], [91, ty]];
    o.push(trace(pts, i === 0 ? 3.6 : 1.8, i === 0 ? 0.85 : 0.66));
    o.push(i === 0 ? pad(84, ty, 15, 15) : ring(84, ty));
  }
  o.push(`<rect x="70" y="136" width="30" height="${8 * 30 - 6}" rx="3" fill="none" stroke="${W}" stroke-opacity=".5" stroke-width="1.4"/>`);
  o.push(silk("J1", 70, 126));

  // 左下: プルアップ抵抗 R1-R3 とビア
  for (let k = 0; k < 3; k++) {
    const y = pinY(8 + k);
    o.push(trace([[CHIP.x0 - 14, y], [222, y]], 1.8));
    o.push(passive(210, y, true, "r"));
    o.push(trace([[188, y], [150, y]], 1.8), via(144, y));
    o.push(silk(`R${k + 1}`, 210, y - 12, "middle"));
  }

  // ── 右: テストポイント TP1-TP3（うち 1 本は抵抗を挟む）と U2（QFN）
  for (let i = 0; i < 3; i++) {
    const y = pinY(i);
    o.push(trace([[CHIP.x1 + 14, y], [i === 1 ? 668 : 718, y]], 1.8));
    if (i === 1) o.push(passive(680, y, true, "r"), trace([[702, y], [718, y]], 1.8), silk("R4", 680, y - 12, "middle"));
    o.push(ring(728, y, 8, 3.4), silk(`TP${i + 1}`, 744, y + 5));
  }
  const u2 = { x: 786, y: 232, size: 64, pins: 5 };
  const u2step = (u2.size - 16) / (u2.pins - 1);
  for (let k = 0; k < 5; k++) {
    const y = pinY(3 + k);
    const ty = u2.y + 8 + k * u2step;
    const dy = ty - y;
    o.push(trace([[CHIP.x1 + 14, y], [690, y], [690 + Math.abs(dy), ty], [u2.x - 12, ty]], 1.8));
  }
  o.push(ic(u2.x, u2.y, u2.size, u2.pins, 12), silk("U2", u2.x + u2.size / 2, u2.y - 22, "middle"));
  o.push(passive(748, 322, false, "c"), trace([[748, 333], [748, 360]], 1.8), via(748, 366), silk("C5", 770, 326));

  // 右下: 差動ペア（2 本を平行に）とビア
  for (const [i, y0] of [[8, pinY(8)], [9, pinY(9)]] as Array<[number, number]>) {
    const j = i - 8;
    o.push(trace([[CHIP.x1 + 14, y0], [650 + j * 7, y0], [690 + j * 7, y0 + 40 - j * 7], [790, y0 + 40 - j * 7]], 1.8));
    o.push(via(796, y0 + 40 - j * 7));
  }
  o.push(trace([[CHIP.x1 + 14, pinY(10)], [660, pinY(10)]], 1.8), passive(672, pinY(10), true, "c"), trace([[683, pinY(10)], [702, pinY(10)]], 1.8), via(708, pinY(10)), silk("C4", 672, pinY(10) + 24, "middle"));

  // ── 上: 水晶 Y1（2 本）、蛇行配線（長さ合わせ）、電源の太い線、ビア
  o.push(`<rect x="148" y="58" width="56" height="22" rx="3" fill="none" stroke="${W}" stroke-opacity=".7" stroke-width="1.6"/>`, pad(144, 69, 9, 14), pad(208, 69, 9, 14), silk("Y1", 176, 50, "middle"));
  o.push(trace([[pinX(0), CHIP.y0 - 14], [pinX(0), 69], [213, 69]], 1.8));
  o.push(trace([[pinX(1), CHIP.y0 - 14], [pinX(1), 92], [130, 92], [130, 69], [139, 69]], 1.8));
  o.push(passive(150, 92, true, "c"), silk("C1", 150, 116, "middle"));

  o.push(trace([[pinX(3), CHIP.y0 - 14], [pinX(3), 84], ...meander(pinX(3), 84, 560, 12, 13).slice(1)], 1.8));
  o.push(via(566, 84));
  o.push(trace([[pinX(4), CHIP.y0 - 14], [pinX(4), 70], [560, 70]], 1.8), via(566, 70));

  for (const i of [2, 5, 6, 7, 8, 9, 10]) {
    const x = pinX(i);
    o.push(trace([[x, CHIP.y0 - 14], [x, 92], [x + 10, 82], [x + 10, 62]], i === 2 ? 3.6 : 1.8, i === 2 ? 0.85 : 0.66), via(x + 10, 58, i === 2 ? 5.5 : 4.5));
  }

  // ── 下: 電源のデカップリング（C2-C3）とビア
  for (const [i, name] of [[0, "C2"], [10, "C3"]] as Array<[number, string]>) {
    const x = pinX(i);
    o.push(trace([[x, CHIP.y1 + 14], [x, 466]], 1.8), passive(x, 476, false, "c"), trace([[x, 487], [x, 500]], 1.8), via(x, 504, 3.4), silk(name, x + (i ? 24 : -24), 480, i ? "start" : "end"));
  }
  for (const i of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
    const x = pinX(i);
    o.push(trace([[x, CHIP.y1 + 14], [x, 462], [x + (i % 2 ? 8 : -8), 474], [x + (i % 2 ? 8 : -8), 492]], 1.8), via(x + (i % 2 ? 8 : -8), 498, 3.8));
  }

  // ── U1 本体（QFP）とピン番号
  o.push(`<rect x="${CHIP.x0 - 7}" y="${CHIP.y0 - 7}" width="${CHIP.x1 - CHIP.x0 + 14}" height="${CHIP.y1 - CHIP.y0 + 14}" rx="20" fill="none" stroke="${W}" stroke-opacity=".08" stroke-width="12"/>`);
  o.push(`<rect x="${CHIP.x0}" y="${CHIP.y0}" width="${CHIP.x1 - CHIP.x0}" height="${CHIP.y1 - CHIP.y0}" rx="16" fill="${K}" stroke="${W}" stroke-width="2.4"/>`);
  o.push(`<g fill="${W}">`);
  for (let i = 0; i < CHIP.pins; i++) {
    const y = pinY(i) - 4;
    const x = pinX(i) - 4;
    o.push(`<rect x="${CHIP.x0 - 14}" y="${num(y)}" width="14" height="8"/><rect x="${CHIP.x1}" y="${num(y)}" width="14" height="8"/>`);
    o.push(`<rect x="${num(x)}" y="${CHIP.y0 - 14}" width="8" height="14"/><rect x="${num(x)}" y="${CHIP.y1}" width="8" height="14"/>`);
  }
  o.push(`</g><circle cx="${CHIP.x0 + 17}" cy="${CHIP.y0 + 17}" r="5.5" fill="${W}"/>`);
  o.push(silk("U1", CHIP.x0, CHIP.y0 - 26), silk("1", CHIP.x0 - 22, CHIP.y0 + 30, "end"));

  // ── 左下: ロゴの部品枠
  o.push(`<rect x="60" y="444" width="70" height="70" rx="6" fill="${K}" stroke="${W}" stroke-opacity=".8" stroke-width="2"/>`);
  return o.join("\n  ");
}
