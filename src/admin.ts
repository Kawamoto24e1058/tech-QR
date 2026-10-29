/**
 * 管理画面 /admin（部で共通のパスワード 1 つでログイン）。
 *
 * Notion を開かずに、メンバーのデータと肩書き（選択肢 + 英訳）を編集できる。
 * 保存先は Notion のまま（アプリ → Notion API に書き込む）なので、Notion で直接編集しても同じデータ。
 * 名刺の見た目（layout.ts）は編集対象外。
 *
 * 認証: ADMIN_PASSWORD（シークレット）→ 署名付き Cookie（HttpOnly / SameSite=Strict / 7 日）。
 *       未設定のときは管理画面ごと無効（フェイルクローズ）。
 */
import { buildAdminPage, buildLoginPage, buildNoPasswordPage } from "./admin-page";
import { buildBackCard, buildFrontCard, type CardFields } from "./card-template";
import { FontError } from "./fonts";
import { invalidateMember } from "./lookup";
import {
  archiveMember,
  createMember,
  getMember,
  getRoles,
  ID_PATTERN,
  listMembersFull,
  normalizeHandle,
  saveRoles,
  updateMember,
  validRoleText,
  type Member,
  type MemberInput,
  type Role,
} from "./notion";

type Env = Cloudflare.Env;

const COOKIE = "tq_admin";
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const enc = new TextEncoder();

/* ── 入り口 ───────────────────────────────────────────── */

/** /admin 配下なら Response、それ以外は null（呼び出し側が続きを処理） */
export async function handleAdmin(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (path !== "/admin" && !path.startsWith("/admin/")) return null;

  const secret = env.ADMIN_PASSWORD;
  if (!secret) return page(buildNoPasswordPage(), 503);

  const method = request.method;

  // 書き込み系は同一オリジンからのみ（CSRF 対策。Cookie も SameSite=Strict）
  if (method !== "GET" && method !== "HEAD") {
    const origin = request.headers.get("Origin");
    if (origin && origin !== url.origin) return json({ error: "forbidden" }, 403);
  }

  if (path === "/admin/login" && method === "POST") return login(request, env, secret, url);
  if (path === "/admin/logout" && method === "POST") return logout(url);

  const authed = await isAuthed(request, secret);

  if (path === "/admin" && (method === "GET" || method === "HEAD")) {
    return page(authed ? buildAdminPage((env.PUBLIC_BASE_URL || url.origin).replace(/\/+$/, "")) : buildLoginPage(), 200);
  }

  if (!path.startsWith("/admin/api/")) return json({ error: "not found" }, 404);
  if (!authed) return json({ error: "unauthorized" }, 401);

  try {
    return await api(request, env, path, method);
  } catch (err) {
    console.error("admin api failed", { path, method, error: String(err) });
    return json({ error: "Notion との通信に失敗しました。少し待ってからもう一度お試しください。" }, 502);
  }
}

/* ── API ──────────────────────────────────────────────── */

async function api(request: Request, env: Env, path: string, method: string): Promise<Response> {
  if (path === "/admin/api/preview" && method === "POST") return previewCard(request, env);

  if (path === "/admin/api/members") {
    if (method === "GET") return json({ members: (await listMembersFull(env)).map(toEdit) });
    if (method === "POST") {
      const roles = (await getRoles(env)).roles;
      const parsed = parseInput(await readJson(request), roles, true);
      if ("error" in parsed) return json(parsed, 422);
      if (await getMember(parsed.value.id, env)) {
        return json({ error: "この ID はすでに使われています", field: "id" }, 409);
      }
      const created = await createMember(parsed.value, env);
      await invalidateMember(created.id);
      return json({ member: toEdit(created) }, 201);
    }
  }

  const one = path.match(/^\/admin\/api\/members\/([^/]+)$/);
  if (one) {
    const id = decodeURIComponent(one[1]);
    if (!ID_PATTERN.test(id)) return json({ error: "不正な ID です" }, 400);
    const current = await getMember(id, env);
    if (!current) return json({ error: "メンバーが見つかりません" }, 404);

    if (method === "PATCH") {
      const roles = (await getRoles(env)).roles;
      const parsed = parseInput({ ...((await readJson(request)) as object), id }, roles, false);
      if ("error" in parsed) return json(parsed, 422);
      const updated = await updateMember(current.pageId, parsed.value, env);
      await invalidateMember(id);
      return json({ member: toEdit(updated) });
    }
    if (method === "DELETE") {
      await archiveMember(current.pageId, env);
      await invalidateMember(id);
      return json({ ok: true });
    }
  }

  if (path === "/admin/api/roles") {
    if (method === "GET") return json(await rolesWithUsage(env));
    if (method === "PUT") {
      const body = (await readJson(request)) as { roles?: unknown };
      const check = validateRoles(body.roles);
      if ("error" in check) return json(check, 422);

      // 使用中の肩書きは削除/改名できない（メンバーの Role が空になってしまうため）
      const now = await rolesWithUsage(env);
      const keep = new Set(check.roles.map((r) => r.jp));
      const blocked = now.roles.filter((r) => !keep.has(r.jp) && (now.usage[r.jp] ?? 0) > 0);
      if (blocked.length) {
        return json(
          {
            error: `使用中の肩書きは削除・名前変更できません（${blocked.map((r) => r.jp).join("、")}）。先にメンバーの肩書きを変更してください。`,
          },
          409,
        );
      }
      await saveRoles(check.roles, env);
      return json(await rolesWithUsage(env));
    }
  }

  return json({ error: "not found" }, 404);
}

