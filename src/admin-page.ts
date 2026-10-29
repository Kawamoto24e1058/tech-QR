/**
 * 管理画面 /admin の HTML（ログイン画面 / 本体）。
 * 本体は 1 枚の SPA。API は src/admin.ts。クライアント JS はテンプレートリテラル内なので
 * バッククォートと dollar-brace は使わないこと。
 *
 * 見やすさの方針: 文字は大きめ・コントラスト高め / 入力しながら名刺プレビューが更新される /
 * 保存前にその場で入力チェック / 一覧は絞り込み・肩書き・未保存が分かる。
 */
import { escapeXml } from "./card-template";

const CSS = `
:root{--bg:#0a0a0c;--panel:#121216;--panel2:#18181e;--line:#2a2a31;--line2:#383841;
  --tx:#f2f2f5;--mut:#bcbcc7;--dim:#8f8f9b;--acc:#6bb2ff;--acc2:rgba(107,178,255,.16);
  --ok:#4ade80;--err:#ff7b7b;--warn:#fbbf24;color-scheme:dark}
*{box-sizing:border-box}
html,body{height:100%;margin:0}
body{background:var(--bg);color:var(--tx);font:15px/1.65 "Inter",-apple-system,"Hiragino Kaku Gothic ProN","Yu Gothic",system-ui,sans-serif;
  -webkit-font-smoothing:antialiased;display:flex;flex-direction:column}
button,input,select,textarea{font:inherit;color:inherit}
button{cursor:pointer}
a{color:var(--acc);text-decoration:none}
a:hover{text-decoration:underline}
:focus-visible{outline:2px solid var(--acc);outline-offset:2px}

/* ── top ── */
.bar{flex:none;height:56px;display:flex;align-items:center;gap:16px;padding:0 20px;border-bottom:1px solid var(--line);background:var(--panel)}
.bar h1{margin:0;font-size:15px;font-weight:800;letter-spacing:.04em}
.tabs{display:flex;gap:3px;background:var(--panel2);border:1px solid var(--line);border-radius:11px;padding:3px}
.tabs button{border:0;background:transparent;color:var(--mut);padding:6px 20px;border-radius:8px;font-size:14px;font-weight:600}
.tabs button:hover{color:var(--tx)}
.tabs button.on{background:#30303a;color:var(--tx)}
.sp{flex:1}
.bar a,.linkbtn{font-size:13.5px;color:var(--mut)}
.bar a:hover,.linkbtn:hover{color:var(--tx);text-decoration:none}
.linkbtn{background:none;border:0;padding:6px 8px}

/* ── controls ── */
.btn{background:var(--panel2);border:1px solid var(--line2);border-radius:10px;padding:10px 18px;font-size:14px;font-weight:600;white-space:nowrap}
.btn:hover:not(:disabled){border-color:var(--dim)}
.btn:disabled{opacity:.45;cursor:default}
.btn.primary{background:#f4f4f5;color:#0a0a0c;border-color:#f4f4f5}
.btn.primary:hover:not(:disabled){background:#fff}
.btn.primary:disabled{background:#2a2a31;color:var(--dim);border-color:#2a2a31;opacity:1}
.btn.danger{color:var(--err);border-color:#552828;background:transparent}
.btn.danger:hover:not(:disabled){background:#2a1515;border-color:var(--err)}
.btn.sm{padding:6px 12px;font-size:13px;border-radius:8px}
.in{width:100%;background:var(--panel2);border:1px solid var(--line2);border-radius:10px;padding:11px 13px;font-size:15px;outline:none;min-height:46px}
.in::placeholder{color:#6f6f7b}
.in:focus{border-color:var(--acc);box-shadow:0 0 0 3px var(--acc2)}
.in.err{border-color:var(--err);box-shadow:0 0 0 3px rgba(255,123,123,.16)}
.in.okk{border-color:#2f7d4b}
.in[readonly]{color:var(--dim);background:#0e0e12;cursor:not-allowed}
select.in{appearance:none;background-image:linear-gradient(45deg,transparent 50%,var(--mut) 50%),linear-gradient(135deg,var(--mut) 50%,transparent 50%);
  background-position:calc(100% - 20px) 50%,calc(100% - 15px) 50%;background-size:5px 5px;background-repeat:no-repeat;padding-right:38px}

/* ── members: list | form (+ preview) ── */
.main{flex:1;min-height:0}
.mview{height:100%;display:grid;grid-template-columns:340px 1fr}
.list{border-right:1px solid var(--line);background:var(--panel);display:flex;flex-direction:column;min-height:0}
.list .tools{display:flex;gap:10px;padding:14px 14px 10px}
.list .tools .btn{flex:none}
.filters{display:flex;gap:6px;padding:0 14px 12px;flex-wrap:wrap;border-bottom:1px solid var(--line)}
.fchip{border:1px solid var(--line2);background:transparent;color:var(--mut);padding:4px 12px;border-radius:99px;font-size:13px;font-weight:600}
.fchip:hover{color:var(--tx)}
.fchip.on{background:var(--tx);color:#0a0a0c;border-color:var(--tx)}
.fchip small{opacity:.65;margin-left:4px;font-weight:500}
.list ul{list-style:none;margin:0;padding:8px;overflow:auto;flex:1}
.item{display:flex;align-items:center;gap:13px;padding:11px 12px;border-radius:12px;cursor:pointer;border:1px solid transparent;margin-bottom:2px}
.item:hover{background:var(--panel2)}
.item.on{background:var(--acc2);border-color:rgba(107,178,255,.45)}
.av{width:42px;height:42px;border-radius:50%;background:#22222a;border:1px solid var(--line2);display:grid;place-items:center;font-weight:700;font-size:16px;flex:none}
.item.off .av{opacity:.5}
.item .txt{min-width:0;flex:1}
.item .nm{font-weight:700;font-size:15px;line-height:1.35;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.item .sub{font-size:12.5px;color:var(--dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.item .sub code{font-family:"Courier New",monospace}
.item .meta{display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex:none}
.tag{font-size:12px;padding:1px 9px;border-radius:99px;border:1px solid var(--line2);color:var(--mut);white-space:nowrap;line-height:1.6}
.tag.on{color:var(--ok);border-color:#256b40;background:#0e2216}
.tag.off{color:var(--dim)}
.tag.fwd{color:var(--warn);border-color:#6a5314}
.dot{width:8px;height:8px;border-radius:50%;background:var(--warn);flex:none}
.empty{color:var(--mut);padding:44px 24px;text-align:center;line-height:1.8}

.formwrap{overflow:auto;min-height:0}
.form{max-width:1120px;margin:0 auto;padding:28px 32px 130px}
.fhead{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:6px}
.fhead h2{margin:0;font-size:26px;font-weight:800;line-height:1.3}
.fhead .back{display:none}
.links{display:flex;gap:10px;flex-wrap:wrap;margin:10px 0 24px}
.links a{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line2);border-radius:9px;padding:6px 14px;font-size:13.5px;color:var(--tx);font-weight:600}
.links a:hover{background:var(--panel2);text-decoration:none;border-color:var(--dim)}
.fgrid{display:grid;grid-template-columns:minmax(0,1fr) 400px;gap:28px;align-items:start}
.sec{border:1px solid var(--line);background:var(--panel);border-radius:16px;padding:22px 22px 8px;margin-bottom:18px}
.sec>h3{margin:0 0 18px;font-size:16px;font-weight:800;display:flex;align-items:center;gap:10px}
.sec>h3 small{font-size:12.5px;font-weight:500;color:var(--dim)}
.fld{margin-bottom:20px}
.fld>label{display:block;font-size:14px;color:var(--mut);margin-bottom:7px;font-weight:600}
.fld>label .req{color:var(--warn);font-size:12px;margin-left:6px;font-weight:600}
.hint{font-size:13px;color:var(--dim);margin-top:7px;line-height:1.6}
.errmsg{font-size:13px;color:var(--err);margin-top:7px;font-weight:600;min-height:0}
.errmsg:empty{display:none}
.two{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.pre{display:flex;align-items:stretch}
.pre>span{display:grid;place-items:center;padding:0 12px;background:#0e0e12;border:1px solid var(--line2);border-right:0;border-radius:10px 0 0 10px;color:var(--dim);font:13.5px "Courier New",monospace;white-space:nowrap}
.pre>.in{border-radius:0 10px 10px 0}
.sw,.fld>label.sw{display:flex;align-items:center;gap:14px;cursor:pointer;user-select:none;margin:0;font-size:15px;color:var(--tx)}
.sw input{display:none}
.sw .knob{width:48px;height:28px;border-radius:99px;background:#34343e;position:relative;transition:.15s;flex:none}
.sw .knob::after{content:"";position:absolute;left:3px;top:3px;width:22px;height:22px;border-radius:50%;background:#fff;transition:.15s}
.sw input:checked+.knob{background:#22c55e}
.sw input:checked+.knob::after{left:23px}
.sw b{font-weight:700;display:block}
.sw small{display:block;color:var(--dim);font-size:13px;font-weight:400}
.en{display:inline-block;margin-top:9px;font:13.5px "Courier New",monospace;color:var(--mut);background:#0e0e12;border:1px solid var(--line2);padding:3px 12px;border-radius:8px}
.chips{display:flex;flex-wrap:wrap;gap:8px;padding:8px;background:var(--panel2);border:1px solid var(--line2);border-radius:10px;cursor:text;min-height:50px}
.chips:focus-within{border-color:var(--acc);box-shadow:0 0 0 3px var(--acc2)}
.chips.err{border-color:var(--err)}
.chip{display:inline-flex;align-items:center;gap:6px;background:#24242c;border-left:3px solid rgba(255,255,255,.65);border-radius:5px;padding:4px 7px 4px 11px;font:13.5px "Courier New",monospace}
.chip.dim{opacity:.55}
.chip button{border:0;background:none;color:var(--dim);padding:0 4px;font-size:16px;line-height:1}
.chip button:hover{color:var(--err)}
.chips input{flex:1;min-width:140px;background:none;border:0;outline:none;padding:6px 6px;font-size:15px}
.seg2{display:flex;background:var(--panel2);border:1px solid var(--line2);border-radius:12px;padding:4px;gap:4px}
.seg2 button{flex:1;border:0;background:transparent;color:var(--mut);padding:10px 12px;border-radius:9px;font-size:14px;font-weight:700}
.seg2 button:hover{color:var(--tx)}
.seg2 button.on{background:#34343e;color:var(--tx)}

/* preview */
.pv{position:sticky;top:24px}
.pvbox{border:1px solid var(--line);background:var(--panel);border-radius:16px;overflow:hidden}
.pvh{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px;border-bottom:1px solid var(--line)}
.pvh b{font-size:15px}
.seg3{display:flex;background:var(--panel2);border:1px solid var(--line2);border-radius:9px;padding:3px;gap:3px}
.seg3 button{border:0;background:transparent;color:var(--mut);padding:4px 14px;border-radius:6px;font-size:13px;font-weight:700}
.seg3 button.on{background:#34343e;color:var(--tx)}
.pvc{padding:16px;background:#0a0a0c;min-height:150px}
.pvc svg{display:block;width:100%;height:auto;border-radius:4px;box-shadow:0 14px 40px rgba(0,0,0,.55),0 0 0 1px #2a2a31}
.pvn{padding:12px 16px 14px;font-size:13px;color:var(--dim);border-top:1px solid var(--line);line-height:1.6}
.dest{margin-top:14px;border:1px solid var(--line);background:var(--panel);border-radius:16px;padding:16px}
.dest h4{margin:0 0 6px;font-size:14px}
.dest p{margin:0;font-size:14px;color:var(--mut);line-height:1.7;word-break:break-all}
.dest .urlrow{display:flex;gap:8px;align-items:center;margin-top:12px;padding:9px 12px;background:#0e0e12;border:1px solid var(--line);border-radius:10px;font:13px "Courier New",monospace;color:var(--mut);word-break:break-all}
.dest .urlrow span{flex:1}
.pvtoggle{display:none}

.actions{position:fixed;left:340px;right:0;bottom:0;display:flex;gap:12px;align-items:center;padding:14px 32px;background:rgba(10,10,12,.92);backdrop-filter:blur(10px);border-top:1px solid var(--line);z-index:5}
.actions .inner{max-width:1056px;margin:0 auto;width:100%;display:flex;gap:12px;align-items:center}
.actions .sp{flex:1}
.dirty-note{font-size:14px;color:var(--warn);font-weight:600}
.saved-note{font-size:14px;color:var(--ok);font-weight:600}

/* roles */
.rview{max-width:820px;margin:0 auto;padding:30px 32px 130px}
.rview h2{margin:0 0 6px;font-size:26px;font-weight:800}
.rview .lead{color:var(--mut);font-size:14.5px;margin:0 0 22px;line-height:1.8}
.rrow{display:grid;grid-template-columns:auto 1fr 1fr 64px auto;gap:12px;align-items:center;margin-bottom:12px}
.rrow .mv{display:flex;flex-direction:column;gap:3px}
.rrow .mv button{border:1px solid var(--line2);background:var(--panel2);color:var(--mut);width:30px;height:21px;border-radius:6px;font-size:10px;line-height:1;padding:0}
.rrow .mv button:hover:not(:disabled){color:var(--tx);border-color:var(--dim)}
.rrow .mv button:disabled{opacity:.25;cursor:default}
.rrow .use{font-size:13.5px;color:var(--dim);white-space:nowrap;text-align:right}
.rhead{display:grid;grid-template-columns:36px 1fr 1fr 64px 80px;gap:12px;font-size:12.5px;color:var(--dim);font-weight:600;margin:0 0 8px}
.note{padding:13px 16px;border-radius:12px;font-size:14px;margin:16px 0;background:#201b0d;border:1px solid #5a4813;color:#f0dea0;line-height:1.7}
.note.info{background:var(--panel);border-color:var(--line);color:var(--mut)}
.rview .actions{left:0}

/* import */
.iview{max-width:1080px;margin:0 auto;padding:30px 32px 140px}
.iview h2{margin:0 0 6px;font-size:26px;font-weight:800}
.iview .lead{color:var(--mut);font-size:14.5px;margin:0 0 22px;line-height:1.8}
.iview .pick{display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin-bottom:22px}
.iview .pick input[type=file]{display:none}
.iview .fname{color:var(--mut);font-size:14px}
.iview details{border:1px solid var(--line);border-radius:12px;background:var(--panel);padding:12px 16px;margin:0 0 18px}
.iview summary{cursor:pointer;font-weight:700;font-size:14.5px}
.mapgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px 16px;margin-top:14px}
.mapgrid label{display:block;font-size:12.5px;color:var(--dim);font-weight:600;margin-bottom:4px}
.mapgrid select.in{min-height:40px;padding:7px 12px;font-size:14px}
.sumbar{display:flex;gap:10px;flex-wrap:wrap;margin:0 0 14px}
.sumbar .pill{border:1px solid var(--line2);border-radius:99px;padding:3px 13px;font-size:13.5px;color:var(--mut);font-weight:600}
.sumbar .pill b{color:var(--tx);margin-right:3px}
.sumbar .pill.warn{border-color:#5a4813;color:var(--warn)}
.tbl{width:100%;border-collapse:separate;border-spacing:0;border:1px solid var(--line);border-radius:12px;overflow:hidden;font-size:14px}
.tbl th{background:var(--panel2);color:var(--dim);font-size:12.5px;text-align:left;padding:9px 10px;font-weight:600;white-space:nowrap}
.tbl td{padding:9px 10px;border-top:1px solid var(--line);vertical-align:top;background:var(--panel)}
.tbl tr.skip td{opacity:.5}
.tbl .in{min-height:38px;padding:6px 10px;font-size:14px}
.tbl td.idc{min-width:150px}
.tbl td.rc{min-width:150px}
.tbl .st{font-size:13px;line-height:1.6}
.tbl .st .bad{color:var(--err)}
.tbl .st .tag{margin-right:4px}
.tbl .cap{font-size:12px;color:var(--dim)}
.iview .actions{left:0}
.res{border:1px solid var(--line);background:var(--panel);border-radius:12px;padding:16px 20px;margin:0 0 22px;line-height:1.9}
.res .bad{color:var(--err)}

/* card tab */
.cview{max-width:1180px;margin:0 auto;padding:30px 32px 140px}
.cview h2{margin:0 0 6px;font-size:26px;font-weight:800}
.cview .lead{color:var(--mut);font-size:14.5px;margin:0 0 22px;line-height:1.8}
.cgrid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.05fr);gap:28px;align-items:start}
.csec{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:20px 22px;margin-bottom:18px}
.csec h3{margin:0 0 12px;font-size:15px;font-weight:800}
.crow{display:flex;align-items:center;gap:12px;padding:8px 0;border-top:1px solid var(--line)}
.crow:first-of-type{border-top:0}
.crow .nm{flex:1;font-weight:600}
.crow .mvb{display:flex;gap:4px}
.crow .mvb button{border:1px solid var(--line2);background:var(--panel2);color:var(--mut);width:30px;height:28px;border-radius:7px;font-size:11px;padding:0}
.crow .mvb button:disabled{opacity:.25;cursor:default}
.crow.offr .nm{color:var(--dim)}
.cview .actions{left:0}
.exp .rowx{display:flex;align-items:center;gap:12px;padding:9px 4px;border-top:1px solid var(--line)}
.exp .rowx .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.exp .rowx code{font-family:"Courier New",monospace;color:var(--dim);font-size:12.5px;margin-left:8px}
.exp .rowx a{font-size:13px;margin-left:4px}
.exp .bar2{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:0 0 12px}
.exp .bar2 select.in{width:auto;min-height:40px;padding:6px 36px 6px 12px}
@media (max-width:1100px){.cgrid{grid-template-columns:1fr}}

/* misc */
dialog{background:var(--panel);color:var(--tx);border:1px solid var(--line2);border-radius:18px;padding:26px;max-width:460px;width:calc(100% - 32px);box-shadow:0 30px 80px rgba(0,0,0,.65)}
dialog::backdrop{background:rgba(0,0,0,.65)}
dialog p{margin:0 0 22px;line-height:1.8;font-size:15px}
dialog .row{display:flex;justify-content:flex-end;gap:10px}
.toast{position:fixed;left:50%;bottom:88px;transform:translate(-50%,12px);background:#23232b;border:1px solid var(--line2);border-radius:12px;padding:12px 20px;
  font-size:14.5px;font-weight:600;opacity:0;pointer-events:none;transition:.18s;box-shadow:0 12px 34px rgba(0,0,0,.5);z-index:50;max-width:calc(100% - 32px)}
.toast.show{opacity:1;transform:translate(-50%,0)}
.toast.ok{border-color:#256b40;color:#bdf7d2}
.toast.err{border-color:#8a3030;color:#ffd0d0}
.loading{padding:70px;text-align:center;color:var(--mut)}

@media (max-width:1180px){
  .fgrid{grid-template-columns:1fr}
  .pv{position:static;order:-1}
  .pvtoggle{display:flex;width:100%;justify-content:space-between;align-items:center;margin-bottom:12px}
  .pv:not(.open) .pvbox,.pv:not(.open) .dest{display:none}
}
@media (max-width:860px){
  body{font-size:16px}
  .mview{grid-template-columns:1fr}
  .mview.picked .list{display:none}
  .mview:not(.picked) .formwrap{display:none}
  .fhead .back{display:inline-block}
  .form{padding:20px 16px 130px}
  .actions{left:0;padding:10px 16px 12px}
  .actions .inner{flex-wrap:wrap;gap:10px}
  .dirty-note,.saved-note{order:-1;flex-basis:100%;font-size:13px}
  .two{grid-template-columns:1fr}
  .bar{gap:10px;padding:0 12px}.bar .jump{display:none}
  .rview{padding:22px 16px 130px}
  .rrow{grid-template-columns:auto 1fr auto}.rrow .en-in{grid-column:2/-1}.rhead{display:none}
  .toast{bottom:96px}
}
`;

