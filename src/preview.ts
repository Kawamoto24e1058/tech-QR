/**
 * プレビュー用の HTML ページ生成。
 * - GET /preview       -> メンバー一覧
 * - GET /preview/:id   -> 表裏の名刺を画面に表示し、そこから SVG をダウンロード
 *
 * 名刺 SVG はダウンロード用の /generate エンドポイントと同じものを、
 * ここでは inline で埋め込んで表示する。
 */
import { buildBackCard, buildFrontCard, escapeXml, type CardFields } from "./card-template";
import { DEFAULT_LAYOUT, type CardLayout } from "./layout";

const esc = escapeXml;

export interface MemberSummary {
  id: string;
  name: string;
  active: boolean;
}

const BASE_CSS = `
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 32px 20px 64px;
    background: #0a0a0c; color: #e7e7ea;
    font-family: "Inter", -apple-system, "Hiragino Kaku Gothic ProN", "Yu Gothic", system-ui, sans-serif;
    line-height: 1.6;
  }
  a { color: inherit; }
  .wrap { max-width: 760px; margin: 0 auto; }
  h1 { font-size: 20px; font-weight: 700; letter-spacing: 1px; margin: 0 0 4px; }
  .muted { color: #8a8f98; font-size: 13px; }
  code { font-family: "Courier New", monospace; background: #18181b; padding: 2px 6px; border-radius: 4px; font-size: 12px; word-break: break-all; }
  .backlink { display: inline-block; margin-bottom: 20px; font-size: 13px; color: #8a8f98; text-decoration: none; }
  .backlink:hover { color: #e7e7ea; }
`;

const PREVIEW_CSS = `${BASE_CSS}
  header { border-bottom: 1px solid #27272a; padding-bottom: 16px; margin-bottom: 28px; }
  header .id { color: #52525b; font-weight: 400; font-size: 14px; margin-left: 8px; }
  section { margin: 0 0 40px; }
  .label { font-family: "Courier New", monospace; font-size: 11px; letter-spacing: 3px; color: #52525b; margin-bottom: 10px; }
  .card {
    background: #0a0a0c; border: 1px solid #27272a; border-radius: 8px;
    overflow: hidden; max-width: 620px;
  }
  .card svg { display: block; width: 100%; height: auto; }
  .dl {
    display: inline-flex; align-items: center; gap: 8px;
    margin-top: 14px; padding: 10px 18px;
    background: #ffffff; color: #0a0a0c; text-decoration: none;
    border-radius: 6px; font-size: 13px; font-weight: 600;
  }
  .dl:hover { background: #d4d4d8; }
  .row { display: flex; gap: 12px; flex-wrap: wrap; }
`;

const INDEX_CSS = `${BASE_CSS}
  h1 { margin-bottom: 20px; }
  ul { list-style: none; margin: 0; padding: 0; }
  li a {
    display: flex; align-items: center; gap: 12px;
    padding: 14px 16px; border: 1px solid #27272a; border-radius: 8px;
    margin-bottom: 8px; text-decoration: none; transition: border-color .15s, background .15s;
  }
  li a:hover { border-color: #52525b; background: #131316; }
  .name { font-weight: 600; }
  .idtag { font-family: "Courier New", monospace; font-size: 12px; color: #8a8f98; }
  .spacer { flex: 1; }
  .badge { font-size: 11px; padding: 3px 8px; border-radius: 999px; font-family: "Courier New", monospace; }
  .badge.on { background: #052e1a; color: #4ade80; }
  .badge.off { background: #2a2a2e; color: #8a8f98; }
  .empty { color: #8a8f98; padding: 40px 0; text-align: center; }
`;

/** GET /preview/:id */
export function buildCardPreview(
  id: string,
  f: CardFields,
  baseUrl: string,
  layout: CardLayout = DEFAULT_LAYOUT,
): string {
  const qrUrl = `${baseUrl}/p/${id}`;
  const front = buildFrontCard(f, layout);
  const back = buildBackCard(f, qrUrl, layout);
  const title = f.nameJp || f.nameEn || id;

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — 名刺プレビュー</title>
<style>${PREVIEW_CSS}</style>
</head>
<body>
<div class="wrap">
  <a class="backlink" href="/preview">← メンバー一覧</a>
  <header>
    <h1>${esc(title)}<span class="id">${esc(id)}</span></h1>
    <p class="muted">QR 転送先: <code>${esc(qrUrl)}</code></p>
  </header>

  <section>
    <div class="label">表面 / FRONT</div>
    <div class="card">${front}</div>
    <div class="row"><a class="dl" href="/generate/${esc(id)}" download>↓ 表面 SVG をダウンロード</a></div>
  </section>

  <section>
    <div class="label">裏面 / BACK</div>
    <div class="card">${back}</div>
    <div class="row"><a class="dl" href="/generate/${esc(id)}/back" download>↓ 裏面 SVG をダウンロード</a></div>
  </section>

  <p class="muted">入稿前に Illustrator 等でテキストをアウトライン化してください。</p>
</div>
</body>
</html>`;
}

/** GET /preview */
export function buildIndexPage(members: MemberSummary[]): string {
  const items = members
    .map(
      (m) => `<li><a href="/preview/${esc(m.id)}">
    <span class="name">${esc(m.name || "（名前未設定）")}</span>
    <span class="idtag">${esc(m.id)}</span>
    <span class="spacer"></span>
    <span class="badge ${m.active ? "on" : "off"}">${m.active ? "Active" : "停止中"}</span>
  </a></li>`,
    )
    .join("\n  ");

  const body = members.length
    ? `<ul>\n  ${items}\n</ul>`
    : `<p class="empty">メンバーがまだ登録されていません。Notion の Database に行を追加してください。</p>`;

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>名刺プレビュー — テック部</title>
<style>${INDEX_CSS}</style>
</head>
<body>
<div class="wrap">
  <h1>名刺プレビュー</h1>
  <p class="muted">名前をクリックすると表裏の名刺を確認・ダウンロードできます（${members.length} 名）。 <a href="/editor">レイアウトを編集 →</a></p>
  ${body}
</div>
</body>
</html>`;
}