/** 入力途中（未保存）の内容で名刺を描画する。検証はせず、表示用に整えるだけ（SVG 側でエスケープされる） */
async function previewCard(request: Request, env: Env): Promise<Response> {
  const b = (await readJson(request)) as { side?: string; member?: Record<string, unknown> };
  const m = b.member ?? {};
  const clip = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const id = ID_PATTERN.test(clip(m.id, 64)) ? clip(m.id, 64) : "your-id";
  const fields: CardFields = {
    id,
    nameJp: clip(m.nameJp, 40),
    nameEn: clip(m.nameEn, 60),
    roleJp: clip(m.role, 16),
    roleEn: clip(m.roleEn, 40),
    email: clip(m.email, 100).replace(/^mailto:/i, ""),
    githubId: normalizeHandle(clip(m.githubId, 80), ["github.com"]).slice(0, 50),
    xId: normalizeHandle(clip(m.xId, 80), ["x.com", "twitter.com"]).slice(0, 50),
    skillTags: (Array.isArray(m.skills) ? m.skills : []).slice(0, 10).map((t) => clip(t, 24)).filter(Boolean),
  };
  const base = (env.PUBLIC_BASE_URL || new URL(request.url).origin).replace(/\/+$/, "");
  // 画面用: 仕上がりサイズ、ロゴは URL 参照で軽量に
  const opts = { bleed: false, logoHref: "/assets/logo-black.png" };
  let svg: string;
  try {
    svg = b.side === "back" ? await buildBackCard(fields, `${base}/p/${id}`, opts) : await buildFrontCard(fields, opts);
  } catch (err) {
    if (err instanceof FontError) return json({ error: "フォントを取得できませんでした" }, 503);
    throw err;
  }
  return new Response(svg, {
    headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "no-store" },
  });
}

async function rolesWithUsage(env: Env) {
  const [{ roles, warnings }, members] = await Promise.all([getRoles(env), listMembersFull(env)]);
  const usage: Record<string, number> = {};
  for (const m of members) if (m.fields.roleJp) usage[m.fields.roleJp] = (usage[m.fields.roleJp] ?? 0) + 1;
  return { roles, warnings, usage };
}

/** 管理画面に返すメンバーの形（編集フォームそのまま） */
function toEdit(m: Member) {
  return {
    id: m.id,
    active: m.active,
    targetUrl: m.targetUrl,
    nameJp: m.fields.nameJp,
    nameEn: m.fields.nameEn,
    role: m.fields.roleJp,
    roleEn: m.fields.roleEn,
    email: m.fields.email,
    githubId: m.fields.githubId,
    xId: m.fields.xId,
    skills: m.fields.skillTags,
  };
}

/* ── 入力の検証 ───────────────────────────────────────── */

const HANDLE = /^[A-Za-z0-9_.-]{1,50}$/;
const EMAIL = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;

type Failure = { error: string; field?: string };

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function parseInput(
  raw: unknown,
  roles: Role[],
  creating: boolean,
): { value: MemberInput } | Failure {
  const b = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const fail = (field: string, error: string): Failure => ({ error, field });

  const id = str(b.id);
  if (!ID_PATTERN.test(id)) {
    return fail("id", creating ? "ID は半角英数字と . _ - の 64 文字までで入力してください" : "不正な ID です");
  }

  const targetUrl = str(b.targetUrl);
  if (targetUrl) {
    let ok = targetUrl.length <= 500;
    try {
      const u = new URL(targetUrl);
      ok = ok && (u.protocol === "https:" || u.protocol === "http:");
    } catch {
      ok = false;
    }
    if (!ok) return fail("targetUrl", "転送先は https:// または http:// で始まる URL にしてください");
  }

  const nameJp = str(b.nameJp);
  const nameEn = str(b.nameEn);
  if (nameJp.length > 40) return fail("nameJp", "氏名（和文）は 40 文字までです");
  if (nameEn.length > 60) return fail("nameEn", "氏名（英文）は 60 文字までです");

  const role = str(b.role);
  if (role && !roles.some((r) => r.jp === role)) {
    return fail("role", "選択肢にない肩書きです（「肩書き」タブで追加できます）");
  }

  const email = str(b.email).replace(/^mailto:/i, "");
  if (email && (email.length > 100 || !EMAIL.test(email))) {
    return fail("email", "メールアドレスの形式が正しくありません");
  }

  const githubId = normalizeHandle(str(b.githubId), ["github.com"]);
  if (githubId && !HANDLE.test(githubId)) return fail("githubId", "GitHub の ID に使えない文字が含まれています");
  const xId = normalizeHandle(str(b.xId), ["x.com", "twitter.com"]);
  if (xId && !HANDLE.test(xId)) return fail("xId", "X の ID に使えない文字が含まれています");

  const tags = (Array.isArray(b.skills) ? b.skills : str(b.skills).split(/[,、，]/))
    .map((t) => str(t))
    .filter(Boolean);
  if (tags.length > 10) return fail("skills", "スキルは 10 個までです");
  if (tags.some((t) => t.length > 24)) return fail("skills", "スキル 1 つは 24 文字までです");

  return {
    value: {
      id,
      active: b.active === true,
      targetUrl,
      nameJp,
      nameEn,
      role,
      email,
      githubId,
      xId,
      skills: tags.join(", "),
    },
  };
}

