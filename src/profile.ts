/**
 * プロフィールページ（QR を読み取った人が最初に見るページ）。
 *
 * Notion の TargetURL が空のメンバーの QR はここに着地する。内容は Notion のデータから自動生成なので、
 * メンバーが Notion の自分の行を直せばこのページもそのまま更新される。
 * スマホで見ることが前提のため 1 カラム・ロゴは軽量な /assets/logo.png を参照する。
 */
import { escapeXml } from "./card-template";
import type { Member } from "./notion";

const esc = escapeXml;

/** リンクに使うハンドル。ここを通らないものはリンクにせず文字として出す */
const HANDLE = /^[A-Za-z0-9_.-]{1,50}$/;
const EMAIL = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;

const ICON = {
  github:
    '<circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="9.5" r="3.2"/><path d="M5.8 18.6c1.4-3.2 10.9-3.2 12.4 0"/>',
  x: '<path d="M5 5l14 14M19 5L5 19"/>',
  mail: '<rect x="3" y="5.5" width="18" height="13" rx="2.2"/><path d="M3.8 7.2L12 13l8.2-5.8"/>',
};

function row(icon: keyof typeof ICON, label: string, href: string | null): string {
  const svg = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[icon]}</svg>`;
  const inner = `${svg}<span class="t">${esc(label)}</span><span class="go">${href ? "↗" : ""}</span>`;
  return href
    ? `<a class="row" href="${esc(href)}" rel="noopener noreferrer">${inner}</a>`
    : `<div class="row">${inner}</div>`;
}

export function buildProfilePage(m: Member): string {
  const f = m.fields;
  const name = f.nameJp || f.nameEn || m.id;

  const links: string[] = [];
  if (f.githubId) {
    links.push(
      row("github", `github.com/${f.githubId}`, HANDLE.test(f.githubId) ? `https://github.com/${f.githubId}` : null),
    );
  }
  if (f.xId) {
    links.push(row("x", `@${f.xId}`, HANDLE.test(f.xId) ? `https://x.com/${f.xId}` : null));
  }
  if (f.email) {
    links.push(row("mail", f.email, EMAIL.test(f.email) ? `mailto:${f.email}` : null));
  }

  const skills = f.skillTags.map((t) => `<li>${esc(t)}</li>`).join("");

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#0a0a0c">
<title>${esc(name)} — TECH CLUB</title>
<meta property="og:title" content="${esc(name)} — TECH CLUB">
<meta property="og:description" content="${esc([f.roleJp, f.roleEn].filter(Boolean).join(" / ") || "TECH CLUB DEV TEAM")}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;700;800&family=Noto+Sans+JP:wght@300;400;500;700;800&display=swap">
<style>
  *{box-sizing:border-box}
  html{-webkit-text-size-adjust:100%}
  body{margin:0;min-height:100vh;min-height:100dvh;background:#0a0a0c;color:#fff;display:grid;place-items:center;
    padding:max(20px,env(safe-area-inset-top)) 16px max(20px,env(safe-area-inset-bottom));
    font-family:"Inter","Noto Sans JP","Hiragino Kaku Gothic ProN","Yu Gothic",system-ui,sans-serif;line-height:1.6}
  .card{position:relative;width:100%;max-width:440px;padding:36px 28px 28px;border:1px solid rgba(255,255,255,.88);border-radius:6px}
  .card::before{content:"";position:absolute;inset:5px;border:1px solid rgba(255,255,255,.12);border-radius:3px;pointer-events:none}
  header{display:flex;align-items:center;gap:14px;padding-bottom:22px;border-bottom:1px solid #3f3f46}
  .logo{height:46px;width:auto;filter:invert(1);mix-blend-mode:screen}
  .org b{display:block;font-size:12px;font-weight:700;letter-spacing:.3em}
  .org small{display:block;font-size:9.5px;letter-spacing:.28em;color:#52525b;margin-top:2px}
  .who{padding:34px 0 8px}
  .role{margin:0;font-size:15px;font-weight:300;letter-spacing:.35em;color:#8a8f98}
  .role-en{margin:0;font-size:9.5px;letter-spacing:.35em;color:#52525b;text-transform:uppercase}
  h1{margin:18px 0 0;font-size:clamp(40px,13vw,54px);line-height:1.12;font-weight:800;letter-spacing:.02em}
  .en{margin:10px 0 0;font-size:12px;font-weight:300;letter-spacing:.5em;color:#8a8f98;text-transform:uppercase}
  .en::after{content:"";display:block;width:112px;height:1px;background:#3f3f46;margin-top:14px}
  .skills{list-style:none;display:flex;flex-wrap:wrap;gap:8px;margin:26px 0 0;padding:0}
  .skills li{font:11.5px "Courier New",monospace;color:#8a8f98;background:#18181b;border-left:2.5px solid rgba(255,255,255,.5);padding:5px 11px;border-radius:3px}
  .links{margin-top:30px;border-top:1px solid #3f3f46}
  .row{display:flex;align-items:center;gap:14px;min-height:56px;padding:12px 2px;color:#fff;text-decoration:none;border-bottom:1px solid #27272a}
  a.row:hover,a.row:focus-visible{background:#131316;outline:none}
  .row svg{flex:none;color:#8a8f98}
  .row .t{flex:1;min-width:0;overflow-wrap:anywhere;font:13.5px "Courier New",monospace;color:#d4d4d8}
  .row .go{color:#52525b;font-size:15px}
  footer{margin-top:26px;text-align:center;font-size:9px;letter-spacing:.5em;color:#3f3f46}
</style>
</head>
<body>
<main class="card">
  <header>
    <img class="logo" src="/assets/logo.png" alt="TECH CLUB" width="30" height="46">
    <div class="org"><b>TECH CLUB</b><small>DEV TEAM</small></div>
  </header>
  <section class="who">
    ${f.roleJp ? `<p class="role">${esc(f.roleJp)}</p>` : ""}
    ${f.roleEn ? `<p class="role-en">${esc(f.roleEn)}</p>` : ""}
    <h1>${esc(name)}</h1>
    ${f.nameEn && f.nameJp ? `<p class="en">${esc(f.nameEn)}</p>` : ""}
  </section>
  ${skills ? `<ul class="skills">${skills}</ul>` : ""}
  ${links.length ? `<nav class="links">${links.join("\n    ")}</nav>` : ""}
  <footer>BUILD · LEARN · SHIP</footer>
</main>
</body>
</html>`;
}
