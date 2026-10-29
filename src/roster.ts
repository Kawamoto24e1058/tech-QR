/**
 * 名簿（Excel の .xlsx または CSV）の読み込みと、メンバー 1 人ぶんへの変換。
 *
 * - .xlsx は ZIP + XML なので、外部ライブラリなしで読む（ZIP は DecompressionStream で展開、XML は必要な箇所だけ正規表現で）。
 *   最初のシートの 1 行目を見出しとして読む。数式セルは保存されている計算結果を使う
 * - 見出しの名前から列の意味（氏名・役職・メール…）を推測する。違っていれば管理画面で選び直せる
 * - ID（QR の鍵）は、名簿に ID 列があればそれ、なければメール（@andrew.ac.jp）の @ より前
 * - 役職がある人は名刺を自動で作り、役職のない部員は「名刺希望」が○の人だけ作る
 */
import { ID_PATTERN, normalizeHandle, PLAIN_ROLES, type Role } from "./notion";

/* ── ファイルの読み込み ───────────────────────────────── */

export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_ROWS = 500;
const MAX_ENTRY_BYTES = 12 * 1024 * 1024;

export class RosterError extends Error {}

/** 名簿ファイルを「行 × 列」の文字列表にする（先頭のシートだけ） */
export async function readTable(bytes: Uint8Array): Promise<string[][]> {
  if (bytes.length === 0) throw new RosterError("ファイルが空です");
  if (bytes.length > MAX_FILE_BYTES) throw new RosterError("ファイルが大きすぎます（2MB まで）");
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (isZip) return await readXlsx(bytes);
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) {
    throw new RosterError("古い形式（.xls）は読み込めません。Excel で「名前を付けて保存」→「Excel ブック（.xlsx）」にして、もう一度お試しください。");
  }
  return readCsv(decodeText(bytes));
}

function decodeText(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes);
  } catch {
    // Excel の「CSV（コンマ区切り）」は Shift_JIS
    return new TextDecoder("shift_jis").decode(bytes);
  }
}

