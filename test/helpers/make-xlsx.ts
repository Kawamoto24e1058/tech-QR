/**
 * テスト用: 最小の .xlsx（ZIP・無圧縮 + 必要な XML だけ）を作る。
 * rows は「行 × 列」の文字列（数値にしたいセルは number で渡す）。deflate は src/roster.ts の展開経路を通すため useDeflate で選べる
 */
const te = new TextEncoder();

function crc32(data: Uint8Array): number {
  let c = ~0;
  for (const b of data) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

async function deflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const s = new Blob([data]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(s).arrayBuffer());
}

export async function makeZip(files: Record<string, string>, useDeflate = false): Promise<Uint8Array> {
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const raw = te.encode(text);
    const data = useDeflate ? await deflateRaw(raw) : raw;
    const nameB = te.encode(name);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true);
    lh.setUint16(4, 20, true);
    lh.setUint16(8, useDeflate ? 8 : 0, true);
    lh.setUint32(14, crc32(raw), true);
    lh.setUint32(18, data.length, true);
    lh.setUint32(22, raw.length, true);
    lh.setUint16(26, nameB.length, true);
    const local = new Uint8Array(30 + nameB.length + data.length);
    local.set(new Uint8Array(lh.buffer), 0);
    local.set(nameB, 30);
    local.set(data, 30 + nameB.length);
    parts.push(local);

    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true);
    ch.setUint16(4, 20, true);
    ch.setUint16(6, 20, true);
    ch.setUint16(10, useDeflate ? 8 : 0, true);
    ch.setUint32(16, crc32(raw), true);
    ch.setUint32(20, data.length, true);
    ch.setUint32(24, raw.length, true);
    ch.setUint16(28, nameB.length, true);
    ch.setUint32(42, offset, true);
    const c = new Uint8Array(46 + nameB.length);
    c.set(new Uint8Array(ch.buffer), 0);
    c.set(nameB, 46);
    central.push(c);
    offset += local.length;
  }
  const cdSize = central.reduce((n, c) => n + c.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, central.length, true);
  end.setUint16(10, central.length, true);
  end.setUint32(12, cdSize, true);
  end.setUint32(16, offset, true);
  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((n, a) => n + a.length, 0));
  let o = 0;
  for (const a of all) {
    out.set(a, o);
    o += a.length;
  }
  return out;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const colName = (i: number) => String.fromCharCode(65 + i);

/** rows[0] が見出し。文字列は共有文字列に、number は数値セルにする */
export async function makeXlsx(rows: Array<Array<string | number>>, useDeflate = false): Promise<Uint8Array> {
  const shared: string[] = [];
  const sheetRows = rows
    .map((row, r) => {
      const cells = row
        .map((v, c) => {
          const ref = `${colName(c)}${r + 1}`;
          if (typeof v === "number") return `<c r="${ref}"><v>${v}</v></c>`;
          if (v === "") return "";
          let i = shared.indexOf(v);
          if (i < 0) i = shared.push(v) - 1;
          return `<c r="${ref}" t="s"><v>${i}</v></c>`;
        })
        .join("");
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join("");
  return makeZip(
    {
      "[Content_Types].xml": `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>`,
      "xl/workbook.xml": `<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="名簿" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      "xl/_rels/workbook.xml.rels": `<Relationships><Relationship Id="rId1" Type="x" Target="worksheets/sheet1.xml"/></Relationships>`,
      "xl/sharedStrings.xml": `<sst>${shared.map((s) => `<si><t>${esc(s)}</t></si>`).join("")}</sst>`,
      "xl/worksheets/sheet1.xml": `<worksheet><sheetData>${sheetRows}</sheetData></worksheet>`,
    },
    useDeflate,
  );
}
