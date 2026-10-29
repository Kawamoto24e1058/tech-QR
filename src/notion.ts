/**
 * Notion Database へのアクセス（このシステムのデータ置き場は Notion だけ）。
 *
 * 1 行 = 1 メンバー。`ID`(Title) をキーに引く。公式 SDK は使わず fetch 直叩き。
 *   ID / Active / TargetURL / Name_JP / Name_EN / Role / Role_EN /
 *   Email / Github_ID / X_ID / SkillTags
 *
 * 読み取りは公開ページ・名刺用、書き込み（create/update/archive・肩書き管理）は /admin 用。
 * Notion 側で直接編集しても同じデータを見るので、両方の入口が併存できる。
 */
import type { CardFields } from "./card-template";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

/** `:id` に使える文字。URL・SVGファイル名・Notion クエリへ渡す前に必ず検査する */
export const ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

export interface NotionEnv {
  NOTION_API_KEY: string;
  NOTION_DATABASE_ID: string;
  /** テスト用モックサーバーへ向けるときだけ設定 */
  NOTION_API_BASE?: string;
}

/** 公開ページ・名刺に出してよい情報だけを持つメンバー */
export interface Member {
  /** Notion のページ ID（更新・削除に使う。公開ページには出さない） */
  pageId: string;
  id: string;
  /** false の人は QR もプロフィールも 404 */
  active: boolean;
  /** 空ならプロフィールページ、入っていればその URL へ転送 */
  targetUrl: string;
  fields: CardFields;
}

export interface MemberSummary {
  id: string;
  name: string;
  active: boolean;
}

/** 管理画面のフォームが送る（＝Notion に書く）内容 */
export interface MemberInput {
  id: string;
  active: boolean;
  targetUrl: string;
  nameJp: string;
  nameEn: string;
  role: string;
  email: string;
  githubId: string;
  xId: string;
  /** "A, B, C" 形式 */
  skills: string;
}

export interface Role {
  jp: string;
  en: string;
}

/* ── 低レベル ─────────────────────────────────────────── */

async function call(env: NotionEnv, method: string, path: string, body?: unknown): Promise<any> {
  const res = await fetch(`${env.NOTION_API_BASE || NOTION_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.NOTION_API_KEY}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Notion API ${res.status}: ${detail.slice(0, 500)}`);
  }
  return res.json();
}

const queryDb = (env: NotionEnv, body: unknown): Promise<NotionQueryResponse> =>
  call(env, "POST", `/databases/${env.NOTION_DATABASE_ID}/query`, body);

/* ── 読み取り ─────────────────────────────────────────── */

/** ID(Title) の完全一致で 1 人取得。いなければ null */
export async function getMember(id: string, env: NotionEnv): Promise<Member | null> {
  const data = await queryDb(env, { page_size: 1, filter: { property: "ID", title: { equals: id } } });
  const page = data.results?.[0];
  return page ? toMember(page) : null;
}

/** 全メンバーを ID 昇順で取得（プレビュー一覧用） */
export async function listMembers(env: NotionEnv): Promise<MemberSummary[]> {
  return (await listMembersFull(env)).map((m) => ({
    id: m.id,
    name: m.fields.nameJp,
    active: m.active,
  }));
}

