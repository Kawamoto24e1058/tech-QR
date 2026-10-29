import { describe, expect, it } from "vitest";
import { buildRows, detectColumns, markDuplicates, readCsv, readTable, RosterError } from "../src/roster";
import { isOfficer } from "../src/notion";
import { makeXlsx } from "./helpers/make-xlsx";

const ROLES = [
  { jp: "部長", en: "President" },
  { jp: "副部長", en: "Vice President" },
];

describe("readCsv", () => {
  it("handles quotes, embedded commas/newlines, BOM and CRLF", () => {
    const t = readCsv('﻿氏名,役職,備考\r\n"山田, 太郎",部長,"a\nb"\r\n佐藤 花子,,"""q"""\r\n');
    expect(t).toEqual([
      ["氏名", "役職", "備考"],
      ["山田, 太郎", "部長", "a\nb"],
      ["佐藤 花子", "", '"q"'],
    ]);
  });
  it("reads tab-separated text", () => {
    expect(readCsv("氏名\t役職\n山田\t部長")).toEqual([["氏名", "役職"], ["山田", "部長"]]);
  });
});

describe("readTable (.xlsx)", () => {
  const rows = [
    ["氏名", "ローマ字", "役職", "メール"],
    ["川本 晴春", "Haru Kawamoto", "部長", "24e1058@andrew.ac.jp"],
    ["佐藤 & 花子", "", "", "25e0001@andrew.ac.jp"],
  ];
  it("reads stored and deflated workbooks (shared strings, XML entities, sparse cells)", async () => {
    for (const deflate of [false, true]) {
      const t = await readTable(await makeXlsx(rows, deflate));
      expect(t[0]).toEqual(["氏名", "ローマ字", "役職", "メール"]);
      expect(t[2]).toEqual(["佐藤 & 花子", "", "", "25e0001@andrew.ac.jp"]);
    }
  });
  it("falls back to CSV for non-zip data and rejects legacy .xls / empty / oversized files", async () => {
    expect((await readTable(new TextEncoder().encode("a,b\n1,2")))[1]).toEqual(["1", "2"]);
    await expect(readTable(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0, 0]))).rejects.toThrow(RosterError);
    await expect(readTable(new Uint8Array())).rejects.toThrow(RosterError);
    await expect(readTable(new Uint8Array(3 * 1024 * 1024))).rejects.toThrow("大きすぎます");
    const err = await readTable(new Uint8Array(24).fill(0).map((_, i) => (i === 0 ? 0x50 : i === 1 ? 0x4b : 1))).catch((e) => e);
    expect(err).toBeInstanceOf(RosterError);
  });
});

describe("detectColumns", () => {
  it("guesses columns from common header names", () => {
    const m = detectColumns(["学籍番号", "氏名", "ローマ字氏名", "役職", "メールアドレス", "GitHub ID", "X(Twitter)", "スキル", "名刺希望"]);
    expect(m).toMatchObject({ id: 0, nameJp: 1, nameEn: 2, role: 3, email: 4, githubId: 5, xId: 6, skills: 7, card: 8 });
  });
  it("uses 姓/名 when there is no 氏名 column, and leaves unknown fields at -1", () => {
    const m = detectColumns(["姓", "名", "Email"]);
    expect(m).toMatchObject({ surname: 0, given: 1, email: 2, nameJp: -1, id: -1, role: -1 });
  });
});

describe("buildRows", () => {
  const head = ["氏名", "ローマ字", "役職", "メール", "GitHub", "スキル", "名刺希望"];
  const table = [
    head,
    ["川本 晴春", "Haru Kawamoto", "部長", "24E1058@andrew.ac.jp", "https://github.com/haru2514", "TypeScript、Cloudflare", ""],
    ["佐藤 花子", "", "部員", "25e0001@andrew.ac.jp", "", "", "○"],
    ["田中　一郎", "", "", "tanaka@example.com", "", "", ""],
    ["鈴木 次郎", "", "会計", "26e0002@andrew.ac.jp", "", "", ""],
  ];
  const rows = buildRows(table, detectColumns(head), ROLES);

  it("derives the ID from @andrew.ac.jp mail, maps roles, and parses handles/skills", () => {
    expect(rows[0]).toMatchObject({ id: "24e1058", role: "部長", githubId: "haru2514", skills: ["TypeScript", "Cloudflare"], line: 2, problems: [] });
  });
  it("treats 部員/blank as no role; card comes from the 名刺希望 column only for them", () => {
    expect(rows[1]).toMatchObject({ role: "", card: true, problems: [] });
    expect(isOfficer(rows[1].role)).toBe(false);
  });
  it("flags rows whose ID cannot be derived and unregistered roles", () => {
    expect(rows[2].id).toBe("");
    expect(rows[2].nameJp).toBe("田中 一郎"); // 全角スペースをそろえる
    expect(rows[2].problems.join()).toContain("ID を決められません");
    expect(rows[3].role).toBe("");
    expect(rows[3].problems.join()).toContain("未登録の役職「会計」");
  });
  it("marks duplicate IDs inside the roster", () => {
    const dup = buildRows([head, ["A", "", "", "x1@andrew.ac.jp", "", "", ""], ["B", "", "", "x1@andrew.ac.jp", "", "", ""]], detectColumns(head), ROLES);
    markDuplicates(dup);
    expect(dup.every((r) => r.problems.join().includes("重なって"))).toBe(true);
  });
});
