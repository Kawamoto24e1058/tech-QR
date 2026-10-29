/**
 * ビジュアルレイアウトエディタ（GET /editor）
 *
 * 操作系:
 *  - カード上の要素を直接クリックで選択 / 本体をドラッグで移動 / 角のハンドルでリサイズ
 *  - スナップガイド（カード中央・余白線・他要素の端/中心）。Shift=軸固定 / Alt=スナップ解除
 *  - 矢印キーで 1px（Shift で 10px）、Delete で非表示、⌘Z / ⇧⌘Z で元に戻す/やり直す、⌘S で保存
 *  - ズーム（ボタン / ⌘+ホイール）、レイヤー一覧（表示切替）、数値ラベルのドラッグ調整
 *  - プレビューデータ: サンプル / 長い名前 / 実メンバー
 *  - 位置・サイズ・色などの変更は DOM に即時反映し、サーバー描画で後から整合させる
 *
 * 認証なし（誰でも編集可）。保存は明示操作のみ。「初期化」は未保存の状態に戻すだけ（取り消し可）。
 */
import type { CardFields } from "./card-template";

export const SAMPLE_FIELDS: CardFields = {
  nameJp: "山田 太郎",
  nameEn: "Taro Yamada",
  roleJp: "部長",
  roleEn: "President",
  email: "taro@example.com",
  githubId: "taro-dev",
  xId: "taro_dev",
  skillTags: ["TypeScript", "Cloudflare", "UI/UX Design"],
};

/** 長い文字列でのはみ出し確認用 */
export const SAMPLE_FIELDS_LONG: CardFields = {
  nameJp: "一ノ瀬 ジョナサン太郎",
  nameEn: "Jonathan Ichinose-Yamada",
  roleJp: "副部長",
  roleEn: "Vice President",
  email: "jonathan.ichinose@example-univ.ac.jp",
  githubId: "jonathan-ichinose",
  xId: "jonathan_i",
  skillTags: ["TypeScript", "Cloudflare Workers", "UI/UX Design"],
};