/** 全メンバーを詳細つきで取得（管理画面用） */
export async function listMembersFull(env: NotionEnv): Promise<Member[]> {
  const out: Member[] = [];
  let cursor: string | undefined;
  do {
    const data = await queryDb(env, {
      page_size: 100,
      start_cursor: cursor,
      sorts: [{ property: "ID", direction: "ascending" }],
    });
    for (const page of data.results ?? []) {
      const m = toMember(page);
      if (m.id) out.push(m);
    }
    cursor = data.has_more ? (data.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return out;
}

/* ── 書き込み（管理画面） ─────────────────────────────── */

const rich = (s: string) => ({ rich_text: s ? [{ text: { content: s } }] : [] });

function toProperties(i: MemberInput, withId: boolean): Record<string, unknown> {
  const props: Record<string, unknown> = {
    Active: { checkbox: i.active },
    TargetURL: { url: i.targetUrl || null },
    Name_JP: rich(i.nameJp),
    Name_EN: rich(i.nameEn),
    Role: { select: i.role ? { name: i.role } : null },
    Email: { url: i.email || null },
    Github_ID: rich(i.githubId),
    X_ID: rich(i.xId),
    SkillTags: rich(i.skills),
  };
  if (withId) props.ID = { title: [{ text: { content: i.id } }] };
  return props;
}

export async function createMember(i: MemberInput, env: NotionEnv): Promise<Member> {
  const page = await call(env, "POST", "/pages", {
    parent: { database_id: env.NOTION_DATABASE_ID },
    properties: toProperties(i, true),
  });
  return toMember(page);
}

/** ID は URL（印刷済みQR）の鍵なので更新しない */
export async function updateMember(pageId: string, i: MemberInput, env: NotionEnv): Promise<Member> {
  const page = await call(env, "PATCH", `/pages/${pageId}`, { properties: toProperties(i, false) });
  return toMember(page);
}

/** Notion のゴミ箱へ移す（Notion 側から復元できる） */
export async function archiveMember(pageId: string, env: NotionEnv): Promise<void> {
  await call(env, "PATCH", `/pages/${pageId}`, { archived: true });
}

/* ── 肩書き（Role の選択肢 + Role_EN の数式）─────────────── */

const FORMULA_PAIR = /prop\("Role"\)\s*==\s*"((?:[^"\\]|\\.)*)"\s*,\s*"((?:[^"\\]|\\.)*)"/g;
const COLORS = ["red", "orange", "yellow", "green", "blue", "purple", "pink", "brown", "gray"];

/** `Role` の選択肢（並び順）と、`Role_EN` の数式から読み取った英訳 */
export async function getRoles(env: NotionEnv): Promise<{ roles: Role[]; warnings: string[] }> {
  const db = await call(env, "GET", `/databases/${env.NOTION_DATABASE_ID}`);
  const options: Array<{ name: string }> = db.properties?.Role?.select?.options ?? [];
  const expr: string = db.properties?.Role_EN?.formula?.expression ?? "";

  const en = new Map<string, string>();
  for (const m of expr.matchAll(FORMULA_PAIR)) en.set(m[1], m[2]);

  const roles = options.map((o) => ({ jp: o.name, en: en.get(o.name) ?? "" }));
  const warnings: string[] = [];
  const missing = roles.filter((r) => !r.en).map((r) => r.jp);
  if (missing.length) warnings.push(`英訳が未設定: ${missing.join("、")}`);
  return { roles, warnings };
}

/** 肩書きとして安全に数式へ埋め込める文字列か */
export function validRoleText(s: string, max: number): boolean {
  return s.length > 0 && s.length <= max && !/["\\\u0000-\u001f]/.test(s);
}

export function buildRoleFormula(roles: Role[]): string {
  let expr = '""';
  for (const r of [...roles].reverse()) expr = `if(prop("Role") == "${r.jp}", "${r.en}", ${expr})`;
  return expr;
}

/** Role の選択肢を更新し、Role_EN の数式を作り直す（既存の選択肢は色を保つ） */
export async function saveRoles(roles: Role[], env: NotionEnv): Promise<void> {
  const db = await call(env, "GET", `/databases/${env.NOTION_DATABASE_ID}`);
  const existing: Array<{ id?: string; name: string; color?: string }> =
    db.properties?.Role?.select?.options ?? [];
  const byName = new Map(existing.map((o) => [o.name, o]));

  let nextColor = existing.length;
  const options = roles.map((r) => {
    const cur = byName.get(r.jp);
    return cur
      ? { id: cur.id, name: cur.name, color: cur.color }
      : { name: r.jp, color: COLORS[nextColor++ % COLORS.length] };
  });

  await call(env, "PATCH", `/databases/${env.NOTION_DATABASE_ID}`, {
    properties: {
      Role: { select: { options } },
      Role_EN: { formula: { expression: buildRoleFormula(roles) } },
    },
  });
}

/* ── Notion ページ → Member ───────────────────────────── */

function toMember(page: NotionPage): Member {
  return {
    pageId: page.id ?? "",
    id: text(page, "ID"),
    active: checkbox(page, "Active"),
    targetUrl: url(page, "TargetURL"),
    fields: {
      id: text(page, "ID"),
      nameJp: text(page, "Name_JP"),
      nameEn: text(page, "Name_EN"),
      roleJp: text(page, "Role"),
      roleEn: text(page, "Role_EN"),
      email: url(page, "Email").replace(/^mailto:/i, "").trim(),
      githubId: normalizeHandle(text(page, "Github_ID"), ["github.com"]),
      xId: normalizeHandle(text(page, "X_ID"), ["x.com", "twitter.com"]),
      skillTags: text(page, "SkillTags")
        .split(/[,、，]/)
        .map((t) => t.trim())
        .filter(Boolean),
    },
  };
}

/** "@name" / "https://github.com/name/" などを "name" に正規化 */
export function normalizeHandle(raw: string, hosts: string[]): string {
  let s = raw.trim().replace(/^@/, "");
  for (const host of hosts) {
    s = s.replace(new RegExp(`^https?://(www\\.)?${host.replace(/\./g, "\\.")}/`, "i"), "");
  }
  return s.replace(/[/\s]+$/, "");
}

/* ── プロパティ読み取り ───────────────────────────────── */

/** title / rich_text / select / formula(string) を平文で */
function text(page: NotionPage, name: string): string {
  const p = page.properties?.[name];
  if (!p) return "";
  const parts = p.title ?? p.rich_text;
  if (parts) return parts.map((t) => t.plain_text ?? "").join("").trim();
  if (p.select) return (p.select.name ?? "").trim();
  if (p.formula?.type === "string" || p.formula?.string != null) {
    return (p.formula.string ?? "").trim();
  }
  return "";
}

/** url プロパティ（無ければ rich_text も試す） */
function url(page: NotionPage, name: string): string {
  return (page.properties?.[name]?.url ?? "").trim() || text(page, name);
}

function checkbox(page: NotionPage, name: string): boolean {
  return page.properties?.[name]?.checkbox === true;
}

/* ── Notion API の型（必要な部分のみ）─────────────────── */

interface NotionProperty {
  title?: Array<{ plain_text?: string }>;
  rich_text?: Array<{ plain_text?: string }>;
  url?: string | null;
  checkbox?: boolean;
  select?: { name?: string } | null;
  formula?: { type?: string; string?: string | null };
}
interface NotionPage {
  id?: string;
  properties?: Record<string, NotionProperty | undefined>;
}
interface NotionQueryResponse {
  results?: NotionPage[];
  has_more?: boolean;
  next_cursor?: string | null;
}
