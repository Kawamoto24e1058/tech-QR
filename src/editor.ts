/**
 * ビジュアルレイアウトエディタ（GET /editor）
 *
 * - カード SVG を表示し、各要素をドラッグで移動
 * - 右パネルで座標 / サイズ / 書体 / 色 / 表示ON-OFF を調整
 * - 「保存」で layout JSON を POST /editor/layout -> KV
 * - プレビューは POST /editor/preview（サンプルデータで描画）
 *
 * 認証なし（誰でも編集可）。壊れても「デフォルトに戻す」で復旧できる。
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

export function buildEditorPage(): string {
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>名刺レイアウトエディタ</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #0a0a0c; color: #e7e7ea;
    font-family: "Inter", -apple-system, "Hiragino Kaku Gothic ProN", "Yu Gothic", system-ui, sans-serif; }
  .top { display: flex; align-items: center; gap: 12px; padding: 12px 18px; border-bottom: 1px solid #27272a; }
  .top h1 { font-size: 15px; font-weight: 700; margin: 0; letter-spacing: .5px; }
  .top .sp { flex: 1; }
  .seg { display: inline-flex; border: 1px solid #3f3f46; border-radius: 6px; overflow: hidden; }
  .seg button { background: #131316; color: #8a8f98; border: 0; padding: 6px 14px; font-size: 13px; cursor: pointer; }
  .seg button.on { background: #e7e7ea; color: #0a0a0c; font-weight: 600; }
  button.act { background: #e7e7ea; color: #0a0a0c; border: 0; border-radius: 6px; padding: 7px 14px; font-size: 13px; font-weight: 600; cursor: pointer; }
  button.ghost { background: transparent; color: #8a8f98; border: 1px solid #3f3f46; border-radius: 6px; padding: 7px 12px; font-size: 13px; cursor: pointer; }
  button:disabled { opacity: .4; cursor: default; }
  .wrap { display: flex; height: calc(100vh - 53px); }
  .stage { flex: 1; overflow: auto; padding: 28px; display: flex; align-items: flex-start; justify-content: center; }
  .canvas { position: relative; width: 760px; max-width: 100%; box-shadow: 0 12px 60px rgba(0,0,0,.6); flex: none; }
  .canvas svg { display: block; width: 100%; height: auto; }
  .handle { position: absolute; width: 12px; height: 12px; margin: -6px 0 0 -6px; border-radius: 50%;
    background: #38bdf8; border: 2px solid #0a0a0c; cursor: grab; box-shadow: 0 0 0 1px #38bdf8; }
  .handle.sel { background: #f97316; box-shadow: 0 0 0 1px #f97316, 0 0 0 5px rgba(249,115,22,.25); }
  .handle:active { cursor: grabbing; }
  .panel { width: 320px; flex: none; border-left: 1px solid #27272a; overflow-y: auto; padding: 16px; }
  .panel h2 { font-size: 11px; letter-spacing: 2px; color: #52525b; margin: 0 0 10px; text-transform: uppercase; }
  .ellist { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 18px; }
  .ellist button { background: #131316; color: #8a8f98; border: 1px solid #27272a; border-radius: 5px;
    padding: 4px 9px; font-size: 12px; cursor: pointer; }
  .ellist button.on { border-color: #f97316; color: #f97316; }
  .ellist button.hidden { opacity: .4; text-decoration: line-through; }
  .field { display: grid; grid-template-columns: 76px 1fr; align-items: center; gap: 8px; margin-bottom: 8px; }
  .field label { font-size: 12px; color: #8a8f98; }
  .field input[type=number], .field input[type=text], .field select {
    width: 100%; background: #131316; border: 1px solid #3f3f46; color: #e7e7ea;
    border-radius: 5px; padding: 5px 7px; font-size: 12px; font-family: inherit; }
  .field input[type=color] { width: 100%; height: 28px; background: #131316; border: 1px solid #3f3f46; border-radius: 5px; }
  .field.row2 { grid-template-columns: 76px 1fr 1fr; }
  .row-btns { display: flex; gap: 8px; margin: 14px 0 22px; }
  .hint { font-size: 11px; color: #52525b; line-height: 1.6; margin-top: 4px; }
  .status { font-size: 12px; color: #4ade80; min-height: 16px; }
  a.back { color: #8a8f98; font-size: 13px; text-decoration: none; }
</style>
</head>
<body>
<div class="top">
  <h1>名刺レイアウトエディタ</h1>
  <a class="back" href="/preview">← プレビュー</a>
  <span class="sp"></span>
  <div class="seg" id="side">
    <button data-side="front" class="on">表面</button>
    <button data-side="back">裏面</button>
  </div>
  <button class="ghost" id="reset">デフォルトに戻す</button>
  <button class="act" id="save">保存</button>
</div>
<div class="wrap">
  <div class="stage"><div class="canvas" id="canvas"></div></div>
  <div class="panel">
    <div class="status" id="status"></div>
    <h2>要素</h2>
    <div class="ellist" id="ellist"></div>
    <h2 id="propTitle">プロパティ</h2>
    <div id="props"></div>
  </div>
</div>

<script>
const SIDES = ["front", "back"];
let layout = null;        // 作業中のレイアウト全体
let side = "front";
let sel = null;           // 選択中の要素キー
let scale = 1;
let saveTimer = null;

const $ = (s) => document.querySelector(s);
const canvas = $("#canvas");

const FIELD_SPEC = {
  text:    [["x","X","num"],["y","Y","num"],["size","サイズ","num"],["weight","太さ","weight"],["tracking","字間","num"],["anchor","揃え","anchor"],["fill","色","color"],["opacity","不透明度","opacity"],["font","書体","font"],["transform","変換","transform"],["text","文字","str"],["visible","表示","bool"]],
  logo:    [["x","X","num"],["y","Y","num"],["w","幅","num"],["h","高さ","num"],["opacity","不透明度","opacity"],["visible","表示","bool"]],
  chips:   [["x","X","num"],["y","Y","num"],["size","サイズ","num"],["gap","間隔","num"],["height","高さ","num"],["visible","表示","bool"]],
  contact: [["x","X","num"],["y","Y","num"],["size","サイズ","num"],["rowGap","行間","num"],["visible","表示","bool"]],
  qr:      [["x","X","num"],["y","Y","num"],["w","幅","num"],["h","高さ","num"],["visible","表示","bool"]],
};

async function boot() {
  const r = await fetch("/editor/layout");
  layout = (await r.json()).layout;
  bindTop();
  await render();
}

function bindTop() {
  $("#side").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-side]"); if (!b) return;
    side = b.dataset.side; sel = null;
    document.querySelectorAll("#side button").forEach((x) => x.classList.toggle("on", x.dataset.side === side));
    render();
  });
  $("#save").addEventListener("click", save);
  $("#reset").addEventListener("click", reset);
}

async function render() {
  const res = await fetch("/editor/preview", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ side, layout }),
  });
  canvas.innerHTML = await res.text();
  const svg = canvas.querySelector("svg");
  scale = canvas.clientWidth / 910;
  drawHandles();
  drawList();
  drawProps();
}

function drawHandles() {
  canvas.querySelectorAll(".handle").forEach((h) => h.remove());
  const els = layout[side];
  for (const key of Object.keys(els)) {
    const el = els[key];
    if (!el.visible) continue;
    const h = document.createElement("div");
    h.className = "handle" + (key === sel ? " sel" : "");
    h.style.left = (el.x * scale) + "px";
    h.style.top = (el.y * scale) + "px";
    h.title = key;
    h.addEventListener("pointerdown", (e) => startDrag(e, key));
    canvas.appendChild(h);
  }
}

function drawList() {
  const box = $("#ellist"); box.innerHTML = "";
  for (const key of Object.keys(layout[side])) {
    const el = layout[side][key];
    const b = document.createElement("button");
    b.textContent = key;
    b.className = (key === sel ? "on " : "") + (el.visible ? "" : "hidden");
    b.onclick = () => { sel = key; drawHandles(); drawList(); drawProps(); };
    box.appendChild(b);
  }
}

function drawProps() {
  const box = $("#props"); box.innerHTML = "";
  $("#propTitle").textContent = sel ? "プロパティ — " + sel : "プロパティ";
  if (!sel) { box.innerHTML = '<p class="hint">要素をクリックして選択。ハンドルをドラッグで移動。</p>'; return; }
  const el = layout[side][sel];
  for (const [k, label, kind] of FIELD_SPEC[el.type]) {
    if (k === "text" && el.text === undefined) continue;
    const wrap = document.createElement("div"); wrap.className = "field";
    const lab = document.createElement("label"); lab.textContent = label; wrap.appendChild(lab);
    let inp;
    if (kind === "anchor") inp = mkSelect(["start","middle","end"], ["左","中央","右"]);
    else if (kind === "font") inp = mkSelect(["hd","mo"], ["ゴシック","等幅"]);
    else if (kind === "transform") inp = mkSelect(["none","upper"], ["そのまま","大文字"]);
    else if (kind === "weight") inp = mkSelect(["300","400","500","700","800"], ["300","400","500","700","800"]);
    else if (kind === "bool") { inp = document.createElement("input"); inp.type = "checkbox"; inp.checked = !!el[k]; }
    else if (kind === "color") { inp = document.createElement("input"); inp.type = "color"; inp.value = el[k]; }
    else if (kind === "str") { inp = document.createElement("input"); inp.type = "text"; inp.maxLength = 120; inp.value = el[k] ?? ""; }
    else { inp = document.createElement("input"); inp.type = "number"; inp.step = (kind === "opacity") ? "0.05" : "1"; inp.value = el[k]; }
    if (inp.tagName === "SELECT") inp.value = String(el[k]);
    inp.addEventListener("input", () => {
      let v = inp.type === "checkbox" ? inp.checked : inp.value;
      if (kind === "num" || kind === "opacity") v = parseFloat(v);
      if (kind === "weight") v = parseInt(v, 10);
      el[k] = v;
      scheduleRender();
    });
    wrap.appendChild(inp); box.appendChild(wrap);
  }
}

function mkSelect(vals, labels) {
  const s = document.createElement("select");
  vals.forEach((v, i) => { const o = document.createElement("option"); o.value = v; o.textContent = labels[i]; s.appendChild(o); });
  return s;
}

let dragState = null;
function startDrag(e, key) {
  e.preventDefault();
  sel = key; drawList(); drawProps();
  const el = layout[side][key];
  const g = canvas.querySelector('[data-el="' + key + '"]');
  dragState = { key, startX: e.clientX, startY: e.clientY, ox: el.x, oy: el.y, g };
  canvas.querySelectorAll(".handle").forEach((h) => h.classList.toggle("sel", h.title === key));
  window.addEventListener("pointermove", onDrag);
  window.addEventListener("pointerup", endDrag);
}
function onDrag(e) {
  const d = dragState; if (!d) return;
  const dx = (e.clientX - d.startX) / scale;
  const dy = (e.clientY - d.startY) / scale;
  const el = layout[side][d.key];
  el.x = Math.round(d.ox + dx); el.y = Math.round(d.oy + dy);
  if (d.g) d.g.setAttribute("transform", "translate(" + (el.x - d.ox) + " " + (el.y - d.oy) + ")");
  const h = [...canvas.querySelectorAll(".handle")].find((x) => x.title === d.key);
  if (h) { h.style.left = (el.x * scale) + "px"; h.style.top = (el.y * scale) + "px"; }
}
function endDrag() {
  window.removeEventListener("pointermove", onDrag);
  window.removeEventListener("pointerup", endDrag);
  dragState = null;
  drawProps();
  render();
}

function scheduleRender() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(render, 180);
}

async function save() {
  $("#save").disabled = true;
  const r = await fetch("/editor/layout", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(layout),
  });
  $("#save").disabled = false;
  $("#status").textContent = r.ok ? "保存しました（全員の名刺に反映）" : "保存に失敗しました";
  setTimeout(() => ($("#status").textContent = ""), 3000);
}

async function reset() {
  if (!confirm("レイアウトをデフォルトに戻します。よろしいですか？")) return;
  await fetch("/editor/reset", { method: "POST" });
  const r = await fetch("/editor/layout");
  layout = (await r.json()).layout;
  sel = null;
  $("#status").textContent = "デフォルトに戻しました";
  setTimeout(() => ($("#status").textContent = ""), 3000);
  render();
}

boot();
</script>
</body>
</html>`;
}