const EDITOR_CSS = `
:root{--bg:#09090b;--panel:#0f0f12;--panel2:#15151a;--line:#222228;--line2:#2e2e36;--tx:#e8e8ec;--mut:#8b8b96;--dim:#5c5c66;
  --acc:#5aa9ff;--acc2:rgba(90,169,255,.16);--ok:#4ade80;--err:#f87171;color-scheme:dark}
*{box-sizing:border-box}
html,body{height:100%;margin:0}
body{background:var(--bg);color:var(--tx);font:13px/1.5 "Inter",-apple-system,"Hiragino Kaku Gothic ProN","Yu Gothic",system-ui,sans-serif;
  display:flex;flex-direction:column;overflow:hidden;-webkit-font-smoothing:antialiased}
button,input,select{font:inherit;color:inherit}
button{cursor:pointer}
a{color:inherit}

/* ── top bar ── */
.bar{height:50px;flex:none;display:flex;align-items:center;gap:10px;padding:0 14px;border-bottom:1px solid var(--line);background:var(--panel)}
.bar .back{color:var(--mut);text-decoration:none;font-size:12px;white-space:nowrap}
.bar .back:hover{color:var(--tx)}
.bar h1{font-size:13px;font-weight:700;margin:0 4px 0 2px;letter-spacing:.04em;white-space:nowrap}
.bar .sp{flex:1}
.vr{width:1px;height:20px;background:var(--line2);margin:0 2px}
.ib{width:30px;height:30px;display:inline-grid;place-items:center;background:transparent;border:1px solid transparent;border-radius:7px;color:var(--mut);font-size:16px;line-height:1}
.ib:hover:not(:disabled){background:var(--panel2);color:var(--tx)}
.ib:disabled{opacity:.3;cursor:default}
.seg{display:inline-flex;background:var(--panel2);border:1px solid var(--line);border-radius:8px;padding:2px}
.seg button{background:transparent;border:0;border-radius:6px;padding:4px 14px;color:var(--mut);font-size:12px;font-weight:500}
.seg button.on{background:#2a2a32;color:var(--tx)}
.pick{background:var(--panel2);border:1px solid var(--line);border-radius:8px;padding:5px 8px;font-size:12px;max-width:190px;outline:none}
.pick:focus{border-color:var(--acc)}
.lbl{font-size:11px;color:var(--dim)}
.zoom{display:inline-flex;align-items:center;gap:2px}
.zoom .pct{min-width:44px;text-align:center;font-size:11px;color:var(--mut);font-variant-numeric:tabular-nums}
.btn{background:var(--panel2);border:1px solid var(--line2);border-radius:8px;padding:6px 12px;font-size:12px;font-weight:500}
.btn:hover{border-color:var(--dim)}
.btn.primary{background:#f4f4f5;color:#0a0a0c;border-color:#f4f4f5;font-weight:700;position:relative;padding-left:16px;padding-right:16px}
.btn.primary:hover:not(:disabled){background:#fff}
.btn.primary:disabled{background:var(--panel2);color:var(--dim);border-color:var(--line2);cursor:default}
.btn.primary.dirty::after{content:"";position:absolute;right:-3px;top:-3px;width:9px;height:9px;border-radius:50%;background:#fb923c;border:2px solid var(--panel)}
.btn.busy{opacity:.6;pointer-events:none}

/* ── 3 columns ── */
.app{flex:1;min-height:0;display:grid;grid-template-columns:212px 1fr 296px}
.layers,.inspector{background:var(--panel);overflow:auto;min-height:0}
.layers{border-right:1px solid var(--line);padding:12px 0}
.inspector{border-left:1px solid var(--line);padding:14px 16px 24px}
.layers h2{font-size:10.5px;letter-spacing:.14em;color:var(--dim);margin:0 14px 8px;font-weight:600}
#layers{list-style:none;margin:0;padding:0}
#layers li{display:flex;align-items:center;gap:8px;padding:6px 8px 6px 10px;margin:1px 6px;border-radius:7px;cursor:pointer;color:var(--mut)}
#layers li:hover{background:var(--panel2);color:var(--tx)}
#layers li.on{background:var(--acc2);color:var(--tx)}
#layers li.hid .nm{opacity:.38;text-decoration:line-through}
#layers .ti{width:18px;height:18px;border-radius:5px;background:var(--panel2);border:1px solid var(--line2);display:grid;place-items:center;font-size:10px;color:var(--mut);flex:none}
#layers .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}
#layers .eye{width:22px;height:22px;border:0;background:transparent;border-radius:5px;color:var(--dim);display:grid;place-items:center;flex:none;padding:0}
#layers .eye:hover{background:#26262d;color:var(--tx)}
#layers li.hid .eye{color:var(--dim)}

/* ── stage ── */
.stage{position:relative;overflow:auto;display:flex;padding:40px;
  background:radial-gradient(circle,#1a1a20 1px,transparent 1.2px) 0 0/22px 22px,#0b0b0e}
.board{position:relative;margin:auto;flex:none;touch-action:none;user-select:none;-webkit-user-select:none;cursor:default}
.board.over{cursor:move}
body.dragging,body.dragging *{cursor:grabbing!important}
body.scrubbing,body.scrubbing *{cursor:ew-resize!important;user-select:none}
.canvas svg{display:block;width:100%;height:auto;border-radius:3px;box-shadow:0 24px 70px rgba(0,0,0,.6),0 0 0 1px #2a2a31}
.overlay{position:absolute;inset:0;pointer-events:none}
.ob{position:absolute}
.ob.hover{border:1px solid rgba(90,169,255,.6);border-radius:2px}
.ob.sel{border:1.5px solid var(--acc);border-radius:2px;box-shadow:0 0 0 1px rgba(0,0,0,.35)}
.otag{position:absolute;left:-1.5px;bottom:100%;margin-bottom:2px;background:var(--acc);color:#04111f;font-size:10px;font-weight:700;
  padding:1px 7px;border-radius:4px;white-space:nowrap;letter-spacing:.02em}
.rh{position:absolute;width:11px;height:11px;background:#fff;border:1.5px solid var(--acc);border-radius:3px;transform:translate(-50%,-50%);
  pointer-events:auto;cursor:nwse-resize;box-shadow:0 1px 4px rgba(0,0,0,.5)}
.rh.bl{cursor:nesw-resize}
.guide{position:absolute;background:#ff5fa2;opacity:.95}
.guide.v{width:1px;top:0;bottom:0}
.guide.h{height:1px;left:0;right:0}

/* ── inspector ── */
.empty{color:var(--mut);font-size:12px;line-height:1.8}
.empty h3{margin:0 0 8px;font-size:13px;color:var(--tx)}
.empty kbd,.hint kbd{font:11px/1 "Courier New",monospace;background:var(--panel2);border:1px solid var(--line2);border-bottom-width:2px;border-radius:5px;padding:2px 5px;color:var(--tx)}
.empty ul{padding-left:0;list-style:none;margin:10px 0 0}
.empty li{display:flex;justify-content:space-between;gap:10px;padding:5px 0;border-bottom:1px solid var(--line)}
.ihead{display:flex;align-items:center;gap:10px;margin-bottom:6px;padding-bottom:12px;border-bottom:1px solid var(--line)}
.ihead .ticon{width:30px;height:30px;border-radius:8px;background:var(--acc2);color:var(--acc);display:grid;place-items:center;font-weight:700}
.iname{font-weight:700;font-size:13px}
.isub{font:11px "Courier New",monospace;color:var(--dim)}
.sec{padding:12px 0 6px;border-bottom:1px solid var(--line)}
.sec h3{margin:0 0 6px;font-size:10.5px;letter-spacing:.14em;color:var(--dim);font-weight:600}
.fld{display:grid;grid-template-columns:62px 1fr;gap:8px;align-items:center;margin:7px 0}
.fld>label{color:var(--mut);font-size:12px;user-select:none}
.fld>label.scrub{cursor:ew-resize}
.fld>label.scrub:hover{color:var(--tx)}
.fld input[type=number],.fld input[type=text]{width:100%;background:var(--panel2);border:1px solid var(--line);border-radius:7px;padding:5px 8px;font-size:12px;outline:none;font-variant-numeric:tabular-nums}
.fld input:focus{border-color:var(--acc);box-shadow:0 0 0 3px var(--acc2)}
.fld input[type=number]::-webkit-inner-spin-button{opacity:.3}
.seg2{display:flex;background:var(--panel2);border:1px solid var(--line);border-radius:7px;padding:2px;gap:2px}
.seg2 button{flex:1;background:transparent;border:0;border-radius:5px;padding:4px 2px;font-size:11.5px;color:var(--mut);white-space:nowrap}
.seg2 button:hover{color:var(--tx)}
.seg2 button.on{background:#2c2c35;color:var(--tx);font-weight:600}
.col{display:flex;flex-direction:column;align-items:flex-start;gap:9px}
.crow{display:flex;align-items:center;gap:8px}
.col input[type=color]{width:30px;height:28px;padding:0;border:1px solid var(--line2);border-radius:7px;background:none;cursor:pointer}
.col input[type=text]{width:84px!important;font-family:"Courier New",monospace}
.sw{width:18px;height:18px;border-radius:50%;border:1px solid #3a3a42;padding:0}
.sw:hover{transform:scale(1.15)}
.rng{display:flex;align-items:center;gap:8px}
.rng input[type=range]{flex:1;accent-color:var(--acc);min-width:0}
.rng output{width:38px;text-align:right;font-size:12px;color:var(--mut);font-variant-numeric:tabular-nums}
.note{font-size:11.5px;color:var(--mut);background:var(--panel2);border:1px solid var(--line);border-radius:7px;padding:7px 9px;margin:8px 0;line-height:1.6}
.acts{display:flex;gap:8px;margin-top:16px}
.acts .btn{flex:1}

/* ── misc ── */
.hint{flex:none;height:28px;display:flex;align-items:center;gap:16px;padding:0 14px;border-top:1px solid var(--line);background:var(--panel);color:var(--dim);font-size:11px;overflow:hidden;white-space:nowrap}
.hint span{display:inline-flex;align-items:center;gap:5px}
.toast{position:fixed;left:50%;bottom:48px;transform:translate(-50%,12px);background:#1d1d23;border:1px solid var(--line2);border-radius:10px;padding:9px 16px;
  font-size:12.5px;opacity:0;pointer-events:none;transition:.18s;box-shadow:0 10px 30px rgba(0,0,0,.5);z-index:50}
.toast.show{opacity:1;transform:translate(-50%,0)}
.toast.ok{border-color:#1f6b3b;color:#b6f5cc}
.toast.err{border-color:#7a2a2a;color:#fecaca}

@media (max-width:1080px){.app{grid-template-columns:1fr 280px}.layers{display:none}.hint{display:none}}
@media (max-width:760px){.app{grid-template-columns:1fr;grid-template-rows:minmax(0,52vh) minmax(0,1fr)}.inspector{border-left:0;border-top:1px solid var(--line)}
  .bar .back,.bar h1,.lbl{display:none}.stage{padding:16px}}
`;

