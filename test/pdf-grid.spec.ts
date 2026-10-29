import { describe, expect, it } from "vitest";
import { ADMIN_CLIENT_JS } from "../src/admin-page";
import { gridToTable, type PdfHLine, type PdfItem, type PdfVLine } from "../src/pdf-grid";

/** 罫線つきの表（列の境目 xs・行の境目 ys）を作る。y は大きいほど上 */
function grid(xs: number[], ys: number[]): { hs: PdfHLine[]; vs: PdfVLine[] } {
  const hs = ys.flatMap((y) => xs.slice(0, -1).map((x, i) => ({ y, x0: x, x1: xs[i + 1] })));
  const vs = xs.flatMap((x) => ys.slice(0, -1).map((y, i) => ({ x, y0: ys[i + 1], y1: y })));
  return { hs, vs };
}
const item = (s: string, x: number, y: number): PdfItem => ({ s, x, y, w: s.length * 8, h: 10 });

describe("gridToTable", () => {
  const { hs, vs } = grid([50, 120, 200, 320], [800, 780, 740, 720]);

  it("puts text into the cells the borders define, joining wrapped lines inside one cell", () => {
    const items = [
      item("役職", 60, 785),
      item("氏名", 130, 785),
      item("学籍番号", 210, 785),
      // 2 行目は高さ 40 のセル。役職が 3 行（上から順）、氏名はふつうに 1 行
      item("副部長", 60, 765),
      item("会計", 60, 753),
      item("渉外", 60, 743),
      item("山田", 130, 755),
      item("24E0001", 210, 755),
      item("A", 60, 725),
    ];
    const t = gridToTable(items, hs, vs);
    expect(t[0]).toEqual(["", "役職", "氏名", "学籍番号", ""]);
    expect(t[1]).toEqual(["", "副部長\n会計\n渉外", "山田", "24E0001", ""]);
    expect(t[2]).toEqual(["", "A", "", "", ""]);
  });

  it("joins pieces on the same line left to right, ignores text outside the table and empty rows", () => {
    const t = gridToTable([item("カワ", 60, 785), item("モト", 76, 785), item("余白", 60, 900), item(" ", 90, 785)], hs, vs);
    expect(t).toEqual([["", "カワモト", "", "", ""]]);
  });

  it("returns nothing when there are no ruled cells", () => {
    expect(gridToTable([item("x", 1, 1)], [], [])).toEqual([]);
  });
});

describe("admin page", () => {
  it("embeds gridToTable as plain JS (no bundler helpers, which would break in the browser)", () => {
    expect(ADMIN_CLIENT_JS).toContain("function gridToTable(");
    expect(ADMIN_CLIENT_JS).not.toContain("__name(");
    expect(ADMIN_CLIENT_JS).not.toContain("/*PDFGRID*/");
  });
});