function shell(title: string, body: string, bodyAttrs = ""): string {
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${escapeXml(title)}</title>
<style>${CSS}</style>
</head>
<body${bodyAttrs}>
${body}
</body>
</html>`;
}

/* ── 未設定 / ログイン ─────────────────────────────────── */

export function buildNoPasswordPage(): string {
  return shell(
    "管理画面（未設定）",
    `<div style="margin:auto;max-width:480px;padding:24px;text-align:center">
  <h1 style="font-size:20px">管理画面はまだ有効になっていません</h1>
  <p style="color:var(--mut)">安全のため、パスワード（シークレット <code>ADMIN_PASSWORD</code>）を設定するまで管理画面は使えません。</p>
  <p style="color:var(--dim);font:13.5px 'Courier New',monospace">npx wrangler secret put ADMIN_PASSWORD</p>
</div>`,
  );
}

export function buildLoginPage(): string {
  return shell(
    "ログイン — 管理画面",
    `<form id="f" style="margin:auto;width:100%;max-width:400px;padding:28px">
  <h1 style="font-size:24px;margin:0 0 6px;font-weight:800">管理画面</h1>
  <p style="color:var(--mut);margin:0 0 26px">TECH CLUB のメンバー情報を編集します。</p>
  <label for="pw" style="display:block;font-size:14px;color:var(--mut);margin-bottom:7px;font-weight:600">パスワード</label>
  <input id="pw" class="in" type="password" autocomplete="current-password" autofocus required>
  <div id="err" class="errmsg" style="min-height:22px"></div>
  <button class="btn primary" style="width:100%;margin-top:10px;padding:13px" id="go">ログイン</button>
</form>
<script>
document.getElementById('f').addEventListener('submit', function (e) {
  e.preventDefault();
  var go = document.getElementById('go'), err = document.getElementById('err');
  go.disabled = true; err.textContent = '';
  fetch('/admin/login', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: document.getElementById('pw').value }) })
    .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
    .then(function (x) { if (x.ok) location.reload(); else { err.textContent = x.j.error || 'ログインできませんでした'; go.disabled = false; document.getElementById('pw').select(); } })
    .catch(function () { err.textContent = '通信に失敗しました'; go.disabled = false; });
});
</script>`,
  );
}

/* ── 本体 ──────────────────────────────────────────────── */

const JS = String.raw`
(function () {
  'use strict';
  var BASE = (document.body.getAttribute('data-base') || location.origin).replace(/\/+$/, '');
  var S = { members: [], roles: [], usage: {}, warnings: [], tab: 'members', sel: null, draft: null, orig: null,
            mode: 'profile', q: '', filter: 'all', rdraft: null, rorig: null, plain: [], imp: null, cs: null, csorig: null, csSide: 'front', csId: '', busy: false, side: 'front', pvOpen: false, touched: {} };

  var ID_RE = /^[A-Za-z0-9._-]{1,64}$/, HANDLE_RE = /^[A-Za-z0-9_.-]{1,50}$/, EMAIL_RE = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;

  function $(s, r) { return (r || document).querySelector(s); }
  function mk(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* ── 通信 ── */
  function api(method, path, body) {
    return fetch(path, { method: method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
      .then(function (r) {
        if (r.status === 401) { location.reload(); throw new Error('unauthorized'); }
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok) { var e = new Error(j.error || ('エラー (' + r.status + ')')); e.field = j.field; throw e; }
          return j;
        });
      });
  }
  var toastT;
  function toast(msg, kind) {
    var t = $('#toast'); t.textContent = msg; t.className = 'toast show' + (kind ? ' ' + kind : '');
    clearTimeout(toastT); toastT = setTimeout(function () { t.className = 'toast'; }, 3400);
  }
  function ask(message, okLabel, danger) {
    return new Promise(function (resolve) {
      var d = $('#dlg'); d.innerHTML = '';
      d.appendChild(mk('p', '', esc(message)));
      var row = mk('div', 'row');
      var no = mk('button', 'btn', 'キャンセル'), yes = mk('button', 'btn ' + (danger ? 'danger' : 'primary'), esc(okLabel || 'OK'));
      no.type = yes.type = 'button';
      function done(v) { d.close(); resolve(v); }
      no.onclick = function () { done(false); }; yes.onclick = function () { done(true); };
      d.oncancel = function () { resolve(false); };
      row.appendChild(no); row.appendChild(yes); d.appendChild(row); d.showModal(); no.focus();
    });
  }

  /* ── 状態 ── */
  function blank() { return { id: '', active: true, card: false, targetUrl: '', nameJp: '', nameEn: '', role: '', roleEn: '', email: '', githubId: '', xId: '', skills: [] }; }
  function strip(d) { var c = clone(d); delete c.roleEn; return JSON.stringify(c); }
  function memberDirty() { return !!(S.draft && S.orig && (strip(S.draft) !== strip(S.orig) || (S.mode === 'profile') !== !S.orig.targetUrl)); }
  function pick(r) { return { jp: r.jp, en: r.en }; }
  function rolesDirty() { return !!(S.rdraft && JSON.stringify(S.rdraft.map(pick)) !== JSON.stringify(S.rorig.map(pick))); }
  function csDirty() { return !!(S.cs && S.csorig && JSON.stringify(S.cs) !== JSON.stringify(S.csorig)); }
  function dirty() { return S.tab === 'members' ? memberDirty() : S.tab === 'roles' ? rolesDirty() : S.tab === 'card' ? csDirty() : false; }
  function officer(role) { return !!role && S.plain.indexOf(String(role).trim()) < 0; }
  function cardOf(m) { return officer(m.role) || !!m.card; }
  function guard() { return dirty() ? ask('保存していない変更があります。破棄して移動しますか？', '破棄して移動', true) : Promise.resolve(true); }
  function enOf(jp) { for (var i = 0; i < S.roles.length; i++) if (S.roles[i].jp === jp) return S.roles[i].en; return ''; }
  function normHandle(raw, hosts) {
    var s = String(raw || '').trim().replace(/^@/, '');
    hosts.forEach(function (h) { s = s.replace(new RegExp('^https?://(www\\.)?' + h.replace(/\./g, '\\.') + '/', 'i'), ''); });
    return s.replace(/[\/\s]+$/, '');
  }

  /* ── 読み込み ── */
  function load() {
    return Promise.all([api('GET', '/admin/api/members'), api('GET', '/admin/api/roles'), api('GET', '/admin/api/card-settings')]).then(function (r) {
      S.members = r[0].members; S.roles = r[1].roles; S.plain = r[1].plain || []; S.cs = clone(r[2].settings); S.csorig = clone(r[2].settings); S.usage = r[1].usage; S.warnings = r[1].warnings || [];
      S.rdraft = S.roles.map(function (x) { return { jp: x.jp, en: x.en, orig: true }; }); S.rorig = clone(S.rdraft);
      render();
    }).catch(function (e) { $('#app').innerHTML = '<div class="loading">読み込みに失敗しました: ' + esc(e.message) + '</div>'; });
  }

  /* ── 描画 ── */
  function render() {
    [].forEach.call(document.querySelectorAll('.tabs button'), function (b) { b.classList.toggle('on', b.getAttribute('data-tab') === S.tab); });
    if (S.tab === 'members') renderMembers(); else if (S.tab === 'roles') renderRoles(); else if (S.tab === 'card') renderCard(); else renderImport();
  }
  function initial(m) { return esc((m.nameJp || m.id || '?').charAt(0)); }

  function renderMembers() {
    var app = $('#app'); app.innerHTML = '';
    var v = mk('div', 'mview' + (S.sel ? ' picked' : ''));
    var list = mk('aside', 'list');
    var tools = mk('div', 'tools');
    var q = mk('input', 'in'); q.placeholder = '名前・ID で検索'; q.value = S.q; q.type = 'search';
    q.oninput = function () { S.q = q.value; drawItems(); };
    var add = mk('button', 'btn primary', '＋ 追加'); add.type = 'button';
    add.onclick = function () { select('__new'); };
    tools.appendChild(q); tools.appendChild(add); list.appendChild(tools);
    var fl = mk('div', 'filters'); fl.id = 'filters'; list.appendChild(fl);
    var ul = mk('ul'); ul.id = 'items'; list.appendChild(ul);
    var fw = mk('section', 'formwrap'); fw.id = 'fw';
    v.appendChild(list); v.appendChild(fw); app.appendChild(v);
    drawItems(); drawForm();
  }

  function drawFilters() {
    var fl = $('#filters'); if (!fl) return; fl.innerHTML = '';
    var counts = { all: S.members.length, on: 0, off: 0, fwd: 0, card: 0 };
    S.members.forEach(function (m) { if (m.active) counts.on++; else counts.off++; if (m.targetUrl) counts.fwd++; if (cardOf(m)) counts.card++; });
    [['all', 'すべて'], ['card', '名刺あり'], ['on', '公開'], ['off', '停止'], ['fwd', '転送あり']].forEach(function (f) {
      var b = mk('button', 'fchip' + (S.filter === f[0] ? ' on' : ''), f[1] + '<small>' + counts[f[0]] + '</small>'); b.type = 'button';
      b.onclick = function () { S.filter = f[0]; drawItems(); }; fl.appendChild(b);
    });
  }

  function drawItems() {
    var ul = $('#items'); if (!ul) return; ul.innerHTML = ''; drawFilters();
    var q = S.q.trim().toLowerCase();
    var rows = S.members.filter(function (m) {
      if (S.filter === 'on' && !m.active) return false;
      if (S.filter === 'off' && m.active) return false;
      if (S.filter === 'fwd' && !m.targetUrl) return false;
      if (S.filter === 'card' && !cardOf(m)) return false;
      return !q || (m.id + ' ' + m.nameJp + ' ' + m.nameEn + ' ' + m.role).toLowerCase().indexOf(q) >= 0;
    });
    if (!rows.length) { ul.appendChild(mk('li', 'empty', S.members.length ? '条件に合うメンバーがいません' : 'まだメンバーがいません。<br>「＋ 追加」から登録できます。')); return; }
    rows.forEach(function (m) {
      var on = m.id === S.sel;
      var li = mk('li', 'item' + (on ? ' on' : '') + (m.active ? '' : ' off'));
      li.innerHTML = '<div class="av">' + initial(m) + '</div><div class="txt"><div class="nm">' + esc(m.nameJp || '（名前未設定）') +
        '</div><div class="sub">' + (m.role ? esc(m.role) + ' · ' : '') + '<code>' + esc(m.id) + '</code></div></div><div class="meta">' +
        (on && memberDirty() ? '<span class="dot" title="未保存の変更"></span>' : '') +
        '<span class="tag ' + (m.active ? 'on' : 'off') + '">' + (m.active ? '公開' : '停止') + '</span>' + (m.targetUrl ? '<span class="tag fwd">転送</span>' : '') + (cardOf(m) ? '<span class="tag on">名刺</span>' : '') + '</div>';
      li.onclick = function () { select(m.id); };
      ul.appendChild(li);
    });
  }

  function select(id) {
    if (id === S.sel) return;
    guard().then(function (ok) {
      if (!ok) return;
      S.sel = id; S.touched = {};
      if (id === '__new') { S.draft = blank(); S.orig = blank(); S.mode = 'profile'; }
      else { var m = S.members.filter(function (x) { return x.id === id; })[0]; S.draft = clone(m); S.orig = clone(m); S.mode = m.targetUrl ? 'redirect' : 'profile'; }
      renderMembers();
      if (id === '__new') { var i = $('[data-f="id"] input'); if (i) i.focus(); }
    });
  }

  function field(label, control, hint, key, required) {
    var f = mk('div', 'fld'); if (key) f.setAttribute('data-f', key);
    if (label) f.appendChild(mk('label', '', esc(label) + (required ? '<span class="req">必須</span>' : '')));
    f.appendChild(control);
    if (hint) f.appendChild(mk('div', 'hint', hint));
    f.appendChild(mk('div', 'errmsg')); return f;
  }
  function textIn(key, opts) {
    opts = opts || {};
    var i = mk('input', 'in'); i.type = opts.type || 'text'; i.value = S.draft[key] || ''; i.placeholder = opts.ph || ''; i.maxLength = opts.max || 100;
    i.autocomplete = 'off'; i.spellcheck = false; if (opts.readonly) i.readOnly = true; if (opts.mono) i.style.fontFamily = '"Courier New",monospace';
    i.oninput = function () { S.draft[key] = i.value; S.touched[key] = true; touch(key); };
    i.onblur = function () { S.touched[key] = true; touch(key); };
    return i;
  }
  function prefixed(prefix, input) { var w = mk('div', 'pre'); w.appendChild(mk('span', '', esc(prefix))); w.appendChild(input); return w; }

  /* ── フォーム ── */
  var cardSync = null;
  function drawForm() {
    var fw = $('#fw'); if (!fw) return; fw.innerHTML = '';
    if (!S.sel) { fw.appendChild(mk('div', 'empty', '左の一覧からメンバーを選ぶか、<br>「＋ 追加」で新しく登録します。')); return; }
    var isNew = S.sel === '__new', d = S.draft;
    var form = mk('div', 'form');

    var head = mk('div', 'fhead');
    var back = mk('button', 'btn sm back', '← 一覧'); back.type = 'button';
    back.onclick = function () { guard().then(function (ok) { if (ok) { S.sel = null; renderMembers(); } }); };
    head.appendChild(back);
    head.appendChild(mk('h2', '', isNew ? '新しいメンバー' : esc(d.nameJp || d.id)));
    form.appendChild(head);
    if (!isNew) {
      form.appendChild(mk('div', 'links',
        '<a href="/preview/' + encodeURIComponent(d.id) + '" target="_blank" rel="noopener">名刺を開く ↗</a>' +
        '<a href="/profile/' + encodeURIComponent(d.id) + '" target="_blank" rel="noopener">プロフィールを開く ↗</a>'));
    } else { form.appendChild(mk('div', 'hint', 'まず ID と名前を入力してください。右のプレビューで名刺の仕上がりを確認しながら登録できます。')); form.lastChild.style.margin = '6px 0 20px'; }

    var grid = mk('div', 'fgrid'); var col = mk('div', 'fcol');

    /* 名前と肩書き */
    var s2 = mk('section', 'sec'); s2.appendChild(mk('h3', '', '名前と肩書き'));
    var two = mk('div', 'two');
    two.appendChild(field('氏名（和文）', textIn('nameJp', { max: 40, ph: '山田 太郎' }), '', 'nameJp'));
    two.appendChild(field('氏名（英文）', textIn('nameEn', { max: 60, ph: 'Taro Yamada' }), '', 'nameEn'));
    s2.appendChild(two);
    var sel = mk('select', 'in');
    sel.appendChild(new Option('（なし）', ''));
    S.roles.forEach(function (r) { sel.appendChild(new Option(r.jp, r.jp)); });
    if (d.role && !enOf(d.role)) sel.appendChild(new Option(d.role + '（未登録）', d.role));
    sel.value = d.role;
    var en = mk('span', 'en'); function setEn() { en.textContent = '名刺の英語表記: ' + (enOf(d.role) || '—'); en.style.display = d.role ? '' : 'none'; } setEn();
    sel.onchange = function () { d.role = sel.value; d.roleEn = enOf(d.role); setEn(); if (cardSync) cardSync(); touch('role'); };
    var rf = field('肩書き', sel, '', 'role'); rf.insertBefore(en, rf.querySelector('.errmsg'));
    rf.insertBefore(mk('div', 'hint', '選択肢を増やす・英訳を直すには上の「肩書き」タブへ。'), rf.querySelector('.errmsg'));
    s2.appendChild(rf); col.appendChild(s2);

    /* 連絡先 */
    var s3 = mk('section', 'sec'); s3.appendChild(mk('h3', '', '連絡先 <small>名刺とプロフィールに載ります。空欄は表示されません</small>'));
    s3.appendChild(field('メール', textIn('email', { type: 'email', max: 100, ph: 'taro@example.com' }), '', 'email'));
    var two2 = mk('div', 'two');
    two2.appendChild(field('GitHub', prefixed('github.com/', textIn('githubId', { max: 80, ph: 'taro-dev', mono: true })), 'URL を貼り付けても ID だけに直します。', 'githubId'));
    two2.appendChild(field('X', prefixed('@', textIn('xId', { max: 80, ph: 'taro_dev', mono: true })), '', 'xId'));
    s3.appendChild(two2); col.appendChild(s3);

    /* スキル */
    var s4 = mk('section', 'sec'); s4.appendChild(mk('h3', '', 'スキル <small>名刺に載るのは先頭の 3 つ（薄い表示は名刺に載りません）</small>'));
    s4.appendChild(field('', tagInput(), 'Enter か「,」で追加、× で削除。プロフィールには全部載ります。', 'skills'));
    col.appendChild(s4);

    /* QR の行き先 */
    var s5 = mk('section', 'sec'); s5.appendChild(mk('h3', '', 'QRコードの行き先'));
    var seg = mk('div', 'seg2');
    var b1 = mk('button', S.mode === 'profile' ? 'on' : '', 'プロフィールページ'), b2 = mk('button', S.mode === 'redirect' ? 'on' : '', '別のURLへ転送');
    b1.type = b2.type = 'button';
    var urlWrap = mk('div'); urlWrap.style.marginTop = '16px';
    var urlIn = textIn('targetUrl', { max: 500, ph: 'https://example.com/portfolio', mono: true });
    urlWrap.appendChild(field('転送先 URL', urlIn, '', 'targetUrl', true));
    function applyMode() {
      b1.classList.toggle('on', S.mode === 'profile'); b2.classList.toggle('on', S.mode === 'redirect');
      urlWrap.style.display = S.mode === 'redirect' ? '' : 'none';
    }
    b1.onclick = function () { S.mode = 'profile'; applyMode(); touch('mode'); };
    b2.onclick = function () { S.mode = 'redirect'; S.touched.targetUrl = true; applyMode(); touch('mode'); urlIn.focus(); };
    seg.appendChild(b1); seg.appendChild(b2); s5.appendChild(seg); s5.appendChild(urlWrap);
    s5.appendChild(mk('div', 'hint', 'どちらを選んでも、印刷済みの<b>QRは作り直し不要</b>です。')); s5.lastChild.style.marginBottom = '18px'; s5.lastChild.style.marginTop = '12px';
    col.appendChild(s5);

    /* 基本（ID・公開） */
    var s1 = mk('section', 'sec'); s1.appendChild(mk('h3', '', '基本設定'));
    var idIn = textIn('id', { mono: true, max: 64, ph: 'taro' });
    s1.appendChild(field('ID', idIn, isNew ? 'QRコードの URL に使われます（例: <b>…/p/taro</b>）。半角英数字と . _ - が使えます。あとから変更もできます。' : 'QR の URL（<b>…/p/' + esc(S.orig.id) + '</b>）に使われています。変更すると、<b>旧 ID で印刷済みの QR は読み取れなくなります</b>（印刷前なら問題ありません）。', 'id', true));
    var sw = mk('label', 'sw'); var cb = mk('input'); cb.type = 'checkbox'; cb.checked = d.active;
    cb.onchange = function () { d.active = cb.checked; touch('active'); };
    sw.appendChild(cb); sw.appendChild(mk('span', 'knob')); sw.appendChild(mk('span', '', '<b>公開する</b><small>OFF にすると QR・プロフィールが 404 になります</small>'));
    var fa = mk('div', 'fld'); fa.appendChild(sw); s1.appendChild(fa);
    var sw2 = mk('label', 'sw'); var cb2 = mk('input'); cb2.type = 'checkbox';
    var cardTxt = mk('span', '');
    sw2.appendChild(cb2); sw2.appendChild(mk('span', 'knob')); sw2.appendChild(cardTxt);
    function setCard() {
      var auto = officer(d.role); cb2.checked = auto || !!d.card; cb2.disabled = auto;
      cardTxt.innerHTML = '<b>名刺を作る</b><small>' + (auto ? '役職があるので自動で作られます' : '役職のない部員は、希望する人だけ ON にします') + '</small>';
    }
    cb2.onchange = function () { d.card = cb2.checked; touch('card'); };
    setCard(); cardSync = setCard;
    var fb = mk('div', 'fld'); fb.appendChild(sw2); s1.appendChild(fb);
    if (isNew) col.insertBefore(s1, col.firstChild); else col.appendChild(s1); // 新規は ID を最初に入力する

    grid.appendChild(col); grid.appendChild(previewPanel());
    form.appendChild(grid);

    /* 操作 */
    var act = mk('div', 'actions'); var inner = mk('div', 'inner');
    var save = mk('button', 'btn primary', isNew ? '追加する' : '保存'); save.type = 'button'; save.id = 'save'; save.onclick = saveMember; save.style.minWidth = '120px';
    var reset = mk('button', 'btn', '元に戻す'); reset.type = 'button'; reset.id = 'revert';
    reset.onclick = function () { S.draft = clone(S.orig); S.mode = S.orig.targetUrl ? 'redirect' : 'profile'; S.touched = {}; drawForm(); drawItems(); };
    var note = mk('span', 'dirty-note'); note.id = 'dnote';
    inner.appendChild(save); inner.appendChild(reset); inner.appendChild(note); inner.appendChild(mk('span', 'sp'));
    if (!isNew) { var del = mk('button', 'btn danger', '削除'); del.type = 'button'; del.onclick = deleteMember; inner.appendChild(del); }
    act.appendChild(inner); form.appendChild(act); fw.appendChild(form);
    applyMode(); refreshState(); schedulePreview(0);
  }

  function previewPanel() {
    var pv = mk('aside', 'pv' + (S.pvOpen ? ' open' : ''));
    var tg = mk('button', 'btn pvtoggle', '<span>名刺プレビュー</span><span id="pvt">' + (S.pvOpen ? '閉じる ▲' : '開く ▼') + '</span>'); tg.type = 'button';
    tg.onclick = function () { S.pvOpen = !S.pvOpen; pv.classList.toggle('open', S.pvOpen); $('#pvt').textContent = S.pvOpen ? '閉じる ▲' : '開く ▼'; if (S.pvOpen) schedulePreview(0); };
    pv.appendChild(tg);
    var box = mk('div', 'pvbox');
    var h = mk('div', 'pvh'); h.appendChild(mk('b', '', '名刺プレビュー'));
    var seg = mk('div', 'seg3');
    [['front', '表面'], ['back', '裏面']].forEach(function (s) {
      var b = mk('button', S.side === s[0] ? 'on' : '', s[1]); b.type = 'button';
      b.onclick = function () { S.side = s[0]; [].forEach.call(seg.children, function (x) { x.classList.toggle('on', x === b); }); schedulePreview(0); };
      seg.appendChild(b);
    });
    h.appendChild(seg); box.appendChild(h);
    var pc = mk('div', 'pvc'); pc.id = 'pvc'; box.appendChild(pc);
    box.appendChild(mk('div', 'pvn', '入力に合わせて自動で更新されます（<b>保存前の内容</b>も反映）。文字がはみ出さないか確認できます。'));
    pv.appendChild(box);
    var dest = mk('div', 'dest'); dest.id = 'dest'; pv.appendChild(dest);
    return pv;
  }

  var pvTimer, pvSeq = 0;
  function schedulePreview(ms) { clearTimeout(pvTimer); pvTimer = setTimeout(drawPreview, ms == null ? 250 : ms); drawDest(); }
  function drawPreview() {
    var pc = $('#pvc'); if (!pc || !S.draft) return;
    var my = ++pvSeq; var d = S.draft;
    fetch('/admin/api/preview', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ side: S.side, member: d, settings: S.cs }) })
      .then(function (r) { if (r.status === 401) { location.reload(); } return r.ok ? r.text() : null; })
      .then(function (svg) { if (my === pvSeq && svg && $('#pvc')) { $('#pvc').innerHTML = svg; var s = $('#pvc svg'); if (s) { s.removeAttribute('width'); s.removeAttribute('height'); } } })
      .catch(function () { /* プレビュー失敗は無視（保存には影響しない） */ });
  }
  function drawDest() {
    var el = $('#dest'); if (!el || !S.draft) return;
    var d = S.draft, url = BASE + '/p/' + (d.id || 'your-id');
    var what = S.mode === 'redirect'
      ? '読み取ると <b>' + esc(d.targetUrl || '（転送先 URL 未入力）') + '</b> へ転送されます。'
      : '読み取ると、この人の<b>プロフィールページ</b>が開きます。';
    el.innerHTML = '<h4>QRコードの行き先</h4><p>' + what + '</p><div class="urlrow"><span>' + esc(url) + '</span></div>';
    var cp = mk('button', 'btn sm', 'コピー'); cp.type = 'button';
    cp.onclick = function () { (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function () { toast('QR の URL をコピーしました', 'ok'); }, function () { toast('コピーできませんでした'); }); };
    el.querySelector('.urlrow').appendChild(cp);
  }

  function tagInput() {
    var box = mk('div', 'chips'); var inp = mk('input'); inp.placeholder = 'TypeScript'; inp.maxLength = 24;
    function paint() {
      [].slice.call(box.querySelectorAll('.chip')).forEach(function (c) { c.remove(); });
      S.draft.skills.forEach(function (t, i) {
        var c = mk('span', 'chip' + (i >= 3 ? ' dim' : ''), esc(t)); var x = mk('button', '', '×'); x.type = 'button'; x.title = '削除';
        x.onclick = function (e) { e.stopPropagation(); S.draft.skills.splice(i, 1); paint(); touch('skills'); };
        c.appendChild(x); box.insertBefore(c, inp);
      });
    }
    function commit() {
      var parts = inp.value.split(/[,、，]/).map(function (s) { return s.trim(); }).filter(Boolean);
      if (!parts.length) { inp.value = ''; return; }
      parts.forEach(function (p) { if (S.draft.skills.indexOf(p) < 0 && S.draft.skills.length < 10) S.draft.skills.push(p); });
      inp.value = ''; paint(); touch('skills');
    }
    inp.onkeydown = function (e) {
      if (e.key === 'Enter' || e.key === ',' || e.key === '、') { e.preventDefault(); commit(); }
      else if (e.key === 'Backspace' && !inp.value && S.draft.skills.length) { S.draft.skills.pop(); paint(); touch('skills'); }
    };
    inp.onblur = commit;
    box.onclick = function () { inp.focus(); };
    box.appendChild(inp); paint(); return box;
  }

  /* ── 入力チェック（保存前にその場で）── */
  function problems() {
    var d = S.draft, p = {}; if (!d) return p;
    var isNew = S.sel === '__new', nid = d.id.trim();
    if (isNew || nid !== S.orig.id) {
      if (!nid) p.id = '';
      else if (!ID_RE.test(nid)) p.id = 'ID は半角英数字と . _ - の 64 文字までです';
      else if (S.members.some(function (m) { return m.id === nid; })) p.id = 'この ID はすでに使われています';
    }
    if (d.email.trim() && !EMAIL_RE.test(d.email.trim().replace(/^mailto:/i, ''))) p.email = 'メールアドレスの形式が正しくありません';
    var g = normHandle(d.githubId, ['github.com']); if (g && !HANDLE_RE.test(g)) p.githubId = '使えない文字が含まれています（英数字・_ . - のみ）';
    var x = normHandle(d.xId, ['x.com', 'twitter.com']); if (x && !HANDLE_RE.test(x)) p.xId = '使えない文字が含まれています（英数字・_ . - のみ）';
    if (S.mode === 'redirect') {
      var u = d.targetUrl.trim();
      if (!u) p.targetUrl = '転送先の URL を入力するか、「プロフィールページ」を選んでください';
      else { var ok = false; try { var uu = new URL(u); ok = uu.protocol === 'https:' || uu.protocol === 'http:'; } catch (e) { ok = false; } if (!ok) p.targetUrl = 'https:// で始まる URL を入力してください'; }
    }
    return p;
  }
  function paintProblems() {
    var p = problems();
    ['id', 'email', 'githubId', 'xId', 'targetUrl'].forEach(function (k) {
      var f = document.querySelector('[data-f="' + k + '"]'); if (!f) return;
      var show = !!p[k] && !!S.touched[k];
      var m = f.querySelector('.errmsg'); if (m && !f.getAttribute('data-server')) m.textContent = show ? p[k] : '';
      var c = f.querySelector('.in'); if (c) c.classList.toggle('err', !!show);
    });
    return p;
  }
  function clearErrors() {
    [].forEach.call(document.querySelectorAll('.fld'), function (f) { f.removeAttribute('data-server'); });
    [].forEach.call(document.querySelectorAll('.fld .errmsg'), function (e) { e.textContent = ''; });
    [].forEach.call(document.querySelectorAll('.in.err,.chips.err'), function (e) { e.classList.remove('err'); });
  }
  function showError(field, msg) {
    var f = field && document.querySelector('[data-f="' + field + '"]');
    if (!f) { toast(msg, 'err'); return; }
    f.setAttribute('data-server', '1');
    f.querySelector('.errmsg').textContent = msg;
    var c = f.querySelector('.in,.chips'); if (c) c.classList.add('err');
    f.scrollIntoView({ block: 'center', behavior: 'smooth' });
    var i = f.querySelector('input,select'); if (i) i.focus();
  }
  function touch(key) {
    var f = key && document.querySelector('[data-f="' + key + '"]');
    if (f) { f.removeAttribute('data-server'); var c = f.querySelector('.in,.chips'); if (c) c.classList.remove('err'); var m = f.querySelector('.errmsg'); if (m) m.textContent = ''; }
    refreshState(); schedulePreview();
  }
  var lastDirty = null;
  function refreshState() {
    var save = $('#save'); if (!save) return;
    var isNew = S.sel === '__new', d = memberDirty(), p = paintProblems(), bad = Object.keys(p).length > 0;
    save.disabled = S.busy || (!isNew && !d) || (S.draft && !S.draft.id.trim()) || bad;
    save.textContent = S.busy ? '保存中…' : (isNew ? '追加する' : (d ? '保存' : '保存済み'));
    var rv = $('#revert'); if (rv) rv.disabled = !d;
    var n = $('#dnote'); if (n) { n.className = d ? 'dirty-note' : 'saved-note'; n.textContent = d ? '● 未保存の変更があります' : (isNew ? '' : '✓ 最新の状態です'); }
    if (lastDirty !== d) { lastDirty = d; drawItems(); }
  }

  function payload() {
    var d = clone(S.draft); delete d.roleEn;
    if (S.mode === 'profile') d.targetUrl = '';
    return d;
  }
  function saveMember() {
    if (S.busy) return;
    var isNew = S.sel === '__new', oldId = isNew ? '' : S.orig.id, newId = S.draft.id.trim();
    var run = function () {
      clearErrors(); S.busy = true; refreshState();
      var d = payload(); d.id = newId;
      var req = isNew ? api('POST', '/admin/api/members', d) : api('PATCH', '/admin/api/members/' + encodeURIComponent(oldId), d);
      req.then(function (j) {
        var m = j.member;
        S.members = S.members.filter(function (x) { return x.id !== oldId && x.id !== m.id; });
        S.members.push(m); S.members.sort(function (a, b) { return a.id < b.id ? -1 : 1; });
        S.sel = m.id; S.draft = clone(m); S.orig = clone(m); S.mode = m.targetUrl ? 'redirect' : 'profile'; S.touched = {};
        refreshUsage(); toast(isNew ? 'メンバーを追加しました' : '保存しました。QR・プロフィールにすぐ反映されます', 'ok');
        lastDirty = null; renderMembers();
      }).catch(function (e) { showError(e.field, e.message); }).then(function () { S.busy = false; refreshState(); });
    };
    if (!isNew && newId !== oldId) {
      ask('ID を「' + oldId + '」から「' + newId + '」に変更します。旧 ID の QR・URL（/p/' + oldId + '）は 404 になります。名刺を印刷済みなら刷り直しが必要です。', '変更する', true).then(function (ok) { if (ok) run(); });
    } else run();
  }
  function deleteMember() {
    var d = S.draft;
    ask('「' + (d.nameJp || d.id) + '」を削除します。QR・プロフィールは 404 になります。Notion のゴミ箱から復元できます。', '削除する', true).then(function (ok) {
      if (!ok) return;
      api('DELETE', '/admin/api/members/' + encodeURIComponent(d.id)).then(function () {
        S.members = S.members.filter(function (m) { return m.id !== d.id; });
        S.sel = null; S.draft = S.orig = null; refreshUsage(); toast('削除しました', 'ok'); lastDirty = null; renderMembers();
      }).catch(function (e) { toast(e.message, 'err'); });
    });
  }
  function refreshUsage() {
    S.usage = {}; S.members.forEach(function (m) { if (m.role) S.usage[m.role] = (S.usage[m.role] || 0) + 1; });
  }

  /* ── 肩書きタブ ── */
  function renderRoles() {
    var app = $('#app'); app.innerHTML = '';
    var v = mk('div', 'rview');
    v.appendChild(mk('h2', '', '肩書き'));
    v.appendChild(mk('p', 'lead', 'メンバーの「肩書き」で選べる一覧と、名刺に出る英語表記を管理します。保存すると Notion の <b>Role</b> の選択肢と <b>Role_EN</b> の数式が更新されます。'));
    if (S.warnings.length) v.appendChild(mk('div', 'note', esc(S.warnings.join(' / '))));
    v.appendChild(mk('div', 'rhead', '<span></span><span>日本語</span><span>ENGLISH（名刺の英語表記）</span><span style="text-align:right">使用</span><span></span>'));
    var rows = mk('div'); rows.id = 'rrows'; v.appendChild(rows);
    var add = mk('button', 'btn', '＋ 肩書きを追加'); add.type = 'button';
    add.onclick = function () { S.rdraft.push({ jp: '', en: '', orig: false }); drawRoleRows(); var ins = rows.querySelectorAll('input'); ins[ins.length - 2].focus(); refreshRoles(); };
    v.appendChild(add);
    v.appendChild(mk('div', 'note info', '使用中の肩書き（右の「使用」が 1 人以上）は、削除・日本語の名前変更はできません。先にメンバー側の肩書きを変更してください。英語表記はいつでも直せます。'));
    var act = mk('div', 'actions'); var inner = mk('div', 'inner'); inner.style.maxWidth = '756px';
    var save = mk('button', 'btn primary', '保存'); save.id = 'rsave'; save.type = 'button'; save.onclick = saveRolesNow; save.style.minWidth = '120px';
    var rv = mk('button', 'btn', '元に戻す'); rv.id = 'rrevert'; rv.type = 'button';
    rv.onclick = function () { S.rdraft = clone(S.rorig); drawRoleRows(); refreshRoles(); };
    var note = mk('span', 'dirty-note'); note.id = 'rnote';
    inner.appendChild(save); inner.appendChild(rv); inner.appendChild(note); act.appendChild(inner); v.appendChild(act);
    app.appendChild(v); drawRoleRows(); refreshRoles();
  }
  function drawRoleRows() {
    var host = $('#rrows'); host.innerHTML = '';
    S.rdraft.forEach(function (r, i) {
      var used = r.orig ? (S.usage[r.jp] || 0) : 0;
      var row = mk('div', 'rrow');
      var mv = mk('div', 'mv'); var up = mk('button', '', '▲'), dn = mk('button', '', '▼'); up.type = dn.type = 'button';
      up.disabled = i === 0; dn.disabled = i === S.rdraft.length - 1; up.title = '上へ'; dn.title = '下へ';
      up.onclick = function () { var t = S.rdraft[i - 1]; S.rdraft[i - 1] = r; S.rdraft[i] = t; drawRoleRows(); refreshRoles(); };
      dn.onclick = function () { var t = S.rdraft[i + 1]; S.rdraft[i + 1] = r; S.rdraft[i] = t; drawRoleRows(); refreshRoles(); };
      mv.appendChild(up); mv.appendChild(dn);
      var jp = mk('input', 'in'); jp.value = r.jp; jp.maxLength = 16; jp.placeholder = '例: 会計'; jp.readOnly = used > 0;
      if (used > 0) jp.title = '使用中のため名前は変更できません';
      jp.oninput = function () { r.jp = jp.value.trim(); refreshRoles(); };
      var en = mk('input', 'in en-in'); en.value = r.en; en.maxLength = 40; en.placeholder = 'e.g. Treasurer'; en.style.fontFamily = '"Courier New",monospace';
      en.oninput = function () { r.en = en.value.trim(); refreshRoles(); };
      var use = mk('span', 'use', used ? used + ' 人' : '—');
      var del = mk('button', 'btn sm danger', '削除'); del.type = 'button'; del.disabled = used > 0; if (used > 0) del.title = '使用中のため削除できません';
      del.onclick = function () { S.rdraft.splice(i, 1); drawRoleRows(); refreshRoles(); };
      row.appendChild(mv); row.appendChild(jp); row.appendChild(en); row.appendChild(use); row.appendChild(del); host.appendChild(row);
    });
    if (!S.rdraft.length) host.appendChild(mk('div', 'empty', '肩書きがありません。「＋ 肩書きを追加」で作成します。'));
  }
  function rolesProblem() {
    var seen = {};
    for (var i = 0; i < S.rdraft.length; i++) {
      var r = S.rdraft[i];
      if (!r.jp) return '日本語が空の行があります';
      if (!r.en) return '「' + r.jp + '」の英語表記を入力してください';
      if (/["\\]/.test(r.jp + r.en)) return '引用符（"）とバックスラッシュ（\\）は使えません';
      if (seen[r.jp]) return '「' + r.jp + '」が重複しています';
      seen[r.jp] = 1;
    }
    return '';
  }
  function refreshRoles() {
    var d = rolesDirty(), p = rolesProblem();
    $('#rsave').disabled = S.busy || !d || !!p; $('#rrevert').disabled = !d;
    var n = $('#rnote');
    if (p && d) { n.className = 'dirty-note'; n.style.color = 'var(--err)'; n.textContent = p; }
    else { n.style.color = ''; n.className = d ? 'dirty-note' : 'saved-note'; n.textContent = d ? '● 未保存の変更があります' : '✓ 最新の状態です'; }
    $('#rsave').textContent = S.busy ? '保存中…' : (d ? '保存' : '保存済み');
  }
  function saveRolesNow() {
    if (S.busy) return; S.busy = true; refreshRoles();
    api('PUT', '/admin/api/roles', { roles: S.rdraft.map(pick) }).then(function (j) {
      S.roles = j.roles; S.usage = j.usage; S.warnings = j.warnings || [];
      S.rdraft = S.roles.map(function (x) { return { jp: x.jp, en: x.en, orig: true }; }); S.rorig = clone(S.rdraft);
      return api('GET', '/admin/api/members').then(function (m) { S.members = m.members; });
    }).then(function () { toast('肩書きを保存しました（Notion に反映済み）', 'ok'); renderRoles(); })
      .catch(function (e) { toast(e.message, 'err'); }).then(function () { S.busy = false; if ($('#rsave')) refreshRoles(); });
  }



  /* ── 名刺（表面に載せる項目 + 書き出し）── */
  var KIND_LABEL = { mail: 'メール', github: 'GitHub', x: 'X' };
  var ALL_KINDS = ['mail', 'github', 'x'];
  function cardMembers() { return S.members.filter(cardOf); }
  function sampleMember() {
    var m = S.members.filter(function (x) { return x.id === S.csId; })[0] || cardMembers()[0] || S.members[0];
    if (m) return m;
    return { id: 'your-id', nameJp: '山田 太郎', nameEn: 'Taro Yamada', role: '部長', roleEn: 'President', email: 'taro@example.com', githubId: 'taro-dev', xId: 'taro_dev', skills: ['TypeScript', 'Cloudflare', 'UI/UX Design'], targetUrl: '', active: true };
  }
  function renderCard() {
    var app = $('#app'); app.innerHTML = '';
    var v = mk('div', 'cview');
    v.appendChild(mk('h2', '', '名刺'));
    v.appendChild(mk('p', 'lead', '表面に載せる項目を決めます。<b>変更は部員全員の名刺に反映</b>されます（保存するまでは、右のプレビューだけ変わります）。名刺の書き出しもここからできます。'));
    var grid = mk('div', 'cgrid'); var left = mk('div'), right = mk('div');

    /* 連絡先 */
    var s1 = mk('section', 'csec'); s1.appendChild(mk('h3', '', '連絡先（載せるものと順番）'));
    var rows = mk('div'); s1.appendChild(rows);
    function drawKinds() {
      rows.innerHTML = '';
      var order = S.cs.contacts.concat(ALL_KINDS.filter(function (k) { return S.cs.contacts.indexOf(k) < 0; }));
      order.forEach(function (k) {
        var on = S.cs.contacts.indexOf(k) >= 0, i = S.cs.contacts.indexOf(k);
        var r = mk('div', 'crow' + (on ? '' : ' offr'));
        var sw = mk('label', 'sw'), cb = mk('input'); cb.type = 'checkbox'; cb.checked = on;
        cb.onchange = function () { if (cb.checked) S.cs.contacts.push(k); else S.cs.contacts = S.cs.contacts.filter(function (x) { return x !== k; }); changed(); drawKinds(); };
        sw.appendChild(cb); sw.appendChild(mk('span', 'knob')); r.appendChild(sw);
        r.appendChild(mk('span', 'nm', KIND_LABEL[k]));
        var mv = mk('span', 'mvb'), up = mk('button', '', '▲'), dn = mk('button', '', '▼'); up.type = dn.type = 'button';
        up.disabled = !on || i === 0; dn.disabled = !on || i === S.cs.contacts.length - 1;
        up.onclick = function () { var c = S.cs.contacts; var t = c[i - 1]; c[i - 1] = c[i]; c[i] = t; changed(); drawKinds(); };
        dn.onclick = function () { var c = S.cs.contacts; var t = c[i + 1]; c[i + 1] = c[i]; c[i] = t; changed(); drawKinds(); };
        mv.appendChild(up); mv.appendChild(dn); r.appendChild(mv); rows.appendChild(r);
      });
      s1.querySelector('.hint') || s1.appendChild(mk('div', 'hint', '名刺に載るのは先頭から 3 つまで（左の 2 段、右の 1 段の順）。メンバーが入力していない項目は載りません。'));
    }
    drawKinds(); left.appendChild(s1);

    /* スキル */
    var s2 = mk('section', 'csec'); s2.appendChild(mk('h3', '', 'スキルを載せる数'));
    var seg = mk('div', 'seg2');
    [0, 1, 2, 3].forEach(function (n) {
      var b = mk('button', S.cs.skills === n ? 'on' : '', n === 0 ? '載せない' : n + ' 個'); b.type = 'button';
      b.onclick = function () { S.cs.skills = n; [].forEach.call(seg.children, function (x, i) { x.classList.toggle('on', i === n); }); changed(); };
      seg.appendChild(b);
    });
    s2.appendChild(seg); left.appendChild(s2);

    /* その他 */
    var s3 = mk('section', 'csec'); s3.appendChild(mk('h3', '', 'そのほか'));
    [['showNameEn', '英語の氏名（ローマ字）', '氏名の下の段に載ります'], ['showRoleEn', '英語の肩書き', '日本語の肩書きの右に載ります'], ['showId', 'ヘッダの「DEV TEAM / ID」', 'ロゴの横の小さな 1 行です']].forEach(function (o) {
      var r = mk('div', 'crow'); var sw = mk('label', 'sw'), cb = mk('input'); cb.type = 'checkbox'; cb.checked = !!S.cs[o[0]];
      cb.onchange = function () { S.cs[o[0]] = cb.checked; changed(); };
      sw.appendChild(cb); sw.appendChild(mk('span', 'knob')); r.appendChild(sw); r.appendChild(mk('span', 'nm', esc(o[1]) + '<div class="hint" style="margin:0">' + esc(o[2]) + '</div>')); s3.appendChild(r);
    });
    left.appendChild(s3);

    /* プレビュー */
    var pv = mk('section', 'csec'); pv.appendChild(mk('h3', '', 'プレビュー'));
    var bar = mk('div', 'bar2');
    var sel = mk('select', 'in'); var ms = S.members.length ? S.members : [sampleMember()];
    ms.forEach(function (m) { sel.appendChild(new Option((m.nameJp || m.id) + '（' + m.id + '）', m.id)); });
    sel.value = sampleMember().id; S.csId = sel.value; sel.onchange = function () { S.csId = sel.value; drawCardPv(); };
    var seg2 = mk('div', 'seg2'); seg2.style.width = '180px';
    [['front', '表面'], ['back', '裏面']].forEach(function (x) {
      var b = mk('button', S.csSide === x[0] ? 'on' : '', x[1]); b.type = 'button';
      b.onclick = function () { S.csSide = x[0]; [].forEach.call(seg2.children, function (y) { y.classList.toggle('on', y === b); }); drawCardPv(); };
      seg2.appendChild(b);
    });
    bar.appendChild(sel); bar.appendChild(seg2); pv.appendChild(bar);
    var box = mk('div', 'pvbox'); var pc = mk('div', 'pvc'); pc.id = 'cpc'; pc.style.minHeight = '120px'; box.appendChild(pc); pv.appendChild(box);
    right.appendChild(pv);

    /* 書き出し */
    var ex = mk('section', 'csec exp'); ex.appendChild(mk('h3', '', '名刺の書き出し'));
    ex.appendChild(mk('div', 'hint', '名刺を作る人（役職がある人 + 名刺希望の人）の表と裏を SVG で書き出します。文字はアウトライン化済みで、入稿用は塗り足し 3mm 付きです。'));
    ex.lastChild.style.marginBottom = '12px';
    var bar2 = mk('div', 'bar2');
    var bl = mk('select', 'in'); bl.appendChild(new Option('塗り足し 3mm あり（入稿用）', '1')); bl.appendChild(new Option('塗り足しなし（仕上がりサイズ）', '0')); bl.id = 'bleed';
    var all = mk('button', 'btn primary', '選んだ人を ZIP でまとめてダウンロード'); all.type = 'button'; all.id = 'zipgo'; all.onclick = exportZip;
    bar2.appendChild(bl); bar2.appendChild(all); ex.appendChild(bar2);
    var st = mk('div', 'hint'); st.id = 'zipst'; ex.appendChild(st);
    var list = mk('div'); list.id = 'exlist'; ex.appendChild(list);
    right.appendChild(ex);

    grid.appendChild(left); grid.appendChild(right); v.appendChild(grid);

    var act = mk('div', 'actions'); var inner = mk('div', 'inner');
    var save = mk('button', 'btn primary', '保存'); save.type = 'button'; save.id = 'cssave'; save.style.minWidth = '120px'; save.onclick = saveCardSettings;
    var rv = mk('button', 'btn', '元に戻す'); rv.type = 'button'; rv.id = 'csrev'; rv.onclick = function () { S.cs = clone(S.csorig); renderCard(); };
    var note = mk('span', 'dirty-note'); note.id = 'csnote';
    inner.appendChild(save); inner.appendChild(rv); inner.appendChild(note); act.appendChild(inner); v.appendChild(act);
    app.appendChild(v);
    drawExport(); changed(true);
  }
  var cpTimer, cpSeq = 0;
  function changed(now) {
    var d = csDirty(), sv = $('#cssave'), rv = $('#csrev'), n = $('#csnote');
    if (sv) { sv.disabled = S.busy || !d; sv.textContent = S.busy ? '保存中…' : (d ? '保存して全員に反映' : '保存済み'); }
    if (rv) rv.disabled = !d;
    if (n) { n.className = d ? 'dirty-note' : 'saved-note'; n.textContent = d ? '● 未保存の変更があります' : '✓ 最新の状態です'; }
    clearTimeout(cpTimer); cpTimer = setTimeout(drawCardPv, now ? 0 : 200);
  }
  function drawCardPv() {
    var pc = $('#cpc'); if (!pc) return; var my = ++cpSeq, m = clone(sampleMember()); delete m.roleEn;
    fetch('/admin/api/preview', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ side: S.csSide, member: m, settings: S.cs }) })
      .then(function (r) { if (r.status === 401) location.reload(); return r.ok ? r.text() : null; })
      .then(function (svg) { if (my === cpSeq && svg && $('#cpc')) { $('#cpc').innerHTML = svg; var e = $('#cpc svg'); if (e) { e.removeAttribute('width'); e.removeAttribute('height'); } } })
      .catch(function () {});
  }
  function saveCardSettings() {
    if (S.busy || !csDirty()) return; S.busy = true; changed(true);
    api('PUT', '/admin/api/card-settings', { settings: S.cs }).then(function (j) {
      S.cs = clone(j.settings); S.csorig = clone(j.settings); toast('保存しました。全員の名刺に反映されます', 'ok');
    }).catch(function (e) { toast(e.message, 'err'); }).then(function () { S.busy = false; changed(true); });
  }

  /* 書き出し（1 人ずつ / まとめて ZIP）。ZIP はブラウザの中で作る（1 枚ずつ取りに行くので、人数が多くても詰まらない） */
  function drawExport() {
    var l = $('#exlist'); if (!l) return; l.innerHTML = '';
    var ms = cardMembers();
    if (!ms.length) { l.appendChild(mk('div', 'hint', '名刺を作る人がいません。役職を設定するか、メンバーの「名刺を作る」にチェックを入れてください。')); $('#zipgo').disabled = true; return; }
    ms.forEach(function (m) {
      var r = mk('div', 'rowx'); var cb = mk('input'); cb.type = 'checkbox'; cb.checked = true; cb.setAttribute('data-id', m.id); cb.setAttribute('aria-label', m.nameJp || m.id);
      r.appendChild(cb);
      r.appendChild(mk('span', 'nm', esc(m.nameJp || '（名前未設定）') + '<code>' + esc(m.id) + '</code>'));
      var q = function () { return $('#bleed').value === '0' ? '?bleed=0' : ''; };
      var a1 = mk('a', '', '表面 ↓'), a2 = mk('a', '', '裏面 ↓');
      a1.href = '/generate/' + encodeURIComponent(m.id); a2.href = '/generate/' + encodeURIComponent(m.id) + '/back';
      a1.onclick = function () { a1.href = '/generate/' + encodeURIComponent(m.id) + q(); }; a2.onclick = function () { a2.href = '/generate/' + encodeURIComponent(m.id) + '/back' + q(); };
      a1.setAttribute('download', ''); a2.setAttribute('download', '');
      r.appendChild(a1); r.appendChild(a2); l.appendChild(r);
    });
  }
  var CRC = (function () { var t = []; for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8) { var c = 0xffffffff; for (var i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  function zipStore(files) { // files: [{ name, data: Uint8Array }]（無圧縮の ZIP）
    var enc = new TextEncoder(), parts = [], central = [], off = 0;
    files.forEach(function (f) {
      var nm = enc.encode(f.name), crc = crc32(f.data), lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint32(14, crc, true);
      lh.setUint32(18, f.data.length, true); lh.setUint32(22, f.data.length, true); lh.setUint16(26, nm.length, true);
      parts.push(new Uint8Array(lh.buffer), nm, f.data);
      var ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint32(16, crc, true);
      ch.setUint32(20, f.data.length, true); ch.setUint32(24, f.data.length, true); ch.setUint16(28, nm.length, true); ch.setUint32(42, off, true);
      central.push(new Uint8Array(ch.buffer), nm);
      off += 30 + nm.length + f.data.length;
    });
    var size = central.reduce(function (n, p) { return n + p.length; }, 0), end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, size, true); end.setUint32(16, off, true);
    return new Blob(parts.concat(central, [new Uint8Array(end.buffer)]), { type: 'application/zip' });
  }
  function exportZip() {
    var ids = [].map.call(document.querySelectorAll('#exlist input[type=checkbox]:checked'), function (c) { return c.getAttribute('data-id'); });
    if (!ids.length) { toast('書き出す人を選んでください', 'err'); return; }
    var q = $('#bleed').value === '0' ? '?bleed=0' : '', jobs = [];
    ids.forEach(function (id) { jobs.push({ name: id + '-card-front.svg', url: '/generate/' + encodeURIComponent(id) + q }); jobs.push({ name: id + '-card-back.svg', url: '/generate/' + encodeURIComponent(id) + '/back' + q }); });
    var files = [], failed = [], i = 0, go = $('#zipgo'), st = $('#zipst'); go.disabled = true;
    function one() {
      var j = jobs[i++]; if (!j) return Promise.resolve();
      st.textContent = '作成中… ' + (i - 1) + ' / ' + jobs.length;
      return fetch(j.url).then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.arrayBuffer(); })
        .then(function (b) { files.push({ name: j.name, data: new Uint8Array(b) }); })
        .catch(function () { failed.push(j.name); }).then(one);
    }
    one().then(function () {
      go.disabled = false;
      if (!files.length) { st.textContent = '書き出せませんでした。少し待ってからもう一度お試しください。'; return; }
      var a = document.createElement('a'); a.href = URL.createObjectURL(zipStore(files)); a.download = 'tech-club-cards' + (q ? '-trim' : '') + '.zip'; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      st.textContent = files.length + ' 枚をダウンロードしました' + (failed.length ? '（失敗: ' + failed.join('、') + '）' : '');
      if (failed.length) toast('一部の名刺を作れませんでした。もう一度お試しください', 'err'); else toast('ZIP をダウンロードしました', 'ok');
    });
  }

  /* ── 名簿の取り込み ── */
  var ROWS_PER_REQ = 8;
  function renderImport() {
    var app = $('#app'); app.innerHTML = '';
    var v = mk('div', 'iview');
    v.appendChild(mk('h2', '', '名簿の取り込み'));
    v.appendChild(mk('p', 'lead', 'Excel（.xlsx）か CSV の名簿を選ぶと、メンバーをまとめて登録・更新できます。1 行目は見出し、2 行目から 1 人ずつにしてください。' +
      '<br><b>役職がある人は名刺を自動で作ります</b>。役職のない部員は、名簿に「名刺希望」の列（○など）があればその人だけ、なければあとから「メンバー」タブで選べます。' +
      '<br>ID（QR の URL）は、名簿に ID 列があればそれを、なければメールアドレス（@andrew.ac.jp）の @ より前を使います。'));
    var pick = mk('div', 'pick');
    var fi = mk('input'); fi.type = 'file'; fi.id = 'ifile'; fi.accept = '.xlsx,.csv,.tsv,.txt,text/csv';
    var fb = mk('button', 'btn primary', 'ファイルを選ぶ'); fb.type = 'button'; fb.onclick = function () { fi.click(); };
    var fn = mk('span', 'fname', S.imp ? esc(S.imp.name) : '.xlsx / .csv（2MB まで・先頭のシートだけ読みます）');
    pick.appendChild(fb); pick.appendChild(fi); pick.appendChild(fn); v.appendChild(pick);
    fi.onchange = function () { var f = fi.files && fi.files[0]; if (f) loadRoster(f); };
    var body = mk('div'); body.id = 'ibody'; v.appendChild(body);
    app.appendChild(v);
    if (S.imp && S.imp.parsed) drawImport();
  }

  function loadRoster(file) {
    if (file.size > 2 * 1024 * 1024) { toast('ファイルが大きすぎます（2MB まで）', 'err'); return; }
    file.arrayBuffer().then(function (buf) { S.imp = { name: file.name, buf: buf, parsed: null, rows: [], map: null, result: null }; return parseRoster(null); })
      .catch(function (e) { S.imp = null; renderImport(); toast(e.message, 'err'); });
  }
  function parseRoster(map, header) {
    var q = [];
    if (map) q.push('map=' + encodeURIComponent(JSON.stringify(map)));
    if (header) q.push('header=' + header);
    var url = '/admin/api/import/parse' + (q.length ? '?' + q.join('&') : '');
    return fetch(url, { method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body: S.imp.buf }).then(function (r) {
      if (r.status === 401) { location.reload(); throw new Error('unauthorized'); }
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw new Error(j.error || ('エラー (' + r.status + ')'));
        S.imp.parsed = j; S.imp.map = j.mapping; S.imp.header = j.headerRow;
        S.imp.rows = j.rows.map(function (r) {
          r.roleOk = !(r.roleRaw && S.plain.indexOf(r.roleRaw) < 0 && !r.role);
          r.include = true; r.card = !!r.card; return r;
        });
        S.imp.rows.forEach(function (r) { r.include = rowProblems(r).length === 0; });
        renderImport();
      });
    });
  }

  function rowProblems(r) {
    var p = [], id = r.id.trim();
    if (!id) p.push('ID を入力してください');
    else if (!ID_RE.test(id)) p.push('ID は半角英数字と . _ - の 64 文字までです');
    else if (S.imp.rows.some(function (o) { return o !== r && o.id.trim() === id; })) p.push('名簿の中で ID が重なっています');
    if (!r.roleOk) p.push('名簿の役職「' + r.roleRaw + '」は未登録です。選んでください');
    if (r.email && !EMAIL_RE.test(r.email)) p.push('メールの形式が正しくありません');
    return p;
  }
  function isExisting(r) { var id = r.id.trim(); return S.members.some(function (m) { return m.id === id; }); }

  function drawImport() {
    var b = $('#ibody'); if (!b) return; b.innerHTML = '';
    var P = S.imp.parsed, rows = S.imp.rows;

    if (S.imp.result) {
      var res = S.imp.result, bad = res.filter(function (x) { return !x.ok; });
      var box = mk('div', 'res');
      box.innerHTML = '<b>取り込みました</b>：新規 ' + res.filter(function (x) { return x.ok && x.action === 'create'; }).length + ' 人 / 更新 ' + res.filter(function (x) { return x.ok && x.action === 'update'; }).length + ' 人' +
        (bad.length ? '<br><span class="bad">失敗 ' + bad.length + ' 人：' + bad.map(function (x) { return esc(x.id) + '（' + esc(x.error) + '）'; }).join('、') + '</span>' : '') +
        '<br><a href="/preview" target="_blank" rel="noopener">名刺プレビューを開く ↗</a>';
      b.appendChild(box);
    }

    /* 列の対応 */
    var m = S.imp.map, need = m.nameJp < 0 && m.surname < 0 || (m.id < 0 && m.email < 0);
    var det = mk('details'); if (need) det.open = true;
    det.appendChild(mk('summary', '', '列の対応' + (need ? '（氏名か ID が見つかりません。選んでください）' : '（自動で判定しました。違っていれば変更できます）')));
    var hw = mk('div'); hw.style.marginTop = '14px';
    var hl = mk('label', '', '見出しの行（上にタイトルなどがある名簿用。自動で探しています）'); hl.style.cssText = 'display:block;font-size:12.5px;color:var(--dim);font-weight:600;margin-bottom:4px';
    var hi = mk('input', 'in'); hi.type = 'number'; hi.min = '1'; hi.value = String(S.imp.header); hi.style.cssText = 'width:120px;min-height:40px;padding:7px 12px';
    hi.onchange = function () { var n = Number(hi.value); if (n >= 1) parseRoster(null, n).catch(function (e) { toast(e.message, 'err'); }); };
    hw.appendChild(hl); hw.appendChild(hi);
    var g = mk('div', 'mapgrid');
    P.fields.forEach(function (f) {
      var w = mk('div'); w.appendChild(mk('label', '', esc(P.labels[f])));
      var sel = mk('select', 'in'); sel.appendChild(new Option('（使わない）', '-1'));
      P.headers.forEach(function (h, i) { sel.appendChild(new Option((h || '（見出しなし）') + '  ［' + (i + 1) + ' 列目］', String(i))); });
      sel.value = String(m[f]);
      sel.onchange = function () { var nm = clone(S.imp.map); nm[f] = Number(sel.value); parseRoster(nm, S.imp.header).catch(function (e) { toast(e.message, 'err'); }); };
      w.appendChild(sel); g.appendChild(w);
    });
    det.appendChild(hw); det.appendChild(g); b.appendChild(det);

    if (P.unknownRoles && P.unknownRoles.length) b.appendChild(unknownRolesBox(P.unknownRoles));
    if (P.truncated) b.appendChild(mk('div', 'note', '行が多いため、先頭の 500 人だけ表示しています。残りは名簿を分けて取り込んでください。'));

    var sum = mk('div', 'sumbar'); sum.id = 'isum'; b.appendChild(sum);

    var tbl = mk('table', 'tbl');
    tbl.innerHTML = '<thead><tr><th></th><th>行</th><th>ID</th><th>氏名</th><th>役職</th><th>名刺</th><th>状態</th></tr></thead>';
    var tb = mk('tbody');
    rows.forEach(function (r) {
      var tr = mk('tr');
      var c0 = mk('td'), cb = mk('input'); cb.type = 'checkbox'; cb.checked = r.include; cb.setAttribute('aria-label', '取り込む');
      cb.onchange = function () { r.include = cb.checked; paintAll(); }; c0.appendChild(cb); tr.appendChild(c0);
      tr.appendChild(mk('td', '', String(r.line)));
      var cId = mk('td', 'idc'), idIn = mk('input', 'in'); idIn.value = r.id; idIn.setAttribute('spellcheck', 'false');
      idIn.oninput = function () { r.id = idIn.value.trim().toLowerCase(); paintAll(); };
      cId.appendChild(idIn); tr.appendChild(cId);
      tr.appendChild(mk('td', '', '<b>' + esc(r.nameJp || '（氏名なし）') + '</b>' + (r.nameEn ? '<div class="cap">' + esc(r.nameEn) + '</div>' : '') + (r.email ? '<div class="cap">' + esc(r.email) + '</div>' : '')));
      var cR = mk('td', 'rc'), rs = mk('select', 'in'); rs.appendChild(new Option('（役職なし＝部員）', ''));
      P.roles.forEach(function (x) { rs.appendChild(new Option(x.jp, x.jp)); });
      if (!r.roleOk) rs.insertBefore(new Option('「' + r.roleRaw + '」→ 選んでください', '__ask'), rs.firstChild);
      rs.value = r.roleOk ? r.role : '__ask';
      rs.onchange = function () { if (rs.value === '__ask') return; r.role = rs.value; r.roleOk = true; paintAll(); };
      cR.appendChild(rs); tr.appendChild(cR);
      var cC = mk('td'), cc = mk('input'); cc.type = 'checkbox'; cc.setAttribute('aria-label', '名刺を作る');
      cc.onchange = function () { r.card = cc.checked; paintAll(); }; cC.appendChild(cc); tr.appendChild(cC);
      var cS = mk('td', 'st'); tr.appendChild(cS);
      r._el = { tr: tr, cb: cb, cc: cc, cS: cS }; tb.appendChild(tr);
    });
    tbl.appendChild(tb); b.appendChild(tbl);

    var act = mk('div', 'actions'); var inner = mk('div', 'inner');
    var go = mk('button', 'btn primary', '取り込む'); go.type = 'button'; go.id = 'igo'; go.style.minWidth = '160px'; go.onclick = commitImport;
    inner.appendChild(go); inner.appendChild(mk('span', 'sp')); act.appendChild(inner); b.appendChild(act);
    paintAll();
  }

  /* 名簿にあって、肩書きに未登録の役職を、英語の表記つきでその場で追加する */
  var ROLE_HINTS = { '文サ': 'Culture Circle Liaison', '渉外': 'External Relations', '書記': 'Secretary', '会計': 'Treasurer', '広報': 'Public Relations' };
  function unknownRolesBox(names) {
    var box = mk('div', 'note');
    box.appendChild(mk('div', '', '<b>名簿にある役職のうち、まだ肩書きに登録されていないものがあります。</b>英語の表記（名刺に載ります）を確認して追加できます。'));
    var rows = [];
    names.forEach(function (n) {
      var r = mk('div', 'crow'); r.style.borderTop = '0';
      var nm = mk('span', 'nm', '<b>' + esc(n) + '</b>'); nm.style.flex = 'none'; nm.style.minWidth = '90px';
      var en = mk('input', 'in'); en.value = ROLE_HINTS[n] || ''; en.placeholder = '英語の表記（例: Secretary）'; en.maxLength = 40; en.style.maxWidth = '320px';
      r.appendChild(nm); r.appendChild(en); box.appendChild(r); rows.push({ jp: n, input: en });
    });
    var go = mk('button', 'btn primary', '肩書きに追加して読み直す'); go.type = 'button'; go.style.marginTop = '10px';
    go.onclick = function () {
      var add = rows.map(function (x) { return { jp: x.jp, en: x.input.value.trim() }; });
      var bad = add.filter(function (x) { return !x.en || /["\\]/.test(x.en) || /["\\]/.test(x.jp) || x.jp.length > 16; })[0];
      if (bad) { toast('「' + bad.jp + '」の英語の表記を入れてください（引用符は使えません。肩書きは 16 文字まで）', 'err'); return; }
      go.disabled = true;
      api('PUT', '/admin/api/roles', { roles: S.roles.map(pick).concat(add) }).then(function (j) {
        S.roles = j.roles; S.usage = j.usage; S.rdraft = S.roles.map(function (x) { return { jp: x.jp, en: x.en, orig: true }; }); S.rorig = clone(S.rdraft);
        toast('肩書きに追加しました', 'ok'); return parseRoster(S.imp.map, S.imp.header);
      }).catch(function (e) { go.disabled = false; toast(e.message, 'err'); });
    };
    box.appendChild(go);
    box.appendChild(mk('div', 'hint', '追加せずに、下の一覧で人ごとに役職を選ぶこともできます（「役職なし」にもできます）。'));
    return box;
  }

  function paintAll() {
    var rows = S.imp.rows, n = { create: 0, update: 0, card: 0, bad: 0, inc: 0 };
    rows.forEach(function (r) {
      var el = r._el; if (!el) return;
      var probs = rowProblems(r), exists = isExisting(r), auto = officer(r.role);
      if (probs.length) r.include = false;
      el.cb.checked = r.include; el.cb.disabled = probs.length > 0;
      el.cc.checked = auto || r.card; el.cc.disabled = auto || !r.include;
      el.tr.className = r.include ? '' : 'skip';
      el.cS.innerHTML = probs.length ? '<span class="bad">' + probs.map(esc).join('<br>') + '</span>'
        : '<span class="tag ' + (exists ? 'fwd' : 'on') + '">' + (exists ? '更新' : '新規') + '</span>' + (auto ? '<span class="cap">役職あり→名刺を作る</span>' : (r.card ? '<span class="cap">名刺希望</span>' : '<span class="cap">名刺なし</span>')) +
          (r.roleExtra ? '<div class="cap">他の役職: ' + esc(r.roleExtra) + '（名刺には「' + esc(r.role) + '」だけ載ります）</div>' : '') +
          (exists && r.include ? '<div class="cap">既存の「' + esc((S.members.filter(function (m) { return m.id === r.id.trim(); })[0] || {}).nameJp || '') + '」に上書き（名簿が空欄の項目は今のまま）</div>' : '');
      if (probs.length) n.bad++;
      if (r.include) { n.inc++; if (exists) n.update++; else n.create++; if (auto || r.card) n.card++; }
    });
    var sum = $('#isum'); if (sum) sum.innerHTML = '<span class="pill"><b>' + rows.length + '</b>人を読み込み</span><span class="pill"><b>' + n.create + '</b>人 新規</span><span class="pill"><b>' + n.update + '</b>人 更新</span><span class="pill"><b>' + n.card + '</b>人 名刺を作る</span>' + (n.bad ? '<span class="pill warn"><b>' + n.bad + '</b>人 要確認（取り込まれません）</span>' : '');
    var go = $('#igo'); if (go) { go.disabled = S.busy || n.inc === 0; go.textContent = S.busy ? '取り込み中…' : (n.inc ? n.inc + ' 人を取り込む' : '取り込む人がいません'); }
  }

  function commitImport() {
    if (S.busy) return;
    var rows = S.imp.rows.filter(function (r) { return r.include && rowProblems(r).length === 0; });
    if (!rows.length) return;
    var nu = rows.filter(isExisting).length;
    ask(rows.length + ' 人を Notion に取り込みます（新規 ' + (rows.length - nu) + ' 人・更新 ' + nu + ' 人）。更新は、名簿に書かれている項目だけを上書きします。', '取り込む').then(function (ok) {
      if (!ok) return;
      S.busy = true; paintAll();
      var results = [], i = 0;
      function next() {
        if (i >= rows.length) return Promise.resolve();
        var chunk = rows.slice(i, i + ROWS_PER_REQ); i += ROWS_PER_REQ;
        var payload = chunk.map(function (r) { return { id: r.id.trim(), nameJp: r.nameJp, nameEn: r.nameEn, role: r.role, email: r.email, githubId: r.githubId, xId: r.xId, skills: r.skills, card: officer(r.role) || !!r.card }; });
        return api('POST', '/admin/api/import', { rows: payload }).then(function (j) { results = results.concat(j.results); var go = $('#igo'); if (go) go.textContent = '取り込み中… ' + results.length + ' / ' + rows.length; }).then(next);
      }
      next().catch(function (e) { toast(e.message, 'err'); }).then(function () {
        return api('GET', '/admin/api/members').then(function (m) { S.members = m.members; refreshUsage(); }).catch(function () {});
      }).then(function () {
        S.busy = false;
        var okIds = {}; results.forEach(function (x) { if (x.ok) okIds[x.id] = 1; });
        S.imp.rows = S.imp.rows.filter(function (r) { return !okIds[r.id.trim()]; });
        S.imp.result = results;
        toast(results.filter(function (x) { return x.ok; }).length + ' 人を取り込みました', 'ok');
        renderImport();
      });
    });
  }

  /* ── 起動 ── */
  [].forEach.call(document.querySelectorAll('.tabs button'), function (b) {
    b.onclick = function () { var t = b.getAttribute('data-tab'); if (t === S.tab) return; guard().then(function (ok) { if (!ok) return;
      if (S.tab === 'members') { S.draft = S.orig = null; S.sel = null; } else if (S.tab === 'roles') { S.rdraft = clone(S.rorig); } else if (S.tab === 'card') { S.cs = clone(S.csorig); }
      S.tab = t; lastDirty = null; render(); }); };
  });
  $('#logout').onclick = function () { api('POST', '/admin/logout').then(function () { location.reload(); }); };
  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
      e.preventDefault(); var b = S.tab === 'members' ? $('#save') : S.tab === 'card' ? $('#cssave') : $('#rsave'); if (b && !b.disabled) b.click();
    }
  });
  window.addEventListener('beforeunload', function (e) { if (dirty()) { e.preventDefault(); e.returnValue = ''; } });
  load();
})();
`;

export function buildAdminPage(base: string): string {
  return shell(
    "管理画面 — TECH CLUB",
    `<header class="bar">
  <h1>管理</h1>
  <nav class="tabs"><button type="button" data-tab="members" class="on">メンバー</button><button type="button" data-tab="roles">肩書き</button><button type="button" data-tab="card">名刺</button><button type="button" data-tab="import">名簿取り込み</button></nav>
  <span class="sp"></span>
  <a class="jump" href="/preview" target="_blank" rel="noopener">名刺プレビュー ↗</a>
  <button class="linkbtn" id="logout" type="button">ログアウト</button>
</header>
<main class="main" id="app"><div class="loading">読み込み中…</div></main>
<dialog id="dlg"></dialog>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<script>${JS}</script>`,
    ` data-base="${escapeXml(base)}"`,
  );
}

/** テスト用: クライアント JS の素の文字列 */
export const ADMIN_CLIENT_JS = JS;