/** RFC 4180 の CSV（引用符・引用符内の改行・"" のエスケープ）。区切りは , か タブ */
export function readCsv(textIn: string): string[][] {
  const text = textIn.replace(/^﻿/, "");
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const sep = (firstLine.match(/\t/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? "\t" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      rows.push(row);
      row = [];
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/* ── .xlsx（ZIP + XML）───────────────────────────────── */

type ZipEntry = { method: number; compressed: Uint8Array; size: number };

function readZip(buf: Uint8Array): Map<string, ZipEntry> {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new RosterError("Excel ファイルとして読めません（壊れているか、.xlsx ではありません）");
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const out = new Map<string, ZipEntry>();
  const td = new TextDecoder();
  for (let n = 0; n < Math.min(count, 500); n++) {
    if (p + 46 > buf.length || dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const size = dv.getUint32(p + 24, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const name = td.decode(buf.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    if (local + 30 > buf.length || dv.getUint32(local, true) !== 0x04034b50) continue;
    const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
    if (start + csize > buf.length) continue;
    out.set(name, { method, compressed: buf.subarray(start, start + csize), size });
  }
  return out;
}

async function unzipText(entries: Map<string, ZipEntry>, name: string): Promise<string | null> {
  const e = entries.get(name);
  if (!e) return null;
  if (e.size > MAX_ENTRY_BYTES) throw new RosterError("ファイルの中身が大きすぎます");
  let data: Uint8Array;
  if (e.method === 0) data = e.compressed;
  else if (e.method === 8) {
    const reader = new Blob([e.compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw")).getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_ENTRY_BYTES) {
        await reader.cancel();
        throw new RosterError("ファイルの中身が大きすぎます");
      }
      chunks.push(value);
    }
    data = new Uint8Array(total);
    let o = 0;
    for (const c of chunks) {
      data.set(c, o);
      o += c.length;
    }
  } else throw new RosterError("対応していない圧縮方式の Excel ファイルです");
  return new TextDecoder().decode(data);
}

function xmlDecode(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(Number.parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** <t>…</t> の中身をつなげる（ふりがな <rPh> は除く） */
function textRuns(xml: string): string {
  return [...xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "").matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((m) => xmlDecode(m[1])).join("");
}

function attr(tag: string, name: string): string | undefined {
  return tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
}

function colIndex(ref: string): number {
  let n = 0;
  for (const ch of ref.replace(/[^A-Za-z]/g, "").toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64;
  return n - 1;
}

async function readXlsx(bytes: Uint8Array): Promise<string[][]> {
  let entries: Map<string, ZipEntry>;
  try {
    entries = readZip(bytes);
  } catch (e) {
    if (e instanceof RosterError) throw e;
    throw new RosterError("Excel ファイルとして読めません");
  }
  if (!entries.has("xl/workbook.xml")) throw new RosterError("Excel ファイル（.xlsx）ではないようです");

  // 先頭のシートのパスを workbook.xml → rels から引く
  let sheetPath = "xl/worksheets/sheet1.xml";
  const wb = (await unzipText(entries, "xl/workbook.xml")) ?? "";
  const rid = attr(wb.match(/<sheet\b[^>]*>/)?.[0] ?? "", "r:id");
  const rels = (await unzipText(entries, "xl/_rels/workbook.xml.rels")) ?? "";
  for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    if (rid && attr(m[0], "Id") === rid) {
      const t = attr(m[0], "Target") ?? "";
      sheetPath = t.startsWith("/") ? t.slice(1) : `xl/${t}`;
    }
  }
  const sheet = await unzipText(entries, sheetPath);
  if (sheet === null) throw new RosterError("シートが見つかりません");

  const shared: string[] = [];
  const sst = await unzipText(entries, "xl/sharedStrings.xml");
  if (sst) for (const m of sst.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) shared.push(textRuns(m[1]));

  const rows: string[][] = [];
  for (const rm of sheet.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const row: string[] = [];
    for (const cm of rm[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const body = cm[2] ?? "";
      const ref = attr(cm[1], "r");
      const type = attr(cm[1], "t");
      const v = body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1];
      let value = "";
      if (type === "s") value = shared[Number(v)] ?? "";
      else if (type === "inlineStr") value = textRuns(body.match(/<is\b[^>]*>([\s\S]*?)<\/is>/)?.[1] ?? "");
      else if (v !== undefined) value = xmlDecode(v);
      if (ref) row[colIndex(ref)] = value;
      else row.push(value);
    }
    // 空の行は XML に出てこないことがある。行番号（r）どおりの位置に置いて、Excel の行番号と合わせる
    const no = Number(attr(rm[1], "r")) || rows.length + 1;
    while (rows.length < no - 1) rows.push([]);
    rows[no - 1] = Array.from(row, (c) => c ?? "");
    if (rows.length > MAX_ROWS + 200) break;
  }
  return rows;
}

/* ── 列の推測 ─────────────────────────────────────────── */

export const FIELDS = ["id", "nameJp", "surname", "given", "nameEn", "role", "email", "githubId", "xId", "skills", "card"] as const;
export type RosterField = (typeof FIELDS)[number];
export type Mapping = Record<RosterField, number>;

export const FIELD_LABELS: Record<RosterField, string> = {
  id: "ID",
  nameJp: "氏名（和文）",
  surname: "姓",
  given: "名",
  nameEn: "氏名（英文・ローマ字）",
  role: "役職",
  email: "メール",
  githubId: "GitHub",
  xId: "X",
  skills: "スキル",
  card: "名刺希望",
};

const norm = (s: string) => s.normalize("NFKC").toLowerCase().replace(/[\s_\-・*＊（）()\[\]【】:：]/g, "");

/** 見出しの言葉から、どの列が何かを推測する（見つからない項目は -1） */
export function detectColumns(headers: string[]): Mapping {
  const h = headers.map(norm);
  const used = new Set<number>();
  const m = Object.fromEntries(FIELDS.map((f) => [f, -1])) as Mapping;
  const find = (field: RosterField, test: (s: string) => boolean) => {
    if (m[field] >= 0) return;
    const i = h.findIndex((s, k) => !used.has(k) && s !== "" && test(s));
    if (i >= 0) {
      m[field] = i;
      used.add(i);
    }
  };
  find("id", (s) => s === "id" || s === "メンバーid" || /学籍番号|学生番号|学籍|studentid/.test(s));
  find("email", (s) => /メール|mail/.test(s));
  find("githubId", (s) => /github/.test(s));
  find("xId", (s) => s === "x" || /^(x|twitter|ツイッター)(id|アカウント)?$/.test(s) || /twitter/.test(s));
  find("skills", (s) => /スキル|得意|skill/.test(s));
  find("card", (s) => /名刺/.test(s));
  find("role", (s) => /役職|肩書|役割|position|^role$/.test(s));
  find("nameEn", (s) => /ローマ字|roman|english|英語|英名|英字|nameen|enname|\ben\b/.test(s) || /(氏名|名前|name)en$/.test(s));
  find("nameJp", (s) => /氏名|名前|漢字|日本語|^name$|fullname/.test(s));
  if (m.nameJp < 0) {
    find("surname", (s) => s === "姓" || s === "苗字" || s === "名字" || s === "lastname" || s === "familyname");
    find("given", (s) => s === "名" || s === "firstname" || s === "givenname");
  }
  return m;
}

/**
 * 見出しの行（0 始まり）を探す。申請書のように上にタイトルや宛名がある名簿でも、最初の 40 行のうち
 * 「氏名」「学籍番号」「役職」など見出しらしい言葉がいちばん多い行を見出しとみなす（同点は上の行）。見つからなければ 0
 */
export function findHeaderRow(table: string[][]): number {
  let best = 0;
  let bestScore = 0;
  table.slice(0, 40).forEach((row, i) => {
    const m = detectColumns(row.map((c) => String(c ?? "")));
    const hasWho = m.nameJp >= 0 || m.surname >= 0 || m.id >= 0 || m.email >= 0;
    const score = FIELDS.filter((f) => m[f] >= 0).length;
    if (hasWho && score >= 2 && score > bestScore) {
      best = i;
      bestScore = score;
    }
  });
  return best;
}

/* ── 行 → メンバー ────────────────────────────────────── */

/** メールのこのドメインのときだけ、@ より前を ID にする */
export const ID_EMAIL_DOMAIN = "andrew.ac.jp";

export interface RosterRow {
  /** 名簿の行番号（Excel の行。見出しが 1 行目） */
  line: number;
  id: string;
  nameJp: string;
  nameEn: string;
  /** 登録済みの肩書き（なければ ""） */
  role: string;
  /** 名簿に書かれていた役職（複数なら「・」でつないだもの。登録済みでない場合の確認用） */
  roleRaw: string;
  /** 役職が複数書かれていたときの、名刺に使わなかった分（例: 副部長・会計 → 「会計」） */
  roleExtra: string;
  email: string;
  githubId: string;
  xId: string;
  skills: string[];
  card: boolean;
  problems: string[];
}

const CARD_YES = ["○", "〇", "◯", "✓", "✔", "☑", "はい", "yes", "y", "true", "1", "希望", "希望する", "あり", "要", "必要", "済"];

const clean = (s: string | undefined) => (s ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();
/** 日本語の氏名は全角のスペースや詰め書きをそろえる */
const cleanName = (s: string | undefined) => (s ?? "").replace(/[\s　]+/g, " ").trim();

export function buildRows(table: string[][], map: Mapping, roles: Role[], headerRow = 0): RosterRow[] {
  const cell = (r: string[], f: RosterField) => (map[f] >= 0 ? (r[map[f]] ?? "") : "");
  const roleByNorm = new Map(roles.map((r) => [clean(r.jp), r.jp]));
  const out: RosterRow[] = [];

  table.slice(headerRow + 1, headerRow + 1 + MAX_ROWS).forEach((r, k) => {
    const problems: string[] = [];
    const email = clean(cell(r, "email")).replace(/^mailto:/i, "");
    let nameJp = cleanName(cell(r, "nameJp"));
    if (!nameJp && (map.surname >= 0 || map.given >= 0)) nameJp = cleanName(`${cell(r, "surname")} ${cell(r, "given")}`);

    let id = clean(cell(r, "id"));
    if (!id && email.toLowerCase().endsWith(`@${ID_EMAIL_DOMAIN}`)) id = email.slice(0, email.lastIndexOf("@"));
    id = id.toLowerCase();
    if (!id) problems.push("ID を決められません（名簿に ID 列がなく、メールも @" + ID_EMAIL_DOMAIN + " ではありません）。下で入力してください");
    else if (!ID_PATTERN.test(id)) problems.push("ID に使えない文字が含まれています");

    // 役職は 1 つのセルに複数（改行・「、」「・」区切り）書かれていることがある。名刺には、登録済みの先頭の 1 つを使う
    const tokens = cell(r, "role")
      .split(/[\n\r、,，・／/;；]+/)
      .map(clean)
      .filter((t) => t && !PLAIN_ROLES.includes(t));
    const found = tokens.map((t) => roleByNorm.get(t)).find((x): x is string => !!x) ?? "";
    const roleRaw = tokens.join("・");
    const roleExtra = found ? tokens.filter((t) => roleByNorm.get(t) !== found).join("・") : "";
    if (tokens.length && !found) problems.push(`未登録の役職「${roleRaw}」です。下で選ぶか、「肩書き」タブで追加してください`);
    const role = found;

    out.push({
      line: headerRow + k + 2,
      id,
      nameJp,
      nameEn: clean(cell(r, "nameEn")),
      role,
      roleRaw,
      roleExtra,
      email,
      githubId: normalizeHandle(clean(cell(r, "githubId")), ["github.com"]),
      xId: normalizeHandle(clean(cell(r, "xId")), ["x.com", "twitter.com"]),
      skills: clean(cell(r, "skills")).split(/[,、，/／・\n;；]/).map((t) => t.trim()).filter(Boolean),
      card: CARD_YES.includes(clean(cell(r, "card")).toLowerCase()),
      problems,
    });
  });
  return out.filter((row) => row.id || row.nameJp || row.email);
}

/** 同じ名簿の中で ID が重なっている行に注意を付ける */
export function markDuplicates(rows: RosterRow[]): void {
  const seen = new Map<string, number>();
  for (const r of rows) if (r.id) seen.set(r.id, (seen.get(r.id) ?? 0) + 1);
  for (const r of rows) if (r.id && (seen.get(r.id) ?? 0) > 1) r.problems.push("名簿の中で ID が重なっています。下で別の ID にしてください");
}
