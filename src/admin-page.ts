/**
 * 管理画面 /admin の HTML（ログイン画面 / 本体）。
 * 本体は 1 枚の SPA。API は src/admin.ts。クライアント JS はテンプレートリテラル内なので
 * バッククォートと dollar-brace は使わないこと。
 */
import { escapeXml } from "./card-template";

const CSS = `
:root{--bg:#09090b;--panel:#0f0f12;--panel2:#15151a;--line:#222228;--line2:#2e2e36;--tx:#e8e8ec;--mut:#8b8b96;--dim:#5c5c66;
  --acc:#5aa9ff;--acc2:rgba(90,169,255,.15);--ok:#4ade80;--err:#f87171;--warn:#fbbf24;color-scheme:dark}
*{box-sizing:border-box}
html,body{height:100%;margin:0}
body{background:var(--bg);color:var(--tx);font:14px/1.6 "Inter",-apple-system,"Hiragino Kaku Gothic ProN","Yu Gothic",system-ui,sans-serif;
  -webkit-font-smoothing:antialiased;display:flex;flex-direction:column}
button,input,select,textarea{font:inherit;color:inherit}
button{cursor:pointer}
a{color:var(--acc);text-decoration:none}
a:hover{text-decoration:underline}

/* top */
.bar{flex:none;height:52px;display:flex;align-items:center;gap:14px;padding:0 16px;border-bottom:1px solid var(--line);background:var(--panel)}
.bar h1{margin:0;font-size:14px;font-weight:800;letter-spacing:.06em}
.tabs{display:flex;gap:2px;background:var(--panel2);border:1px solid var(--line);border-radius:9px;padding:2px}
.tabs button{border:0;background:transparent;color:var(--mut);padding:5px 16px;border-radius:7px;font-size:13px;font-weight:500}
.tabs button.on{background:#2a2a32;color:var(--tx)}
.sp{flex:1}
.bar a,.linkbtn{font-size:12.5px;color:var(--mut)}
.bar a:hover,.linkbtn:hover{color:var(--tx);text-decoration:none}
.linkbtn{background:none;border:0;padding:4px 6px}

/* buttons / inputs */
.btn{background:var(--panel2);border:1px solid var(--line2);border-radius:9px;padding:8px 16px;font-size:13px;font-weight:600}
.btn:hover:not(:disabled){border-color:var(--dim)}
.btn:disabled{opacity:.4;cursor:default}
.btn.primary{background:#f4f4f5;color:#0a0a0c;border-color:#f4f4f5}
.btn.primary:hover:not(:disabled){background:#fff}
.btn.danger{color:var(--err);border-color:#4a2222;background:transparent}
.btn.danger:hover:not(:disabled){background:#2a1414;border-color:var(--err)}
.btn.sm{padding:5px 11px;font-size:12px}
.in{width:100%;background:var(--panel2);border:1px solid var(--line);border-radius:9px;padding:9px 11px;font-size:14px;outline:none}
.in:focus{border-color:var(--acc);box-shadow:0 0 0 3px var(--acc2)}
.in.err{border-color:var(--err);box-shadow:0 0 0 3px rgba(248,113,113,.14)}
.in[readonly]{color:var(--mut);background:#101014}
select.in{appearance:none;background-image:linear-gradient(45deg,transparent 50%,var(--mut) 50%),linear-gradient(135deg,var(--mut) 50%,transparent 50%);
  background-position:calc(100% - 17px) 50%,calc(100% - 12px) 50%;background-size:5px 5px;background-repeat:no-repeat;padding-right:32px}

/* members */
.main{flex:1;min-height:0}
.mview{height:100%;display:grid;grid-template-columns:340px 1fr}
.list{border-right:1px solid var(--line);background:var(--panel);display:flex;flex-direction:column;min-height:0}
.list .tools{display:flex;gap:8px;padding:12px;border-bottom:1px solid var(--line)}
.list .tools .btn{white-space:nowrap;flex:none}
.list ul{list-style:none;margin:0;padding:6px;overflow:auto;flex:1}
.item{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;cursor:pointer;border:1px solid transparent}
.item:hover{background:var(--panel2)}
.item.on{background:var(--acc2);border-color:rgba(90,169,255,.35)}
.av{width:36px;height:36px;border-radius:50%;background:#1d1d24;border:1px solid var(--line2);display:grid;place-items:center;font-weight:700;font-size:14px;flex:none}
.item .nm{font-weight:600;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.item .sub{font:11.5px "Courier New",monospace;color:var(--dim)}
.item .meta{margin-left:auto;display:flex;flex-direction:column;align-items:flex-end;gap:3px}
.tag{font-size:10.5px;padding:1px 8px;border-radius:99px;border:1px solid var(--line2);color:var(--mut);white-space:nowrap}
.tag.on{color:var(--ok);border-color:#1f5a35;background:#0c1d13}
.tag.off{color:var(--dim)}
.tag.fwd{color:var(--warn);border-color:#5a4713}
.empty{color:var(--mut);padding:36px 20px;text-align:center}

.formwrap{overflow:auto;min-height:0}
.form{max-width:680px;margin:0 auto;padding:26px 28px 120px}
.fhead{display:flex;align-items:center;gap:14px;margin-bottom:6px}
.fhead h2{margin:0;font-size:20px;font-weight:800}
.fhead .back{display:none}
.links{display:flex;gap:14px;flex-wrap:wrap;font-size:12.5px;margin:2px 0 18px}
.sec{border:1px solid var(--line);background:var(--panel);border-radius:14px;padding:18px 18px 6px;margin-bottom:16px}
.sec>h3{margin:0 0 14px;font-size:11px;letter-spacing:.14em;color:var(--dim);font-weight:700}
.fld{margin-bottom:16px}
.fld>label{display:block;font-size:12.5px;color:var(--mut);margin-bottom:6px;font-weight:500}
.hint{font-size:12px;color:var(--dim);margin-top:6px;line-height:1.5}
.errmsg{font-size:12px;color:var(--err);margin-top:6px}
.two{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.pre{display:flex;align-items:stretch}
.pre>span{display:grid;place-items:center;padding:0 11px;background:#101014;border:1px solid var(--line);border-right:0;border-radius:9px 0 0 9px;color:var(--dim);font:12.5px "Courier New",monospace;white-space:nowrap}
.pre>.in{border-radius:0 9px 9px 0}
.sw,.fld>label.sw{display:flex;align-items:center;gap:12px;cursor:pointer;user-select:none;margin:0;font-size:14px;color:var(--tx)}
.sw input{display:none}
.sw .knob{width:42px;height:24px;border-radius:99px;background:#2a2a32;position:relative;transition:.15s;flex:none}
.sw .knob::after{content:"";position:absolute;left:3px;top:3px;width:18px;height:18px;border-radius:50%;background:#fff;transition:.15s}
.sw input:checked+.knob{background:#22c55e}
.sw input:checked+.knob::after{left:21px}
.sw b{font-weight:600}
.sw small{display:block;color:var(--dim);font-size:12px;font-weight:400}
.en{display:inline-block;margin-top:8px;font:12.5px "Courier New",monospace;color:var(--mut);background:#101014;border:1px solid var(--line);padding:2px 10px;border-radius:7px}
.chips{display:flex;flex-wrap:wrap;gap:7px;padding:7px;background:var(--panel2);border:1px solid var(--line);border-radius:9px;cursor:text}
.chips:focus-within{border-color:var(--acc);box-shadow:0 0 0 3px var(--acc2)}
.chips.err{border-color:var(--err)}
.chip{display:inline-flex;align-items:center;gap:6px;background:#1d1d24;border-left:2.5px solid rgba(255,255,255,.5);border-radius:4px;padding:3px 6px 3px 10px;font:12.5px "Courier New",monospace}
.chip.dim{opacity:.55}
.chip button{border:0;background:none;color:var(--dim);padding:0 3px;font-size:14px;line-height:1}
.chip button:hover{color:var(--err)}
.chips input{flex:1;min-width:120px;background:none;border:0;outline:none;padding:4px 6px;font-size:14px}
.seg2{display:flex;background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:3px;gap:3px}
.seg2 button{flex:1;border:0;background:transparent;color:var(--mut);padding:8px 10px;border-radius:8px;font-size:13px;font-weight:600}
.seg2 button.on{background:#2c2c35;color:var(--tx)}
.qr{display:flex;gap:8px;align-items:center;margin-top:12px;padding:10px 12px;background:#101014;border:1px solid var(--line);border-radius:9px;font:12px "Courier New",monospace;color:var(--mut);word-break:break-all}
.qr span{flex:1}
.actions{position:sticky;bottom:0;margin:0 -28px;padding:14px 28px;display:flex;gap:10px;align-items:center;background:linear-gradient(to top,var(--bg) 70%,transparent)}
.actions .sp{flex:1}
.dirty-note{font-size:12px;color:var(--warn)}

/* roles */
.rview{max-width:760px;margin:0 auto;padding:26px 28px 100px}
.rview h2{margin:0 0 4px;font-size:20px;font-weight:800}
.rview .lead{color:var(--mut);font-size:13px;margin:0 0 18px}
.rrow{display:grid;grid-template-columns:auto 1fr 1fr auto auto;gap:10px;align-items:center;margin-bottom:10px}
.rrow .mv{display:flex;flex-direction:column;gap:2px}
.rrow .mv button{border:1px solid var(--line);background:var(--panel2);color:var(--mut);width:26px;height:20px;border-radius:5px;font-size:10px;line-height:1;padding:0}
.rrow .mv button:hover:not(:disabled){color:var(--tx)}
.rrow .mv button:disabled{opacity:.25;cursor:default}
.rrow .use{font-size:12px;color:var(--dim);white-space:nowrap;min-width:54px;text-align:right}
.rhead{display:grid;grid-template-columns:34px 1fr 1fr 54px 78px;gap:10px;font-size:11px;color:var(--dim);letter-spacing:.1em;margin:0 0 6px}
.note{padding:11px 14px;border-radius:10px;font-size:12.5px;margin:14px 0;background:#1b1810;border:1px solid #4a3d12;color:#e8d9a0}
.note.info{background:var(--panel);border-color:var(--line);color:var(--mut)}

/* misc */
dialog{background:var(--panel);color:var(--tx);border:1px solid var(--line2);border-radius:16px;padding:24px;max-width:420px;width:calc(100% - 32px);box-shadow:0 30px 80px rgba(0,0,0,.6)}
dialog::backdrop{background:rgba(0,0,0,.6)}
dialog p{margin:0 0 18px;line-height:1.7}
dialog .row{display:flex;justify-content:flex-end;gap:10px}
.toast{position:fixed;left:50%;bottom:28px;transform:translate(-50%,12px);background:#1d1d23;border:1px solid var(--line2);border-radius:11px;padding:10px 18px;
  font-size:13px;opacity:0;pointer-events:none;transition:.18s;box-shadow:0 12px 34px rgba(0,0,0,.5);z-index:50;max-width:calc(100% - 32px)}
.toast.show{opacity:1;transform:translate(-50%,0)}
.toast.ok{border-color:#1f6b3b;color:#b6f5cc}
.toast.err{border-color:#7a2a2a;color:#fecaca}
.loading{padding:60px;text-align:center;color:var(--mut)}

@media (max-width:860px){
  .mview{grid-template-columns:1fr}
  .mview.picked .list{display:none}
  .mview:not(.picked) .formwrap{display:none}
  .fhead .back{display:inline-block}
  .form{padding:18px 16px 120px}.actions{margin:0 -16px;padding:12px 16px}
  .two{grid-template-columns:1fr}
  .bar{gap:8px;padding:0 10px}.bar .jump{display:none}
  .rrow{grid-template-columns:auto 1fr auto}.rrow .en-in{grid-column:2/-1}.rhead{display:none}
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
    `<div style="margin:auto;max-width:460px;padding:24px;text-align:center">
  <h1 style="font-size:18px">管理画面はまだ有効になっていません</h1>
  <p style="color:var(--mut)">安全のため、パスワード（シークレット <code>ADMIN_PASSWORD</code>）を設定するまで管理画面は使えません。</p>
  <p style="color:var(--dim);font:12.5px 'Courier New',monospace">npx wrangler secret put ADMIN_PASSWORD</p>
