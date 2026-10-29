import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker from "../src/index";
import { ADMIN_CLIENT_JS } from "../src/admin-page";

const PASSWORD = "test-admin-password";

/* ────────────────────────────────────────────────────────────
 *  書き込みまで模倣する Notion のフェイク
 * ──────────────────────────────────────────────────────────── */

interface FakePage {
  id: string;
  archived: boolean;
  props: Record<string, any>;
}

class FakeNotion {
  pages: FakePage[] = [];
  options = [
    { id: "o1", name: "部長", color: "red" },
    { id: "o2", name: "メンバー", color: "gray" },
  ];
  formula =
    'if(prop("Role") == "部長", "President", if(prop("Role") == "メンバー", "Member", ""))';
  calls: string[] = [];
  failNext = false;
  private seq = 0;

  add(id: string, p: Record<string, any> = {}) {
    this.pages.push({
      id: `page_${++this.seq}`,
      archived: false,
      props: {
        ID: { title: [{ plain_text: id }] },
        Active: { checkbox: p.active ?? true },
        TargetURL: { url: p.targetUrl ?? null },
        Name_JP: rt(p.nameJp ?? ""),
        Name_EN: rt(p.nameEn ?? ""),
        Role: { select: p.role ? { name: p.role } : null },
        Email: { url: p.email ?? null },
        Github_ID: rt(p.githubId ?? ""),
        X_ID: rt(p.xId ?? ""),
        SkillTags: rt(p.skills ?? ""),
      },
    });
  }

  private enFor(role?: string): string {
    for (const m of this.formula.matchAll(/prop\("Role"\)\s*==\s*"([^"]*)"\s*,\s*"([^"]*)"/g)) {
      if (m[1] === role) return m[2];
    }
    return "";
  }

  private render(p: FakePage) {
    return {
      id: p.id,
      properties: {
        ...p.props,
        Role_EN: { formula: { type: "string", string: this.enFor(p.props.Role?.select?.name) } },
      },
    };
  }

  /** Notion の書き込み形式（rich_text.text.content など）を読み取り形式に変換して保存 */
  private apply(page: FakePage, props: Record<string, any>) {
    for (const [k, v] of Object.entries(props)) {
      if (v.title) page.props[k] = { title: v.title.map((t: any) => ({ plain_text: t.text.content })) };
      else if (v.rich_text) page.props[k] = rt(v.rich_text.map((t: any) => t.text.content).join(""));
      else page.props[k] = v;
    }
  }

  fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const u = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (u.host !== "api.notion.com") throw new Error(`unexpected fetch ${u}`);
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    this.calls.push(`${method} ${u.pathname}`);
    if (this.failNext) {
      this.failNext = false;
      return new Response("boom", { status: 500 });
    }
    const ok = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

    const path = u.pathname.replace(/^\/v1/, "");
    if (method === "POST" && /^\/databases\/[^/]+\/query$/.test(path)) {
      const eq = body?.filter?.title?.equals as string | undefined;
      let rows = this.pages.filter((p) => !p.archived);
      if (eq !== undefined) rows = rows.filter((p) => p.props.ID.title[0].plain_text === eq);
      else rows = [...rows].sort((a, b) => (a.props.ID.title[0].plain_text < b.props.ID.title[0].plain_text ? -1 : 1));
      return ok({ results: rows.map((p) => this.render(p)), has_more: false, next_cursor: null });
    }
    if (method === "POST" && path === "/pages") {
      const page: FakePage = { id: `page_${++this.seq}`, archived: false, props: {} };
      this.apply(page, body.properties);
      this.pages.push(page);
      return ok(this.render(page));
    }
    const pm = path.match(/^\/pages\/([^/]+)$/);
    if (method === "PATCH" && pm) {
      const page = this.pages.find((p) => p.id === pm[1]);
      if (!page) return ok({ message: "not found" }, 404);
      if (body.archived) page.archived = true;
      if (body.properties) this.apply(page, body.properties);
      return ok(this.render(page));
    }
    if (method === "GET" && /^\/databases\/[^/]+$/.test(path)) {
      return ok({
        properties: {
          Role: { select: { options: this.options } },
          Role_EN: { formula: { expression: this.formula } },
        },
      });
    }
    if (method === "PATCH" && /^\/databases\/[^/]+$/.test(path)) {
      const opts = body.properties?.Role?.select?.options as Array<{ id?: string; name: string; color?: string }> | undefined;
      if (opts) this.options = opts.map((o, i) => ({ id: o.id ?? `new${i}${o.name}`, name: o.name, color: o.color ?? "default" }));
      const f = body.properties?.Role_EN?.formula?.expression;
      if (f !== undefined) this.formula = f;
      return ok({});
    }
    return ok({ message: `unhandled ${method} ${path}` }, 400);
  };
}