/* クライアント側 JS。テンプレートリテラル内なので バッククォートと dollar-brace は使わないこと */
export const EDITOR_JS = String.raw`
(function () {
  'use strict';
  var W = 910, H = 550;

  /* ── 定義 ── */
  var LABELS = {
    logoWatermark: 'ロゴ（透かし）', logoHeader: 'ロゴ（ヘッダー）', orgName: '団体名', orgSub: '団体名（サブ）',
    roleJp: '肩書き（和文）', roleEn: '肩書き（英文）', nameJp: '氏名（和文）', nameEn: '氏名（英文）',
    skills: 'スキルタグ', contactLabel: '「CONTACT」ラベル', contact: '連絡先',
    logoWmLeft: 'ロゴ（透かし・左）', logoWmRight: 'ロゴ（透かし・右）', scanLabel: '「SCAN TO CONNECT」',
    qrPanel: 'QRコード', qrUrl: 'URL表記', logoBottom: 'ロゴ（下）', slogan: 'スローガン',
    footerLeft: 'フッター（左）', footerRight: 'フッター（右・年）'
  };
  var BINDS = { nameJp: '氏名（和文）', nameEn: '氏名（英文）', roleJp: '肩書き（和文）', roleEn: '肩書き（英文）',
    email: 'メール', github: 'GitHub', x: 'X', qrUrl: 'QRのURL', year: '年' };
  var TYPE_ICON = { text: 'T', logo: '◐', chips: '▭', contact: '☰', qr: '▦' };
  var RANGES = {
    text: { x: [-2000, 4000], y: [-2000, 4000], size: [1, 400], weight: [100, 900], tracking: [-20, 60], opacity: [0, 1] },
    logo: { x: [-2000, 4000], y: [-2000, 4000], w: [4, 3000], h: [4, 3000], opacity: [0, 1] },
    chips: { x: [-2000, 4000], y: [-2000, 4000], size: [4, 40], gap: [0, 60], height: [10, 60] },
    contact: { x: [-2000, 4000], y: [-2000, 4000], size: [4, 40], rowGap: [8, 80] },
    qr: { x: [-2000, 4000], y: [-2000, 4000], w: [80, 900], h: [80, 550] }
  };
  var SWATCHES = ['#ffffff', '#8a8f98', '#52525b', '#3f3f46', '#0a0a0c'];

  /* ── ユーティリティ ── */
  function $(s, r) { return (r || document).querySelector(s); }
  function mk(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function round1(v) { return Math.round(v * 10) / 10; }
  function fmt(v) { return String(round1(v)); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* noop */ } }
  function clampN(v, type, prop) { var r = RANGES[type] && RANGES[type][prop]; return r ? Math.min(r[1], Math.max(r[0], v)) : v; }

  /* ── 状態 ── */
  var st = { layout: null, defaults: null, savedJson: '', side: 'front', sel: null, hover: null, zoom: 1,
            dataId: '__sample', members: [], hist: [], hi: -1 };
  var board, canvas, ov, stage, svg = null, baseMap = {}, seq = 0, guides = [], drag = null, saving = false;
  function cur() { return st.layout[st.side]; }
  function snapshot() { return JSON.stringify(st.layout); }

  /* ── 通知 ── */
  var toastTimer;
  function toast(msg, kind) {
    var t = $('#toast'); t.textContent = msg; t.className = 'toast show' + (kind ? ' ' + kind : '');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.className = 'toast'; }, 2800);
  }

  /* ── 通信 / 描画 ── */
  function api(path, opts) {
    return fetch(path, opts).then(function (r) { if (!r.ok) throw new Error(path + ' ' + r.status); return r; });
  }
  function render() {
    var my = ++seq, snap = clone(cur());
    return api('/editor/preview', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ side: st.side, layout: st.layout, id: st.dataId })
    }).then(function (r) { return r.text(); }).then(function (txt) {
      if (my !== seq) return;
      canvas.innerHTML = txt;
      svg = canvas.querySelector('svg');
      svg.removeAttribute('width'); svg.removeAttribute('height');
      baseMap = {};
      Object.keys(snap).forEach(function (k) { baseMap[k] = { x: snap[k].x, y: snap[k].y }; });
      syncAll(); overlay();
    }).catch(function (e) { console.error(e); toast('プレビューの更新に失敗しました', 'err'); });
  }
  var rt;
  function renderSoon(ms) { clearTimeout(rt); rt = setTimeout(render, ms); }

  /* ── DOM への即時反映 ── */
  function gOf(key) { return svg && svg.querySelector('[data-el="' + key + '"]'); }
  function syncAll() { Object.keys(cur()).forEach(syncEl); }
  function syncEl(key) {
    var el = cur()[key], g = gOf(key), b = baseMap[key];
    if (!g || !b) return;
    g.setAttribute('transform', 'translate(' + (el.x - b.x) + ' ' + (el.y - b.y) + ')');
    if (el.type === 'text') {
      var t = g.querySelector('text'); if (!t) return;
      t.setAttribute('font-size', el.size); t.setAttribute('font-weight', el.weight);
      if (el.tracking) t.setAttribute('letter-spacing', el.tracking); else t.removeAttribute('letter-spacing');
      if (el.anchor === 'start') t.removeAttribute('text-anchor'); else t.setAttribute('text-anchor', el.anchor);
      t.setAttribute('fill', el.fill);
      if (el.opacity === 1) t.removeAttribute('fill-opacity'); else t.setAttribute('fill-opacity', el.opacity);
    } else if (el.type === 'logo') {
      var u = g.querySelector('use'); if (!u) return;
      u.setAttribute('width', el.w); u.setAttribute('height', el.h);
      if (el.opacity === 1) u.removeAttribute('opacity'); else u.setAttribute('opacity', el.opacity);
    }
  }
  /* DOM パッチでは表現できない変更はサーバー描画が必要 */
  function needsServer(el, prop) {
    if (prop === 'visible') return true;
    if (el.type === 'text') return prop === 'text' || prop === 'transform' || prop === 'font';
    if (el.type === 'logo') return false;
    return prop !== 'x' && prop !== 'y';
  }

  /* ── 計測 / オーバーレイ ── */
  function kOf() { return svg.getBoundingClientRect().width / W; }
  function rectOf(key) {
    var g = gOf(key); if (!g) return null;
    var r = g.getBoundingClientRect(), s = svg.getBoundingClientRect(), k = s.width / W;
    if (!r.width && !r.height) return null;
    return { x: (r.left - s.left) / k, y: (r.top - s.top) / k, w: r.width / k, h: r.height / k };
  }
  function toUnits(e) { var s = svg.getBoundingClientRect(), k = s.width / W; return { x: (e.clientX - s.left) / k, y: (e.clientY - s.top) / k, k: k }; }
  function isBg(el) { return el.type === 'logo' && el.opacity < 0.3; }

  function overlay() {
    ov.innerHTML = '';
    if (!svg) return;
    var k = kOf();
    function box(r, cls) {
      var d = mk('div', 'ob ' + cls);
      d.style.cssText = 'left:' + (r.x * k) + 'px;top:' + (r.y * k) + 'px;width:' + (r.w * k) + 'px;height:' + (r.h * k) + 'px';
      ov.appendChild(d); return d;
    }
    if (st.hover && st.hover !== st.sel) { var hr = rectOf(st.hover); if (hr) box(hr, 'hover'); }
    if (st.sel) {
      var r = rectOf(st.sel);
      if (r) {
        var d = box(r, 'sel');
        d.appendChild(mk('span', 'otag', esc(LABELS[st.sel] || st.sel)));
        var el = cur()[st.sel], left = el.type === 'text' && el.anchor === 'end';
        var h = mk('div', 'rh' + (left ? ' bl' : ''));
        h.style.left = ((left ? r.x : r.x + r.w) * k) + 'px'; h.style.top = ((r.y + r.h) * k) + 'px';
        h.title = 'ドラッグでサイズ変更';
        h.addEventListener('pointerdown', startResize);
        ov.appendChild(h);
      }
    }
    guides.forEach(function (g) {
      var l = mk('div', 'guide ' + g.axis);
      if (g.axis === 'v') l.style.left = (g.v * k) + 'px'; else l.style.top = (g.v * k) + 'px';
      ov.appendChild(l);
    });
  }

  function hitTest(ux, uy) {
    var keys = Object.keys(cur()).reverse();
    for (var i = 0; i < keys.length; i++) {
      var el = cur()[keys[i]];
      if (!el.visible || isBg(el)) continue;
      var r = rectOf(keys[i]); if (!r) continue;
      var pad = 4;
      if (ux >= r.x - pad && ux <= r.x + r.w + pad && uy >= r.y - pad && uy <= r.y + r.h + pad) return keys[i];
    }
    return null;
  }

  /* ── 選択 ── */
  function select(key) { st.sel = key; overlay(); layersMark(); inspector(); }

  /* ── ドラッグ移動 / リサイズ ── */
  function bind() {
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }
  function unbind() {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
  }
  function snapTargets(except) {
    var xs = [14, 36, W / 2, 874, 896], ys = [14, 36, H / 2, 514, 536];
    Object.keys(cur()).forEach(function (k) {
      if (k === except) return;
      var el = cur()[k]; if (!el.visible || isBg(el)) return;
      var r = rectOf(k); if (!r) return;
      xs.push(r.x, r.x + r.w / 2, r.x + r.w); ys.push(r.y, r.y + r.h / 2, r.y + r.h);
    });
    return { xs: xs, ys: ys };
  }
  function best(vals, cands, T) {
    var bd = null, bv = null;
    vals.forEach(function (v) { cands.forEach(function (c) {
      var d = c - v;
      if (Math.abs(d) <= T && (bd === null || Math.abs(d) < Math.abs(bd))) { bd = d; bv = c; }
    }); });
    return bd === null ? null : { d: bd, v: bv };
  }
  function snapDelta(r, dx, dy, t, T) {
    var out = { dx: 0, dy: 0, guides: [] };
    var bx = best([r.x + dx, r.x + dx + r.w / 2, r.x + dx + r.w], t.xs, T);
    if (bx) { out.dx = bx.d; out.guides.push({ axis: 'v', v: bx.v }); }
    var by = best([r.y + dy, r.y + dy + r.h / 2, r.y + dy + r.h], t.ys, T);
    if (by) { out.dy = by.d; out.guides.push({ axis: 'h', v: by.v }); }
    return out;
  }

  function onBoardDown(e) {
    if (e.button !== 0 || !svg) return;
    var p = toUnits(e), key = hitTest(p.x, p.y);
    if (!key && st.sel) { var sr = rectOf(st.sel); if (sr && p.x >= sr.x && p.x <= sr.x + sr.w && p.y >= sr.y && p.y <= sr.y + sr.h) key = st.sel; }
    if (!key) { select(null); return; }
    if (key !== st.sel) select(key);
    var el = cur()[key];
    drag = { mode: 'move', key: key, sx: e.clientX, sy: e.clientY, k: p.k, ox: el.x, oy: el.y,
             r: rectOf(key), moved: false, targets: snapTargets(key) };
    bind();
  }
  function startResize(e) {
    e.preventDefault(); e.stopPropagation();
    var key = st.sel; if (!key) return;
    drag = { mode: 'resize', key: key, sx: e.clientX, sy: e.clientY, k: toUnits(e).k, r: rectOf(key), orig: clone(cur()[key]), moved: true };
    document.body.classList.add('dragging');
    bind();
  }
  function onMove(e) {
    if (!drag) return;
    var dx = (e.clientX - drag.sx) / drag.k, dy = (e.clientY - drag.sy) / drag.k;
    if (drag.mode === 'move') {
      if (!drag.moved) {
        if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 3) return;
        drag.moved = true; document.body.classList.add('dragging');
      }
      if (e.shiftKey) { if (Math.abs(dx) >= Math.abs(dy)) dy = 0; else dx = 0; }
      guides = [];
      if (!e.altKey) {
        var s = snapDelta(drag.r, dx, dy, drag.targets, 6 / drag.k);
        dx += s.dx; dy += s.dy; guides = s.guides;
      }
      var el = cur()[drag.key];
      el.x = round1(clampN(drag.ox + dx, el.type, 'x')); el.y = round1(clampN(drag.oy + dy, el.type, 'y'));
      syncEl(drag.key); overlay(); inspectorValues(); updateDirty();
    } else {
      resizeMove(dx);
    }
  }
  function resizeMove(dx) {
    var el = cur()[drag.key], o = drag.orig, r = drag.r, f;
    if (el.type === 'text') {
      var g = el.anchor === 'end' ? -dx : dx; if (el.anchor === 'middle') g *= 2;
      f = (r.w + g) / Math.max(r.w, 1);
      el.size = round1(clampN(o.size * f, 'text', 'size'));
    } else {
      f = Math.max(0.05, (r.w + dx) / Math.max(r.w, 1));
      if (el.type === 'logo' || el.type === 'qr') {
        el.w = round1(clampN(o.w * f, el.type, 'w')); el.h = round1(clampN(o.h * f, el.type, 'h'));
      } else if (el.type === 'chips') {
        el.size = round1(clampN(o.size * f, 'chips', 'size')); el.height = round1(clampN(o.height * f, 'chips', 'height'));
        el.gap = round1(clampN(o.gap * f, 'chips', 'gap'));
      } else if (el.type === 'contact') {
        el.size = round1(clampN(o.size * f, 'contact', 'size')); el.rowGap = round1(clampN(o.rowGap * f, 'contact', 'rowGap'));
      }
    }
    syncEl(drag.key);
    if (el.type !== 'text' && el.type !== 'logo') renderSoon(40);
    overlay(); inspectorValues(); updateDirty();
  }
  function onUp() {
    unbind();
    var d = drag; drag = null; guides = [];
    document.body.classList.remove('dragging');
    if (d && d.moved) { updateDirty(); commit(); renderSoon(600); }
    overlay();
  }

  function nudge(dx, dy) {
    var key = st.sel; if (!key) return;
    var el = cur()[key];
    el.x = round1(clampN(el.x + dx, el.type, 'x')); el.y = round1(clampN(el.y + dy, el.type, 'y'));
    syncEl(key); overlay(); inspectorValues(); updateDirty(); commitSoon(); renderSoon(900);
  }

  /* ── プロパティ更新 ── */
  function setProp(key, prop, val) {
    var el = cur()[key]; if (!el) return;
    if (typeof val === 'number') val = round1(clampN(val, el.type, prop));
    el[prop] = val;
    syncEl(key);
    renderSoon(needsServer(el, prop) ? 60 : 900);
    overlay(); updateDirty(); commitSoon();
  }

  /* ── 履歴 / 変更検知 ── */
  var commitTimer;
  function commit() {
    clearTimeout(commitTimer);
    var s = snapshot();
    if (s === st.hist[st.hi]) { updateUndoUI(); return; }
    st.hist = st.hist.slice(0, st.hi + 1); st.hist.push(s);
    if (st.hist.length > 120) st.hist.shift();
    st.hi = st.hist.length - 1; updateUndoUI();
  }
  function commitSoon() { clearTimeout(commitTimer); commitTimer = setTimeout(commit, 450); }
  function applyHistory() {
    if (st.sel && !cur()[st.sel]) st.sel = null;
    updateDirty(); updateUndoUI(); render(); layers(); inspector();
  }
  function undo() { commit(); if (st.hi <= 0) return; st.hi--; st.layout = JSON.parse(st.hist[st.hi]); applyHistory(); }
  function redo() { if (st.hi >= st.hist.length - 1) return; st.hi++; st.layout = JSON.parse(st.hist[st.hi]); applyHistory(); }
  function updateUndoUI() { $('#undo').disabled = st.hi <= 0; $('#redo').disabled = st.hi >= st.hist.length - 1; }
  function isDirty() { return snapshot() !== st.savedJson; }
  function updateDirty() {
    var b = $('#save'), d = isDirty();
    b.classList.toggle('dirty', d); b.disabled = !d;
    b.title = d ? '変更を保存（⌘S）。保存すると全員の名刺に反映されます' : '変更はありません';
  }

  /* ── 保存 / 初期化 ── */
  function save() {
    if (saving || !isDirty()) return;
    saving = true; $('#save').classList.add('busy');
    api('/editor/layout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: snapshot() })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var changed = JSON.stringify(j.layout) !== snapshot();
        st.layout = j.layout; st.savedJson = snapshot(); commit(); updateDirty();
        if (changed) render();
        toast('保存しました。全員の名刺に反映されます', 'ok');
      })
      .catch(function () { toast('保存に失敗しました', 'err'); })
      .then(function () { saving = false; $('#save').classList.remove('busy'); });
  }
  function resetAll() {
    st.layout = clone(st.defaults); st.sel = null;
    commit(); updateDirty(); render(); layers(); inspector();
    toast('初期値に戻しました（保存するまで反映されません・⌘Zで取り消し）');
  }
  function resetOne(key) {
    cur()[key] = clone(st.defaults[st.side][key]);
    commit(); updateDirty(); render(); layers(); inspector();
  }

  /* ── レイヤー ── */
  var EYE_ON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  var EYE_OFF = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.9 17.9A10.9 10.9 0 0 1 12 19c-6.4 0-10-7-10-7a18.3 18.3 0 0 1 5.1-5.9M9.9 5.2A10 10 0 0 1 12 5c6.4 0 10 7 10 7a18.5 18.5 0 0 1-2.2 3.2M1 1l22 22"/></svg>';
  function layers() {
    var ul = $('#layers'); ul.innerHTML = '';
    Object.keys(cur()).reverse().forEach(function (key) {
      var el = cur()[key];
      var li = mk('li', (key === st.sel ? 'on ' : '') + (el.visible ? '' : 'hid'));
      li.setAttribute('data-key', key);
      li.appendChild(mk('span', 'ti', TYPE_ICON[el.type]));
      li.appendChild(mk('span', 'nm', esc(LABELS[key] || key)));
      var eye = mk('button', 'eye', el.visible ? EYE_ON : EYE_OFF);
      eye.type = 'button'; eye.title = el.visible ? '非表示にする' : '表示する';
      eye.addEventListener('click', function (ev) {
        ev.stopPropagation(); setProp(key, 'visible', !cur()[key].visible); layers(); if (st.sel === key) inspector();
      });
      li.appendChild(eye);
      li.addEventListener('click', function () { select(key); });
      li.addEventListener('pointerenter', function () { st.hover = key; overlay(); });
      li.addEventListener('pointerleave', function () { st.hover = null; overlay(); });
      ul.appendChild(li);
    });
  }
  function layersMark() {
    [].forEach.call($('#layers').children, function (li) { li.classList.toggle('on', li.getAttribute('data-key') === st.sel); });
  }

  /* ── インスペクタ ── */
  function sec(title, nodes) {
    var s = mk('section', 'sec'); s.appendChild(mk('h3', '', title));
    nodes.forEach(function (n) { s.appendChild(n); }); return s;
  }
  function fld(label, ctl, cls) { var f = mk('div', 'fld ' + (cls || '')); f.appendChild(mk('label', '', label)); f.appendChild(ctl); return f; }
  function numField(key, prop, label, step) {
    var el = cur()[key], f = mk('div', 'fld'), l = mk('label', 'scrub', label);
    l.title = '左右にドラッグで数値を調整（Shift: ×10 / Alt: ×0.1）';
    var inp = document.createElement('input'); inp.type = 'number'; inp.step = step; inp.value = fmt(el[prop]); inp.setAttribute('data-prop', prop);
    inp.addEventListener('input', function () { var v = parseFloat(inp.value); if (isFinite(v)) setProp(key, prop, v); });
    inp.addEventListener('keydown', function (e) {
      if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && e.shiftKey) {
        e.preventDefault(); var v = (parseFloat(inp.value) || 0) + (e.key === 'ArrowUp' ? 1 : -1) * step * 10;
        inp.value = fmt(v); setProp(key, prop, v);
      }
    });
    l.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      var sx = e.clientX, v0 = parseFloat(inp.value) || 0;
      function mv(ev) { var v = round1(v0 + (ev.clientX - sx) * step * (ev.shiftKey ? 10 : (ev.altKey ? 0.1 : 1))); inp.value = fmt(clampN(v, el.type, prop)); setProp(key, prop, v); }
      function up() { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); document.body.classList.remove('scrubbing'); }
      document.body.classList.add('scrubbing'); window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
    });
    f.appendChild(l); f.appendChild(inp); return f;
  }
  function segField(key, prop, label, opts, asNum) {
    var seg = mk('div', 'seg2');
    opts.forEach(function (o) {
      var b = mk('button', String(cur()[key][prop]) === String(o.v) ? 'on' : '', o.label); b.type = 'button';
      b.addEventListener('click', function () {
        setProp(key, prop, asNum ? Number(o.v) : o.v);
        [].forEach.call(seg.children, function (c) { c.classList.toggle('on', c === b); });
      });
      seg.appendChild(b);
    });
    return fld(label, seg);
  }
  function colorField(key, prop, label) {
    var col = mk('div', 'col'), v = cur()[key][prop];
    var pick = document.createElement('input'); pick.type = 'color'; pick.value = v;
    var hex = document.createElement('input'); hex.type = 'text'; hex.value = v; hex.maxLength = 7; hex.spellcheck = false;
    function apply(c) { if (/^#[0-9a-fA-F]{6}$/.test(c)) { setProp(key, prop, c.toLowerCase()); pick.value = c; hex.value = c; } }
    pick.addEventListener('input', function () { apply(pick.value); });
    hex.addEventListener('change', function () { apply(hex.value.charAt(0) === '#' ? hex.value : '#' + hex.value); });
    var r1 = mk('div', 'crow'), r2 = mk('div', 'crow');
    r1.appendChild(pick); r1.appendChild(hex);
    SWATCHES.forEach(function (c) {
      var s = mk('button', 'sw'); s.type = 'button'; s.style.background = c; s.title = c; s.addEventListener('click', function () { apply(c); }); r2.appendChild(s);
    });
    col.appendChild(r1); col.appendChild(r2);
    return fld(label, col);
  }
  function opacityField(key) {
    var el = cur()[key], r = mk('div', 'rng');
    var rg = document.createElement('input'); rg.type = 'range'; rg.min = 0; rg.max = 100; rg.value = Math.round(el.opacity * 100); rg.setAttribute('data-prop', 'opacity');
    var out = mk('output', '', Math.round(el.opacity * 100) + '%');
    rg.addEventListener('input', function () { out.textContent = rg.value + '%'; setProp(key, 'opacity', Number(rg.value) / 100); });
    r.appendChild(rg); r.appendChild(out); return fld('不透明度', r);
  }
  function textField(key) {
    var inp = document.createElement('input'); inp.type = 'text'; inp.maxLength = 120; inp.value = cur()[key].text || '';
    inp.addEventListener('input', function () { setProp(key, 'text', inp.value); });
    return fld('内容', inp);
  }

  function inspector() {
    var box = $('#inspector'); box.innerHTML = '';
    var key = st.sel;
    if (!key || !cur()[key]) {
      box.appendChild(mk('div', 'empty',
        '<h3>要素を選択</h3>カード上の文字・ロゴ・QRをクリックするか、左のレイヤーから選びます。薄い透かしロゴはレイヤーから選ぶと動かせます。' +
        '<ul><li><span>移動</span><span>ドラッグ / <kbd>←↑↓→</kbd></span></li>' +
        '<li><span>10px移動</span><span><kbd>Shift</kbd>+矢印</span></li>' +
        '<li><span>軸を固定</span><span><kbd>Shift</kbd>+ドラッグ</span></li>' +
        '<li><span>スナップ解除</span><span><kbd>Alt</kbd>+ドラッグ</span></li>' +
        '<li><span>サイズ変更</span><span>角のハンドル</span></li>' +
        '<li><span>非表示</span><span><kbd>Delete</kbd></span></li>' +
        '<li><span>元に戻す</span><span><kbd>⌘</kbd><kbd>Z</kbd></span></li>' +
        '<li><span>保存</span><span><kbd>⌘</kbd><kbd>S</kbd></span></li></ul>'));
      return;
    }
    var el = cur()[key];
    box.appendChild(mk('div', 'ihead',
      '<span class="ticon">' + TYPE_ICON[el.type] + '</span><div><div class="iname">' + esc(LABELS[key] || key) + '</div><div class="isub">' + esc(key) + '</div></div>'));

    var pos = [numField(key, 'x', 'X', 1), numField(key, 'y', 'Y', 1)];
    if (el.type === 'logo' || el.type === 'qr') { pos.push(numField(key, 'w', '幅', 1)); pos.push(numField(key, 'h', '高さ', 1)); }
    box.appendChild(sec('位置とサイズ', pos));

    if (el.type === 'text') {
      var tx = [];
      if (el.bind) tx.push(mk('div', 'note', 'この文字は Notion の「' + esc(BINDS[el.bind] || el.bind) + '」が自動で入ります。'));
      else tx.push(textField(key));
      tx.push(numField(key, 'size', 'サイズ', 0.5));
      tx.push(segField(key, 'weight', '太さ', [{ v: 300, label: '細' }, { v: 400, label: '標準' }, { v: 500, label: '中' }, { v: 700, label: '太' }, { v: 800, label: '極太' }], true));
      tx.push(numField(key, 'tracking', '字間', 0.5));
      tx.push(segField(key, 'anchor', '揃え', [{ v: 'start', label: '左' }, { v: 'middle', label: '中央' }, { v: 'end', label: '右' }]));
      tx.push(segField(key, 'font', '書体', [{ v: 'hd', label: 'ゴシック' }, { v: 'mo', label: '等幅' }]));
      tx.push(segField(key, 'transform', '大小', [{ v: 'none', label: 'そのまま' }, { v: 'upper', label: 'ABC' }]));
      box.appendChild(sec('文字', tx));
      box.appendChild(sec('色', [colorField(key, 'fill', '文字色'), opacityField(key)]));
    } else if (el.type === 'logo') {
      box.appendChild(sec('見た目', [opacityField(key)]));
    } else if (el.type === 'chips') {
      box.appendChild(sec('チップ', [numField(key, 'size', '文字', 0.5), numField(key, 'height', '高さ', 1), numField(key, 'gap', '間隔', 1)]));
    } else if (el.type === 'contact') {
      box.appendChild(sec('連絡先', [numField(key, 'size', '文字', 0.5), numField(key, 'rowGap', '行間', 1)]));
    }

    var acts = mk('div', 'acts');
    var vis = mk('button', 'btn', el.visible ? '非表示にする' : '表示する'); vis.type = 'button';
    vis.addEventListener('click', function () { setProp(key, 'visible', !cur()[key].visible); layers(); inspector(); });
    var rs = mk('button', 'btn', '初期値に戻す'); rs.type = 'button';
    rs.addEventListener('click', function () { resetOne(key); });
    acts.appendChild(vis); acts.appendChild(rs); box.appendChild(acts);
  }
  /* ドラッグ中などに、入力欄を作り直さず数値だけ更新する */
  function inspectorValues() {
    var key = st.sel; if (!key || !cur()[key]) return;
    var el = cur()[key];
    [].forEach.call(document.querySelectorAll('#inspector input[data-prop]'), function (i) {
      if (i === document.activeElement) return;
      var p = i.getAttribute('data-prop');
      if (el[p] !== undefined && i.type === 'number') i.value = fmt(el[p]);
    });
  }

  /* ── ズーム / レイアウト ── */
  function layoutBoard() {
    var aw = Math.max(200, stage.clientWidth - 80), ah = Math.max(150, stage.clientHeight - 80);
    var fit = Math.min(aw / W, ah / H), scale = Math.max(0.15, fit * st.zoom);
    board.style.width = (W * scale) + 'px'; board.style.height = (H * scale) + 'px';
    $('#zpct').textContent = Math.round(st.zoom * 100) + '%';
  }
  function setZoom(z) { st.zoom = Math.min(4, Math.max(0.4, z)); layoutBoard(); overlay(); }

  /* ── 上部バー ── */
  function buildTop() {
    var d = $('#data'); d.innerHTML = '';
    function opt(v, label) { var o = document.createElement('option'); o.value = v; o.textContent = label; d.appendChild(o); }
    opt('__sample', 'サンプル（山田 太郎）'); opt('__sample_long', 'サンプル（長い名前）');
    st.members.forEach(function (m) { opt(m.id, (m.name || '（名前未設定）') + '  ·  ' + m.id); });
    var saved = lsGet('tq.editor.data');
    if (saved && [].some.call(d.options, function (o) { return o.value === saved; })) st.dataId = saved;
    d.value = st.dataId;
    d.addEventListener('change', function () { st.dataId = d.value; lsSet('tq.editor.data', st.dataId); render(); });

    var sd = lsGet('tq.editor.side'); if (sd === 'front' || sd === 'back') st.side = sd;
    [].forEach.call($('#side').children, function (b) {
      b.classList.toggle('on', b.getAttribute('data-side') === st.side);
      b.addEventListener('click', function () {
        st.side = b.getAttribute('data-side'); lsSet('tq.editor.side', st.side); st.sel = null; st.hover = null; guides = [];
        [].forEach.call($('#side').children, function (x) { x.classList.toggle('on', x === b); });
        render(); layers(); inspector();
      });
    });
    $('#undo').addEventListener('click', undo); $('#redo').addEventListener('click', redo);
    $('#zin').addEventListener('click', function () { setZoom(st.zoom * 1.25); });
    $('#zout').addEventListener('click', function () { setZoom(st.zoom / 1.25); });
    $('#zfit').addEventListener('click', function () { setZoom(1); });
    $('#reset').addEventListener('click', resetAll);
    $('#save').addEventListener('click', save);
  }

  /* ── 入力イベント ── */
  function wire() {
    board.addEventListener('pointerdown', onBoardDown);
    board.addEventListener('pointermove', function (e) {
      if (drag || !svg) return;
      var p = toUnits(e), k = hitTest(p.x, p.y);
      board.classList.toggle('over', !!k);
      if (k !== st.hover) { st.hover = k; overlay(); }
    });
    board.addEventListener('pointerleave', function () { if (!drag && st.hover) { st.hover = null; overlay(); } });
    stage.addEventListener('wheel', function (e) {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault(); setZoom(st.zoom * Math.exp(-e.deltaY * 0.0025));
    }, { passive: false });
    if (window.ResizeObserver) new ResizeObserver(function () { layoutBoard(); overlay(); }).observe(stage);
    else window.addEventListener('resize', function () { layoutBoard(); overlay(); });
    window.addEventListener('beforeunload', function (e) { if (isDirty()) { e.preventDefault(); e.returnValue = ''; } });

    document.addEventListener('keydown', function (e) {
      var t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      var mod = e.metaKey || e.ctrlKey, k = (e.key || '').toLowerCase();
      if (mod && k === 's') { e.preventDefault(); save(); return; }
      if (mod && k === 'z' && !typing) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (mod && k === 'y' && !typing) { e.preventDefault(); redo(); return; }
      if (typing) { if (e.key === 'Escape' && t.blur) t.blur(); return; }
      if (e.key === 'Escape') { select(null); return; }
      if (!st.sel || mod) return;
      var step = e.shiftKey ? 10 : 1;
      if (e.key === 'ArrowLeft') { e.preventDefault(); nudge(-step, 0); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); nudge(step, 0); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); nudge(0, -step); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); nudge(0, step); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); setProp(st.sel, 'visible', false); layers(); inspector(); }
    });
  }

  /* ── 起動 ── */
  function boot() {
    board = $('#board'); canvas = $('#canvas'); ov = $('#overlay'); stage = $('#stage');
    Promise.all([
      api('/editor/layout').then(function (r) { return r.json(); }),
      api('/editor/members').then(function (r) { return r.json(); }).catch(function () { return []; })
    ]).then(function (res) {
      st.layout = res[0].layout; st.defaults = res[0].defaults; st.members = res[1] || [];
      st.savedJson = snapshot();
      buildTop(); wire(); layoutBoard(); commit(); updateDirty();
      layers(); inspector();
      return render();
    }).catch(function (e) { console.error(e); toast('読み込みに失敗しました。再読み込みしてください', 'err'); });
  }
  boot();
})();
`;

