/**
 * プレビュー用の HTML ページ生成。
 * - GET /preview       -> メンバー一覧
 * - GET /preview/:id   -> 表裏の名刺を画面に表示し、そこから SVG をダウンロード
 *
 * 名刺 SVG はダウンロード用の /generate エンドポイントと同じものを、
 * ここでは inline で埋め込んで表示する。
 */
import { escapeXml } from "./card-template";
import type { Member, MemberSummary } from "./notion";

const esc = escapeXml;

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
  .row { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
  .alt { color: #8a8f98; font-size: 13px; text-decoration: underline; }
  .failed { padding: 48px 20px; text-align: center; color: #fca5a5; font-size: 14px; }
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
  h2.sub { font-size: 14px; margin: 36px 0 12px; color: #a1a1aa; font-weight: 600; }
  h2.sub small { font-weight: 400; color: #71717a; margin-left: 8px; font-size: 12px; }
`;

/** GET /preview/:id。cards は描画済み SVG（フォント取得に失敗した面は null） */
export function buildCardPreview(
  m: Member,
  baseUrl: string,
  cards: { front: string | null; back: string | null },
): string {
  const id = m.id;
  const f = m.fields;
  const qrUrl = `${baseUrl}/p/${id}`;
  const failed = `<div class="failed">名刺を描画できませんでした（フォントの取得に失敗）。<a href="">再読み込み</a>してください。</div>`;
  const front = cards.front ?? failed;
  const back = cards.back ?? failed;
  const title = f.nameJp || f.nameEn || id;
  const dest = m.targetUrl
    ? `転送: <code>${esc(m.targetUrl)}</code>`
    : `<a href="/profile/${esc(id)}">プロフィールページ</a>`;

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
    <p class="muted">QR: <code>${esc(qrUrl)}</code> → ${dest}${m.active ? "" : "（Active が OFF のため 404）"}</p>
  </header>

  <section>
    <div class="label">表面 / FRONT</div>
    <div class="card">${front}</div>
    <div class="row"><a class="dl" href="/generate/${esc(id)}" download>↓ 表面 SVG をダウンロード</a><a class="alt" href="/generate/${esc(id)}?bleed=0" download>塗り足しなし</a></div>
  </section>

  <section>
    <div class="label">裏面 / BACK</div>
    <div class="card">${back}</div>
    <div class="row"><a class="dl" href="/generate/${esc(id)}/back" download>↓ 裏面 SVG をダウンロード</a><a class="alt" href="/generate/${esc(id)}/back?bleed=0" download>塗り足しなし</a></div>
  </section>

  <p class="muted">入稿用 SVG は<b>文字をアウトライン化済み</b>で、<b>塗り足し 3mm 付き（97×61mm）</b>です。画面の表示は仕上がりサイズ（91×55mm）。塗り足しなしが必要な場合は右の「塗り足しなし」を使ってください。</p>
</div>
</body>
</html>`;
}

/** GET /preview。名刺を作る人（役職がある人 + 名刺希望の人）を上に、それ以外を「名刺なし」として下にまとめる */
export function buildIndexPage(members: MemberSummary[]): string {
  const item = (m: MemberSummary) => `<li><a href="/preview/${esc(m.id)}">
    <span class="name">${esc(m.name || "（名前未設定）")}</span>
    <span class="idtag">${esc(m.id)}</span>
    <span class="spacer"></span>
    <span class="badge ${m.active ? "on" : "off"}">${m.active ? "Active" : "停止中"}</span>
  </a></li>`;
  const list = (ms: MemberSummary[]) => `<ul>\n  ${ms.map(item).join("\n  ")}\n</ul>`;

  const withCard = members.filter((m) => m.card);
  const without = members.filter((m) => !m.card);

  const body = members.length
    ? (withCard.length ? list(withCard) : `<p class="empty">名刺を作る人がまだいません。役職を設定するか、管理画面で「名刺を作る」にチェックを入れてください。</p>`) +
      (without.length
        ? `<h2 class="sub">名刺なし（${without.length} 名）<small>役職がなく、名刺を希望していない人</small></h2>\n${list(without)}`
        : "")
    : `<p class="empty">メンバーがまだ登録されていません。管理画面から追加するか、名簿（Excel）を取り込んでください。</p>`;

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
  <p class="muted">名前をクリックすると表裏の名刺を確認・ダウンロードできます（名刺を作る人 ${withCard.length} 名）。 <a href="/admin">メンバーの編集・名簿の取り込みは管理画面 →</a></p>
  ${body}
</div>
</body>
</html>`;
}
