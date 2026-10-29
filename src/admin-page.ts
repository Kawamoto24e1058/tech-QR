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
            mode: 'profile', q: '', filter: 'all', rdraft: null, rorig: null, busy: false, side: 'front', pvOpen: false, touched: {} };

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
  function blank() { return { id: '', active: true, targetUrl: '', nameJp: '', nameEn: '', role: '', roleEn: '', email: '', githubId: '', xId: '', skills: [] }; }
  function strip(d) { var c = clone(d); delete c.roleEn; return JSON.stringify(c); }
  function memberDirty() { return !!(S.draft && S.orig && (strip(S.draft) !== strip(S.orig) || (S.mode === 'profile') !== !S.orig.targetUrl)); }
  function pick(r) { return { jp: r.jp, en: r.en }; }
  function rolesDirty() { return !!(S.rdraft && JSON.stringify(S.rdraft.map(pick)) !== JSON.stringify(S.rorig.map(pick))); }
  function dirty() { return S.tab === 'members' ? memberDirty() : rolesDirty(); }
  function guard() { return dirty() ? ask('保存していない変更があります。破棄して移動しますか？', '破棄して移動', true) : Promise.resolve(true); }
  function enOf(jp) { for (var i = 0; i < S.roles.length; i++) if (S.roles[i].jp === jp) return S.roles[i].en; return ''; }
  function normHandle(raw, hosts) {
    var s = String(raw || '').trim().replace(/^@/, '');
    hosts.forEach(function (h) { s = s.replace(new RegExp('^https?://(www\\.)?' + h.replace(/\./g, '\\.') + '/', 'i'), ''); });
    return s.replace(/[\/\s]+$/, '');
  }

  /* ── 読み込み ── */
  function load() {
    return Promise.all([api('GET', '/admin/api/members'), api('GET', '/admin/api/roles')]).then(function (r) {
      S.members = r[0].members; S.roles = r[1].roles; S.usage = r[1].usage; S.warnings = r[1].warnings || [];
      S.rdraft = S.roles.map(function (x) { return { jp: x.jp, en: x.en, orig: true }; }); S.rorig = clone(S.rdraft);
      render();
    }).catch(function (e) { $('#app').innerHTML = '<div class="loading">読み込みに失敗しました: ' + esc(e.message) + '</div>'; });
  }

  /* ── 描画 ── */
  function render() {
    [].forEach.call(document.querySelectorAll('.tabs button'), function (b) { b.classList.toggle('on', b.getAttribute('data-tab') === S.tab); });
    if (S.tab === 'members') renderMembers(); else renderRoles();
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
    var counts = { all: S.members.length, on: 0, off: 0, fwd: 0 };
    S.members.forEach(function (m) { if (m.active) counts.on++; else counts.off++; if (m.targetUrl) counts.fwd++; });
    [['all', 'すべて'], ['on', '公開'], ['off', '停止'], ['fwd', '転送あり']].forEach(function (f) {
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
      return !q || (m.id + ' ' + m.nameJp + ' ' + m.nameEn + ' ' + m.role).toLowerCase().indexOf(q) >= 0;
    });
    if (!rows.length) { ul.appendChild(mk('li', 'empty', S.members.length ? '条件に合うメンバーがいません' : 'まだメンバーがいません。<br>「＋ 追加」から登録できます。')); return; }
    rows.forEach(function (m) {
      var on = m.id === S.sel;
      var li = mk('li', 'item' + (on ? ' on' : '') + (m.active ? '' : ' off'));
      li.innerHTML = '<div class="av">' + initial(m) + '</div><div class="txt"><div class="nm">' + esc(m.nameJp || '（名前未設定）') +
        '</div><div class="sub">' + (m.role ? esc(m.role) + ' · ' : '') + '<code>' + esc(m.id) + '</code></div></div><div class="meta">' +
        (on && memberDirty() ? '<span class="dot" title="未保存の変更"></span>' : '') +
        '<span class="tag ' + (m.active ? 'on' : 'off') + '">' + (m.active ? '公開' : '停止') + '</span>' + (m.targetUrl ? '<span class="tag fwd">転送</span>' : '') + '</div>';
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
    sel.onchange = function () { d.role = sel.value; d.roleEn = enOf(d.role); setEn(); touch('role'); };
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
    fetch('/admin/api/preview', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ side: S.side, member: d }) })
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

  /* ── 起動 ── */
  [].forEach.call(document.querySelectorAll('.tabs button'), function (b) {
    b.onclick = function () { var t = b.getAttribute('data-tab'); if (t === S.tab) return; guard().then(function (ok) { if (!ok) return;
      if (S.tab === 'members') { S.draft = S.orig = null; S.sel = null; } else { S.rdraft = clone(S.rorig); }
      S.tab = t; lastDirty = null; render(); }); };
  });
  $('#logout').onclick = function () { api('POST', '/admin/logout').then(function () { location.reload(); }); };
  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
      e.preventDefault(); var b = S.tab === 'members' ? $('#save') : $('#rsave'); if (b && !b.disabled) b.click();
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
  <nav class="tabs"><button type="button" data-tab="members" class="on">メンバー</button><button type="button" data-tab="roles">肩書き</button></nav>
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
