/**
 * PDF の 1 ページぶんの「文字」と「罫線」から、表（行 × 列の文字列）を組み立てる。
 *
 * 管理画面のブラウザ側で pdf.js が取り出した文字の位置と罫線の座標を渡す（admin-page.ts がこの関数のソースをそのまま埋め込む）。
 * Excel / Google スプレッドシートの PDF 書き出しのように、セルに罫線がある表を想定。罫線の位置でセルを決めるので、
 * セルの中で折り返した文字（フリガナや複数行の役職）も、そのセルの 1 つの値になる。
 *
 * 注意: この関数は文字列にして管理画面へ埋め込む。中に名前付きの関数やアロー関数の変数を作らないこと
 * （バンドラが `__name(...)` を差し込むと、埋め込み先で動かなくなる）。
 */
export interface PdfItem {
  /** 文字の左端・ベースライン（PDF の座標。上へ行くほど大きい） */
  x: number;
  y: number;
  w: number;
  h: number;
  s: string;
}
export interface PdfHLine {
  y: number;
  x0: number;
  x1: number;
}
export interface PdfVLine {
  x: number;
  y0: number;
  y1: number;
}

export function gridToTable(items: PdfItem[], hs: PdfHLine[], vs: PdfVLine[]): string[][] {
  // 列の境目（縦線の x）と行の境目（横線の y）。ごく近い線は 1 本にまとめる
  const cols: number[] = [];
  for (const x of vs.filter((v) => v.y1 - v.y0 > 14).map((v) => v.x).sort((a, b) => a - b)) {
    if (!cols.length || x - cols[cols.length - 1] > 3) cols.push(x);
  }
  const rows: number[] = []; // 大きい順（上から下）
  for (const y of hs.filter((h) => h.x1 - h.x0 > 30).map((h) => h.y).sort((a, b) => b - a)) {
    if (!rows.length || rows[rows.length - 1] - y > 2) rows.push(y);
  }

  // 文字をセルに振り分ける（文字の中心がどのセルに入るか）
  const cells = new Map<string, PdfItem[]>();
  for (const it of items) {
    if (!it.s.trim()) continue;
    const cx = it.x + it.w / 2;
    const cy = it.y + it.h * 0.3;
    let r = -1;
    for (let i = 0; i + 1 < rows.length; i++) {
      if (cy <= rows[i] && cy > rows[i + 1]) {
        r = i;
        break;
      }
    }
    if (r < 0) continue;
    let c = 0;
    for (const x of cols) if (cx > x) c++;
    const key = r + "," + c;
    const list = cells.get(key);
    if (list) list.push(it);
    else cells.set(key, [it]);
  }

  // セルごとに、上の行から順に・左から右へ並べて 1 つの文字列にする（行が変われば改行）
  const out: string[][] = [];
  for (let r = 0; r + 1 < rows.length; r++) {
    const row: string[] = [];
    let any = false;
    for (let c = 0; c <= cols.length; c++) {
      const list = cells.get(r + "," + c);
      if (!list) {
        row.push("");
        continue;
      }
      list.sort((a, b) => b.y - a.y || a.x - b.x);
      const lines: PdfItem[][] = [];
      for (const it of list) {
        const last = lines[lines.length - 1];
        if (last && Math.abs(last[0].y - it.y) <= Math.max(2, it.h * 0.5)) last.push(it);
        else lines.push([it]);
      }
      const text = lines
        .map((l) => l.sort((a, b) => a.x - b.x).map((i) => i.s).join(""))
        .join("\n")
        .trim();
      if (text) any = true;
      row.push(text);
    }
    if (any) out.push(row);
  }
  return out;
}