const rt = (s: string) => ({ rich_text: s ? [{ plain_text: s }] : [] });

/* ────────────────────────────────────────────────────────────
 *  呼び出しヘルパ
 * ──────────────────────────────────────────────────────────── */

let notion: FakeNotion;

beforeEach(() => {
  notion = new FakeNotion();
  vi.stubGlobal("fetch", notion.fetch);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function req(path: string, init: RequestInit = {}, e: any = env) {
  const request = new Request(`https://qr.test${path}`, init);
  const ctx = createExecutionContext();
  const res = await worker.fetch(request, e, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

let ipSeq = 0;
/** 回数制限は IP 単位なので、テストごとに別 IP から入る */
async function login(ip = `10.0.0.${++ipSeq}`): Promise<string> {
  const res = await req("/admin/login", {
    method: "POST",
    headers: { "content-type": "application/json", "CF-Connecting-IP": ip },
    body: JSON.stringify({ password: PASSWORD }),
  });
  expect(res.status).toBe(200);
  return res.headers.get("Set-Cookie")!.split(";")[0];
}

async function api(cookie: string, method: string, path: string, body?: unknown) {
  return req(path, {
    method,
    headers: { cookie, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const member = (over: Record<string, unknown> = {}) => ({
  id: "taro",
  active: true,
  targetUrl: "",
  nameJp: "山田 太郎",
  nameEn: "Taro Yamada",
  role: "部長",
  email: "taro@example.com",
  githubId: "@taro-dev",
  xId: "https://x.com/taro_dev/",
  skills: ["TypeScript", "Cloudflare"],
  ...over,
});

/* ────────────────────────────────────────────────────────────
 *  認証
 * ──────────────────────────────────────────────────────────── */

describe("/admin authentication", () => {
  it("is disabled (503) until ADMIN_PASSWORD is configured", async () => {
    const res = await req("/admin", {}, { ...env, ADMIN_PASSWORD: undefined });
    expect(res.status).toBe(503);
    expect(await res.text()).toContain("ADMIN_PASSWORD");
    const api = await req("/admin/api/members", {}, { ...env, ADMIN_PASSWORD: undefined });
    expect(api.status).toBe(503);
  });

  it("shows the login page when signed out, and rejects the API with 401", async () => {
    const page = await req("/admin");
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('type="password"');
    expect((await req("/admin/api/members")).status).toBe(401);
    expect((await req("/admin/api/roles")).status).toBe(401);
  });

  it("rejects a wrong password and accepts the right one with an HttpOnly cookie", async () => {
    const bad = await req("/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json", "CF-Connecting-IP": "198.51.100.1" },
      body: JSON.stringify({ password: "nope" }),
    });
    expect(bad.status).toBe(401);
    expect(bad.headers.get("Set-Cookie")).toBeNull();

    const good = await req("/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json", "CF-Connecting-IP": "198.51.100.2" },
      body: JSON.stringify({ password: PASSWORD }),
    });
    const cookie = good.headers.get("Set-Cookie")!;
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Path=/admin");
    expect(cookie).toContain("Secure"); // https のとき
  });

  it("rate-limits repeated login attempts from one IP (brute-force guard)", async () => {
    const attempt = () =>
      req("/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json", "CF-Connecting-IP": "203.0.113.9" },
        body: JSON.stringify({ password: PASSWORD }),
      });
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) statuses.push((await attempt()).status);
    expect(statuses.slice(0, 5).every((s) => s === 200)).toBe(true);
    expect(statuses).toContain(429);
    // 別の IP は影響を受けない
    expect((await login("203.0.113.10")).startsWith("tq_admin=")).toBe(true);
  });

  it("serves the editor shell only to a signed-in session", async () => {
    const cookie = await login();
    const page = await req("/admin", { headers: { cookie } });
    const html = await page.text();
    expect(html).toContain('id="app"');
    expect(html).toContain('data-base="https://qr.test"');
    expect(page.headers.get("X-Frame-Options")).toBe("DENY");
  });

  it("rejects forged and expired tokens", async () => {
    const forged = await api("tq_admin=9999999999999.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "GET", "/admin/api/members");
    expect(forged.status).toBe(401);
    const expired = await api("tq_admin=1.0000000000000000000000000000000000000000000000000000000000000000", "GET", "/admin/api/members");
    expect(expired.status).toBe(401);
  });

  it("a session signed with a different password is invalid (rotating the password logs everyone out)", async () => {
    const cookie = await login();
    const res = await req("/admin/api/members", { headers: { cookie } }, { ...env, ADMIN_PASSWORD: "rotated-password" });
    expect(res.status).toBe(401);
  });

  it("logout clears the cookie", async () => {
    const cookie = await login();
    const res = await api(cookie, "POST", "/admin/logout");
    expect(res.headers.get("Set-Cookie")).toContain("Max-Age=0");
  });

  it("blocks cross-origin writes (CSRF)", async () => {
    const cookie = await login();
    const res = await req("/admin/api/members", {
      method: "POST",
      headers: { cookie, "content-type": "application/json", Origin: "https://evil.example" },
      body: JSON.stringify(member()),
    });
    expect(res.status).toBe(403);
    expect(notion.pages.length).toBe(0);
  });
});

/* ────────────────────────────────────────────────────────────
 *  メンバー
 * ──────────────────────────────────────────────────────────── */

describe("/admin/api/members", () => {
  it("lists members in the edit shape", async () => {
    notion.add("haru", { nameJp: "川本", role: "部長", skills: "TS, Go" });
    const cookie = await login();
    const { members } = (await (await api(cookie, "GET", "/admin/api/members")).json()) as any;
    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({ id: "haru", nameJp: "川本", role: "部長", roleEn: "President", skills: ["TS", "Go"], active: true });
    expect(members[0].pageId).toBeUndefined(); // Notion の内部IDは返さない
  });

  it("creates a member in Notion with normalized values, and the public pages see it", async () => {
    const cookie = await login();
    const res = await api(cookie, "POST", "/admin/api/members", member());
    expect(res.status).toBe(201);
    const { member: m } = (await res.json()) as any;
    expect(m).toMatchObject({
      id: "taro",
      githubId: "taro-dev", // @ を除去
      xId: "taro_dev", // URL から ID だけに
      roleEn: "President",
      skills: ["TypeScript", "Cloudflare"],
      targetUrl: "",
    });

    // Notion に入った形
    const page = notion.pages[0];
    expect(page.props.Active.checkbox).toBe(true);
    expect(page.props.SkillTags.rich_text[0].plain_text).toBe("TypeScript, Cloudflare");
    expect(page.props.TargetURL.url).toBeNull();

    // 公開側（QR の着地点）にも即反映される = プロフィールが出る
    const pub = await req("/p/taro");
    expect(pub.status).toBe(200);
    expect(await pub.text()).toContain("山田 太郎");
  });

  it("refuses duplicate IDs, bad IDs, bad URLs, unknown roles and bad emails with field errors", async () => {
    notion.add("taro");
    const cookie = await login();
    const post = (over: Record<string, unknown>) => api(cookie, "POST", "/admin/api/members", member(over));

    const dup = await post({ id: "taro" });
    expect(dup.status).toBe(409);
    expect(((await dup.json()) as any).field).toBe("id");

    for (const [over, field] of [
      [{ id: "bad id!" }, "id"],
      [{ id: "ok", targetUrl: "javascript:alert(1)" }, "targetUrl"],
      [{ id: "ok", role: "魔王" }, "role"],
      [{ id: "ok", email: "not-an-email" }, "email"],
      [{ id: "ok", githubId: 'a" onmouseover="x' }, "githubId"],
      [{ id: "ok", nameJp: "あ".repeat(41) }, "nameJp"],
      [{ id: "ok", skills: Array.from({ length: 11 }, (_, i) => `s${i}`) }, "skills"],
    ] as const) {
      const res = await post(over as Record<string, unknown>);
      expect(res.status, JSON.stringify(over)).toBe(422);
      expect(((await res.json()) as any).field).toBe(field);
    }
    expect(notion.pages.length).toBe(1); // 何も書き込まれていない
  });

  it("updates a member (ID is the URL key and can never change) and busts the public cache", async () => {
    notion.add("haru", { nameJp: "旧名", role: "メンバー", targetUrl: "https://example.org/old" });
    const cookie = await login();

    // 転送 -> プロフィールに切り替え（targetUrl を空に）
    const res = await api(cookie, "PATCH", "/admin/api/members/haru", member({ id: "hijack", nameJp: "新名", role: "部長", targetUrl: "" }));
    expect(res.status).toBe(200);
    const { member: m } = (await res.json()) as any;
    expect(m.id).toBe("haru"); // body の id は無視される
    expect(m.nameJp).toBe("新名");
    expect(m.roleEn).toBe("President");
    expect(notion.pages[0].props.ID.title[0].plain_text).toBe("haru");

    const pub = await req("/p/haru");
    expect(pub.status).toBe(200); // もう転送ではなくプロフィール
    expect(await pub.text()).toContain("新名");
  });

  it("switches the QR landing to a redirect when a target URL is saved", async () => {
    notion.add("haru", { nameJp: "川本" });
    const cookie = await login();
    await api(cookie, "PATCH", "/admin/api/members/haru", member({ targetUrl: "https://example.org/me" }));
    const pub = await req("/p/haru");
    expect(pub.status).toBe(302);
    expect(pub.headers.get("Location")).toBe("https://example.org/me");
  });

  it("deactivating makes the QR 404; delete archives the Notion page", async () => {
    notion.add("haru", { nameJp: "川本" });
    const cookie = await login();
    await api(cookie, "PATCH", "/admin/api/members/haru", member({ active: false }));
    expect((await req("/p/haru")).status).toBe(404);

    const del = await api(cookie, "DELETE", "/admin/api/members/haru");
    expect(del.status).toBe(200);
    expect(notion.pages[0].archived).toBe(true);
    expect(((await (await api(cookie, "GET", "/admin/api/members")).json()) as any).members).toHaveLength(0);
  });

  it("404s for an unknown member and reports Notion failures as 502 without leaking details", async () => {
    const cookie = await login();
    expect((await api(cookie, "PATCH", "/admin/api/members/ghost", member())).status).toBe(404);
    expect((await api(cookie, "DELETE", "/admin/api/members/ghost")).status).toBe(404);

    notion.failNext = true;
    const res = await api(cookie, "GET", "/admin/api/members");
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain("boom");
  });
});

/* ────────────────────────────────────────────────────────────
 *  肩書き
 * ──────────────────────────────────────────────────────────── */

describe("/admin/api/roles", () => {
  it("reads the options, the English mapping parsed from the formula, and usage counts", async () => {
    notion.add("a", { role: "部長" });
    notion.add("b", { role: "部長" });
    const cookie = await login();
    const j = (await (await api(cookie, "GET", "/admin/api/roles")).json()) as any;
    expect(j.roles).toEqual([
      { jp: "部長", en: "President" },
      { jp: "メンバー", en: "Member" },
    ]);
    expect(j.usage).toEqual({ 部長: 2 });
    expect(j.warnings).toEqual([]);
  });

  it("adds a role: updates the select options (keeping existing ids/colours) and rebuilds the formula", async () => {
    const cookie = await login();
    const res = await api(cookie, "PUT", "/admin/api/roles", {
      roles: [
        { jp: "部長", en: "President" },
        { jp: "会計", en: "Treasurer" },
        { jp: "メンバー", en: "Member" },
      ],
    });
    expect(res.status).toBe(200);
    expect(notion.options.map((o) => o.name)).toEqual(["部長", "会計", "メンバー"]);
    expect(notion.options[0]).toMatchObject({ id: "o1", color: "red" }); // 既存は保持
    expect(notion.formula).toBe(
      'if(prop("Role") == "部長", "President", if(prop("Role") == "会計", "Treasurer", if(prop("Role") == "メンバー", "Member", "")))',
    );

    // 追加した肩書きがメンバーに使え、英訳が自動で付く
    const created = await api(cookie, "POST", "/admin/api/members", member({ id: "kai", role: "会計" }));
    expect(((await created.json()) as any).member.roleEn).toBe("Treasurer");
  });

  it("can fix an English translation of a role that is in use", async () => {
    notion.add("a", { role: "部長" });
    const cookie = await login();
    const res = await api(cookie, "PUT", "/admin/api/roles", {
      roles: [{ jp: "部長", en: "Club President" }, { jp: "メンバー", en: "Member" }],
    });
    expect(res.status).toBe(200);
    const { members } = (await (await api(cookie, "GET", "/admin/api/members")).json()) as any;
    expect(members[0].roleEn).toBe("Club President");
  });

  it("refuses to delete or rename a role that members still use", async () => {
    notion.add("a", { role: "メンバー" });
    const cookie = await login();
    const res = await api(cookie, "PUT", "/admin/api/roles", { roles: [{ jp: "部長", en: "President" }] });
    expect(res.status).toBe(409);
    expect(((await res.json()) as any).error).toContain("メンバー");
    expect(notion.options.map((o) => o.name)).toEqual(["部長", "メンバー"]); // 変更されていない
  });

  it("validates role text (no quotes/backslashes that could break the formula, no duplicates, English required)", async () => {
    const cookie = await login();
    const put = (roles: unknown) => api(cookie, "PUT", "/admin/api/roles", { roles });
    expect((await put([{ jp: 'a"b', en: "x" }])).status).toBe(422);
    expect((await put([{ jp: "会計", en: 'Tre"asurer' }])).status).toBe(422);
    expect((await put([{ jp: "会計", en: "x\\" }])).status).toBe(422);
    expect((await put([{ jp: "会計", en: "" }])).status).toBe(422);
    expect((await put([{ jp: "会計", en: "A" }, { jp: "会計", en: "B" }])).status).toBe(422);
    expect((await put("nope")).status).toBe(422);
    expect(notion.formula).toContain("President"); // 何も書き換わっていない
  });

  it("warns when a role has no English translation in the formula", async () => {
    notion.options.push({ id: "o3", name: "広報", color: "blue" });
    const cookie = await login();
    const j = (await (await api(cookie, "GET", "/admin/api/roles")).json()) as any;
    expect(j.warnings[0]).toContain("広報");
  });
});

/* ────────────────────────────────────────────────────────────
 *  管理画面のクライアント
 * ──────────────────────────────────────────────────────────── */

describe("admin client script", () => {
  it("contains no template-literal leftovers and ships in the page", async () => {
    expect(ADMIN_CLIENT_JS).not.toContain("${");
    expect(ADMIN_CLIENT_JS).not.toContain("`");
    const cookie = await login();
    const html = await (await req("/admin", { headers: { cookie } })).text();
    expect(html).toContain("function saveMember");
    expect(html).not.toContain("${");
  });
});