function validateRoles(raw: unknown): { roles: Role[] } | Failure {
  if (!Array.isArray(raw)) return { error: "roles が不正です" };
  if (raw.length > 30) return { error: "肩書きは 30 個までです" };
  const roles: Role[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    const jp = str((r as Role)?.jp);
    const en = str((r as Role)?.en);
    if (!validRoleText(jp, 16)) return { error: `肩書き「${jp}」は 16 文字までで、引用符やバックスラッシュは使えません`, field: "jp" };
    if (!validRoleText(en, 40)) return { error: `「${jp}」の英訳は必須です（40 文字まで、引用符やバックスラッシュは不可）`, field: "en" };
    if (seen.has(jp)) return { error: `肩書き「${jp}」が重複しています`, field: "jp" };
    seen.add(jp);
    roles.push({ jp, en });
  }
  return { roles };
}

/* ── 認証 ─────────────────────────────────────────────── */

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(`tq-admin:${secret}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

const toHex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const fromHex = (s: string) =>
  Uint8Array.from(s.match(/.{1,2}/g) ?? [], (h) => Number.parseInt(h, 16));

async function makeToken(secret: string): Promise<string> {
  const exp = String(Date.now() + SESSION_MS);
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(exp));
  return `${exp}.${toHex(sig)}`;
}

async function isAuthed(request: Request, secret: string): Promise<boolean> {
  const cookie = request.headers.get("Cookie") ?? "";
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!m) return false;
  const [exp, sig] = m[1].split(".");
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) < Date.now() || !/^[0-9a-f]{64}$/.test(sig)) {
    return false;
  }
  return crypto.subtle.verify("HMAC", await hmacKey(secret), fromHex(sig), enc.encode(exp));
}

async function passwordMatches(secret: string, input: string): Promise<boolean> {
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(input)),
    crypto.subtle.digest("SHA-256", enc.encode(secret)),
  ]);
  return crypto.subtle.timingSafeEqual(a, b);
}

async function login(request: Request, env: Env, secret: string, url: URL): Promise<Response> {
  // 総当たり対策: Cloudflare の Rate Limiting（IP ごとに 1 分 5 回）。バインドが無い環境では無効
  const limiter = (env as { LOGIN_LIMITER?: { limit(o: { key: string }): Promise<{ success: boolean }> } })
    .LOGIN_LIMITER;
  if (limiter) {
    const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
    const { success } = await limiter.limit({ key: `admin-login:${ip}` });
    if (!success) return json({ error: "試行回数が多すぎます。1 分ほど待ってからお試しください。" }, 429);
  }

  let password = "";
  try {
    password = str(((await request.json()) as { password?: unknown }).password);
  } catch {
    return json({ error: "bad request" }, 400);
  }

  if (!password || !(await passwordMatches(secret, password))) {
    await new Promise((r) => setTimeout(r, 600)); // 失敗は遅らせる
    return json({ error: "パスワードが違います" }, 401);
  }

  const secure = url.protocol === "https:" ? "; Secure" : "";
  return json(
    { ok: true },
    200,
    { "Set-Cookie": `${COOKIE}=${await makeToken(secret)}; Path=/admin; HttpOnly; SameSite=Strict; Max-Age=${SESSION_MS / 1000}${secure}` },
  );
}

function logout(url: URL): Response {
  const secure = url.protocol === "https:" ? "; Secure" : "";
  return json({ ok: true }, 200, {
    "Set-Cookie": `${COOKIE}=; Path=/admin; HttpOnly; SameSite=Strict; Max-Age=0${secure}`,
  });
}

/* ── ヘルパ ───────────────────────────────────────────── */

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers },
  });
}

function page(html: string, status: number): Response {
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
      "Referrer-Policy": "no-referrer",
      "X-Frame-Options": "DENY",
    },
  });
}