export function buildEditorPage(): string {
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>名刺レイアウトエディタ</title>
<style>${EDITOR_CSS}</style>
</head>
<body>
<header class="bar">
  <a class="back" href="/preview">← プレビュー</a>
  <h1>レイアウトエディタ</h1>
  <span class="vr"></span>
  <button class="ib" id="undo" type="button" title="元に戻す (⌘Z)" aria-label="元に戻す" disabled>↶</button>
  <button class="ib" id="redo" type="button" title="やり直す (⇧⌘Z)" aria-label="やり直す" disabled>↷</button>
  <span class="vr"></span>
  <div class="seg" id="side"><button type="button" data-side="front">表面</button><button type="button" data-side="back">裏面</button></div>
  <span class="lbl">プレビュー</span>
  <select class="pick" id="data" aria-label="プレビューに使うデータ"></select>
  <span class="sp"></span>
  <div class="zoom">
    <button class="ib" id="zout" type="button" title="縮小" aria-label="縮小">−</button>
    <button class="btn" id="zfit" type="button" title="画面に合わせる" style="padding:4px 9px"><span id="zpct">100%</span></button>
    <button class="ib" id="zin" type="button" title="拡大 (⌘+ホイール)" aria-label="拡大">＋</button>
  </div>
  <span class="vr"></span>
  <button class="btn" id="reset" type="button" title="初期値に戻す（未保存・取り消し可）">初期化</button>
  <button class="btn primary" id="save" type="button" disabled>保存</button>
</header>
<main class="app">
  <aside class="layers"><h2>レイヤー</h2><ul id="layers"></ul></aside>
  <section class="stage" id="stage"><div class="board" id="board"><div class="canvas" id="canvas"></div><div class="overlay" id="overlay"></div></div></section>
  <aside class="inspector" id="inspector"></aside>
</main>
<footer class="hint">
  <span><kbd>ドラッグ</kbd>移動</span><span><kbd>←↑↓→</kbd>1px</span><span><kbd>Shift</kbd>軸固定 / 10px</span>
  <span><kbd>Alt</kbd>スナップ解除</span><span><kbd>⌘Z</kbd>元に戻す</span><span><kbd>⌘S</kbd>保存</span>
</footer>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<script>${EDITOR_JS}</script>
</body>
</html>`;
}