</div>`,
  );
}

export function buildLoginPage(): string {
  return shell(
    "ログイン — 管理画面",
    `<form id="f" style="margin:auto;width:100%;max-width:360px;padding:24px">
  <h1 style="font-size:20px;margin:0 0 4px;font-weight:800">管理画面</h1>
  <p style="color:var(--mut);margin:0 0 22px;font-size:13px">TECH CLUB のメンバーデータを編集します。</p>
  <label for="pw" style="display:block;font-size:12.5px;color:var(--mut);margin-bottom:6px">パスワード</label>
  <input id="pw" class="in" type="password" autocomplete="current-password" autofocus required>
  <div id="err" class="errmsg" style="min-height:20px"></div>
  <button class="btn primary" style="width:100%;margin-top:8px" id="go">ログイン</button>
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
            mode: 'profile', q: '', rdraft: null, rorig: null, busy: false };

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
    clearTimeout(toastT); toastT = setTimeout(function () { t.className = 'toast'; }, 3200);
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
  function memberDirty() { return S.draft && S.orig && (strip(S.draft) !== strip(S.orig) || (S.mode === 'profile') !== !S.orig.targetUrl); }
  function rolesDirty() { return S.rdraft && JSON.stringify(S.rdraft.map(pick)) !== JSON.stringify(S.rorig.map(pick)); }
  function pick(r) { return { jp: r.jp, en: r.en }; }
  function dirty() { return S.tab === 'members' ? memberDirty() : rolesDirty(); }
  function guard() { return dirty() ? ask('保存していない変更があります。破棄して移動しますか？', '破棄して移動', true) : Promise.resolve(true); }
  function enOf(jp) { for (var i = 0; i < S.roles.length; i++) if (S.roles[i].jp === jp) return S.roles[i].en; return ''; }

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
    var add = mk('button', 'btn primary sm', '＋ 追加'); add.type = 'button';
    add.onclick = function () { select('__new'); };
    tools.appendChild(q); tools.appendChild(add); list.appendChild(tools);
    var ul = mk('ul'); ul.id = 'items'; list.appendChild(ul);
    var fw = mk('section', 'formwrap'); fw.id = 'fw';
    v.appendChild(list); v.appendChild(fw); app.appendChild(v);
    drawItems(); drawForm();
  }

  function drawItems() {
    var ul = $('#items'); if (!ul) return; ul.innerHTML = '';
    var q = S.q.trim().toLowerCase();
    var rows = S.members.filter(function (m) { return !q || (m.id + ' ' + m.nameJp + ' ' + m.nameEn).toLowerCase().indexOf(q) >= 0; });
    if (!rows.length) { ul.appendChild(mk('li', 'empty', S.members.length ? '見つかりません' : 'まだメンバーがいません。「＋ 追加」から登録できます。')); return; }
    rows.forEach(function (m) {
      var li = mk('li', 'item' + (m.id === S.sel ? ' on' : ''));
      li.innerHTML = '<div class="av">' + initial(m) + '</div><div style="min-width:0"><div class="nm">' + esc(m.nameJp || '（名前未設定）') +
        '</div><div class="sub">' + esc(m.id) + '</div></div><div class="meta"><span class="tag ' + (m.active ? 'on' : 'off') + '">' + (m.active ? '公開' : '停止') +
        '</span>' + (m.targetUrl ? '<span class="tag fwd">転送</span>' : '') + '</div>';
      li.onclick = function () { select(m.id); };
      ul.appendChild(li);
    });
  }

  function select(id) {
    if (id === S.sel) return;
    guard().then(function (ok) {
      if (!ok) return;
      S.sel = id;
      if (id === '__new') { S.draft = blank(); S.orig = blank(); S.mode = 'profile'; }
      else { var m = S.members.filter(function (x) { return x.id === id; })[0]; S.draft = clone(m); S.orig = clone(m); S.mode = m.targetUrl ? 'redirect' : 'profile'; }
      renderMembers();
    });
  }

  function field(label, control, hint, key) {
    var f = mk('div', 'fld'); if (key) f.setAttribute('data-f', key);
    if (label) f.appendChild(mk('label', '', esc(label)));
    f.appendChild(control);
    if (hint) f.appendChild(mk('div', 'hint', hint));
    f.appendChild(mk('div', 'errmsg')); return f;
  }
  function textIn(key, opts) {
    opts = opts || {};
    var i = mk('input', 'in'); i.type = opts.type || 'text'; i.value = S.draft[key] || ''; i.placeholder = opts.ph || ''; i.maxLength = opts.max || 100;
    i.autocomplete = 'off'; if (opts.readonly) i.readOnly = true; if (opts.mono) i.style.fontFamily = '"Courier New",monospace';
    i.oninput = function () { S.draft[key] = i.value; touch(key); };
    return i;
  }
  function prefixed(prefix, input) { var w = mk('div', 'pre'); w.appendChild(mk('span', '', esc(prefix))); w.appendChild(input); return w; }

  function drawForm() {
    var fw = $('#fw'); if (!fw) return; fw.innerHTML = '';
    if (!S.sel) { fw.appendChild(mk('div', 'empty', '左の一覧からメンバーを選ぶか、「＋ 追加」で新しく登録します。')); return; }
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
        '<a href="/preview/' + encodeURIComponent(d.id) + '" target="_blank" rel="noopener">名刺を見る ↗</a>' +
        '<a href="/profile/' + encodeURIComponent(d.id) + '" target="_blank" rel="noopener">プロフィールを見る ↗</a>'));
    }

    /* 基本 */
    var s1 = mk('section', 'sec'); s1.appendChild(mk('h3', '', '基本'));
    var idIn = textIn('id', { readonly: !isNew, mono: true, max: 64, ph: 'taro  （半角英数字・ . _ -）' });
    s1.appendChild(field('ID', idIn, isNew ? 'QRコードのURLに使われます。<b>あとから変更できません</b>（印刷済みQRが無効になるため）。' : 'QRのURLに使われているため変更できません。', 'id'));
    var sw = mk('label', 'sw'); var cb = mk('input'); cb.type = 'checkbox'; cb.checked = d.active;
    cb.onchange = function () { d.active = cb.checked; touch('active'); };
    sw.appendChild(cb); sw.appendChild(mk('span', 'knob')); sw.appendChild(mk('span', '', '<b>公開する</b><small>OFF にすると QR・プロフィールが 404 になります</small>'));
    var fa = mk('div', 'fld'); fa.appendChild(sw); s1.appendChild(fa);
    form.appendChild(s1);

    /* 名前・肩書き */
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
    var en = mk('span', 'en'); function setEn() { en.textContent = '英語表記: ' + (enOf(d.role) || '—'); en.style.display = d.role ? '' : 'none'; } setEn();
    sel.onchange = function () { d.role = sel.value; d.roleEn = enOf(d.role); setEn(); touch('role'); };
    var rf = field('肩書き', sel, '', 'role'); rf.insertBefore(en, rf.querySelector('.errmsg'));
    var more = mk('div', 'hint', '選択肢を増やす・英訳を直すには「肩書き」タブへ。'); rf.insertBefore(more, rf.querySelector('.errmsg'));
    s2.appendChild(rf); form.appendChild(s2);

    /* 連絡先 */
    var s3 = mk('section', 'sec'); s3.appendChild(mk('h3', '', '連絡先'));
    s3.appendChild(field('メール', textIn('email', { type: 'email', max: 100, ph: 'taro@example.com' }), '', 'email'));
    var two2 = mk('div', 'two');
    two2.appendChild(field('GitHub', prefixed('github.com/', textIn('githubId', { max: 80, ph: 'taro-dev', mono: true })), '', 'githubId'));
    two2.appendChild(field('X', prefixed('@', textIn('xId', { max: 80, ph: 'taro_dev', mono: true })), '', 'xId'));
    s3.appendChild(two2); form.appendChild(s3);

    /* スキル */
    var s4 = mk('section', 'sec'); s4.appendChild(mk('h3', '', 'スキル'));
    s4.appendChild(field('', tagInput(), '名刺に載るのは<b>先頭の3つ</b>です（プロフィールには全部載ります）。Enter か「,」で追加。', 'skills'));
    form.appendChild(s4);

    /* QR の行き先 */
    var s5 = mk('section', 'sec'); s5.appendChild(mk('h3', '', 'QRコードの行き先'));
    var seg = mk('div', 'seg2');
    var b1 = mk('button', S.mode === 'profile' ? 'on' : '', 'プロフィールページ'), b2 = mk('button', S.mode === 'redirect' ? 'on' : '', '別のURLへ転送');
    b1.type = b2.type = 'button';
    var urlWrap = mk('div'); urlWrap.style.marginTop = '14px';
    var urlIn = textIn('targetUrl', { max: 500, ph: 'https://example.com/portfolio', mono: true });
    urlWrap.appendChild(field('転送先URL', urlIn, '', 'targetUrl'));
    function applyMode() {
      b1.classList.toggle('on', S.mode === 'profile'); b2.classList.toggle('on', S.mode === 'redirect');
      urlWrap.style.display = S.mode === 'redirect' ? '' : 'none';
    }
    b1.onclick = function () { S.mode = 'profile'; applyMode(); touch('mode'); };
    b2.onclick = function () { S.mode = 'redirect'; applyMode(); touch('mode'); urlIn.focus(); };
    seg.appendChild(b1); seg.appendChild(b2); s5.appendChild(seg); s5.appendChild(urlWrap);
    var qrUrl = BASE + '/p/' + (d.id || '…');
    var qr = mk('div', 'qr', '<span>' + esc(qrUrl) + '</span>');
    if (!isNew) { var cp = mk('button', 'btn sm', 'コピー'); cp.type = 'button'; cp.onclick = function () { (navigator.clipboard ? navigator.clipboard.writeText(qrUrl) : Promise.reject()).then(function () { toast('QRのURLをコピーしました', 'ok'); }, function () { toast('コピーできませんでした'); }); }; qr.appendChild(cp); }
    s5.appendChild(mk('div', 'hint', 'QRに入っているURL。どちらを選んでも <b>QRは作り直し不要</b>です。'));
    s5.appendChild(qr); form.appendChild(s5);
    applyMode();

    /* 操作 */
    var act = mk('div', 'actions');
    var save = mk('button', 'btn primary', isNew ? '追加する' : '保存'); save.type = 'button'; save.id = 'save'; save.onclick = saveMember;
    var reset = mk('button', 'btn', '元に戻す'); reset.type = 'button'; reset.id = 'revert';
    reset.onclick = function () { S.draft = clone(S.orig); S.mode = S.orig.targetUrl ? 'redirect' : 'profile'; drawForm(); };
    var note = mk('span', 'dirty-note'); note.id = 'dnote';
    act.appendChild(save); act.appendChild(reset); act.appendChild(note); act.appendChild(mk('span', 'sp'));
    if (!isNew) {
      var del = mk('button', 'btn danger', '削除'); del.type = 'button'; del.onclick = deleteMember; act.appendChild(del);
    }
    form.appendChild(act); fw.appendChild(form);
    refreshState();
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

  function clearErrors() {
    [].forEach.call(document.querySelectorAll('.fld .errmsg'), function (e) { e.textContent = ''; });
    [].forEach.call(document.querySelectorAll('.in.err,.chips.err'), function (e) { e.classList.remove('err'); });
  }
  function showError(field, msg) {
    var f = field && document.querySelector('[data-f="' + field + '"]');
    if (!f) { toast(msg, 'err'); return; }
    f.querySelector('.errmsg').textContent = msg;
    var c = f.querySelector('.in,.chips'); if (c) c.classList.add('err');
    f.scrollIntoView({ block: 'center', behavior: 'smooth' });
    var i = f.querySelector('input,select'); if (i) i.focus();
  }
  function touch(key) {
    var f = key && document.querySelector('[data-f="' + key + '"]');
    if (f) { f.querySelector('.errmsg').textContent = ''; var c = f.querySelector('.in,.chips'); if (c) c.classList.remove('err'); }
    refreshState();
  }
  function refreshState() {
    var save = $('#save'); if (!save) return;
    var isNew = S.sel === '__new', d = dirty();
    save.disabled = S.busy || (!isNew && !d) || (isNew && !S.draft.id.trim());
    var rv = $('#revert'); if (rv) rv.disabled = !d;
    var n = $('#dnote'); if (n) n.textContent = d ? '● 未保存の変更があります' : '';
  }

  function payload() {
    var d = clone(S.draft); delete d.roleEn;
    if (S.mode === 'profile') d.targetUrl = '';
    return d;
  }
  function saveMember() {
    if (S.busy) return; clearErrors();
    if (S.mode === 'redirect' && !S.draft.targetUrl.trim()) { showError('targetUrl', '転送先のURLを入力するか、「プロフィールページ」を選んでください'); return; }
    var isNew = S.sel === '__new'; S.busy = true; refreshState();
    var req = isNew ? api('POST', '/admin/api/members', payload()) : api('PATCH', '/admin/api/members/' + encodeURIComponent(S.draft.id), payload());
    req.then(function (j) {
      var m = j.member, i = -1;
      S.members.forEach(function (x, k) { if (x.id === m.id) i = k; });
      if (i >= 0) S.members[i] = m; else { S.members.push(m); S.members.sort(function (a, b) { return a.id < b.id ? -1 : 1; }); }
      S.sel = m.id; S.draft = clone(m); S.orig = clone(m); S.mode = m.targetUrl ? 'redirect' : 'profile';
      refreshUsage(); toast(isNew ? 'メンバーを追加しました' : '保存しました（QR・プロフィールにはすぐ反映されます）', 'ok');
      renderMembers();
    }).catch(function (e) { showError(e.field, e.message); }).then(function () { S.busy = false; refreshState(); });
  }
  function deleteMember() {
    var d = S.draft;
    ask('「' + (d.nameJp || d.id) + '」を削除します。QR・プロフィールは 404 になります。Notion のゴミ箱から復元できます。', '削除する', true).then(function (ok) {
      if (!ok) return;
      api('DELETE', '/admin/api/members/' + encodeURIComponent(d.id)).then(function () {
        S.members = S.members.filter(function (m) { return m.id !== d.id; });
        S.sel = null; S.draft = S.orig = null; refreshUsage(); toast('削除しました', 'ok'); renderMembers();
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
    v.appendChild(mk('p', 'lead', 'メンバーの「肩書き」で選べる一覧と、名刺に出る英語表記を管理します。保存すると Notion の Role の選択肢と Role_EN の数式が更新されます。'));
    if (S.warnings.length) v.appendChild(mk('div', 'note', esc(S.warnings.join(' / '))));
    v.appendChild(mk('div', 'rhead', '<span></span><span>日本語</span><span>ENGLISH（名刺の英語表記）</span><span style="text-align:right">使用</span><span></span>'));
    var rows = mk('div'); rows.id = 'rrows'; v.appendChild(rows);
    var add = mk('button', 'btn', '＋ 肩書きを追加'); add.type = 'button';
    add.onclick = function () { S.rdraft.push({ jp: '', en: '', orig: false }); drawRoleRows(); var ins = rows.querySelectorAll('input'); ins[ins.length - 2].focus(); refreshRoles(); };
    v.appendChild(add);
    v.appendChild(mk('div', 'note info', '使用中の肩書き（右の「使用」が 1 以上）は、削除・日本語の名前変更はできません。先にメンバー側の肩書きを変更してください。英語表記はいつでも直せます。'));
    var act = mk('div', 'actions'); act.style.margin = '0 -28px';
    var save = mk('button', 'btn primary', '保存'); save.id = 'rsave'; save.type = 'button'; save.onclick = saveRolesNow;
    var rv = mk('button', 'btn', '元に戻す'); rv.id = 'rrevert'; rv.type = 'button';
    rv.onclick = function () { S.rdraft = clone(S.rorig); drawRoleRows(); refreshRoles(); };
    var note = mk('span', 'dirty-note'); note.id = 'rnote';
    act.appendChild(save); act.appendChild(rv); act.appendChild(note); v.appendChild(act);
    app.appendChild(v); drawRoleRows(); refreshRoles();
  }
  function drawRoleRows() {
    var host = $('#rrows'); host.innerHTML = '';
    S.rdraft.forEach(function (r, i) {
      var used = r.orig ? (S.usage[r.jp] || 0) : 0;
      var row = mk('div', 'rrow');
      var mv = mk('div', 'mv'); var up = mk('button', '', '▲'), dn = mk('button', '', '▼'); up.type = dn.type = 'button';
      up.disabled = i === 0; dn.disabled = i === S.rdraft.length - 1;
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
    $('#rnote').textContent = p && d ? p : (d ? '● 未保存の変更があります' : '');
    $('#rnote').style.color = p && d ? 'var(--err)' : '';
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
      S.tab = t; render(); }); };
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
