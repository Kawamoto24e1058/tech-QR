/**
 * Notion Database への読み取りアクセス（このシステムの「管理画面」はここだけ）。
 *
 * 1 行 = 1 メンバー。`ID`(Title) をキーに引く。公式 SDK は使わず fetch 直叩き。
 *   ID / Active / TargetURL / Name_JP / Name_EN / Role / Role_EN /
 *   Email / Github_ID / X_ID / SkillTags
 */
import type { CardFields } from "./card-template";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

/** `:id` に使える文字。URL・SVGファイル名・Notion クエリへ渡す前に必ず検査する */
export const ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

export interface NotionEnv {
  NOTION_API_KEY: string;
  NOTION_DATABASE_ID: string;
}

/** 公開ページ・名刺に出してよい情報だけを持つメンバー */
export interface Member {
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

/* ── 取得 ─────────────────────────────────────────────── */

async function query(env: NotionEnv, body: unknown): Promise<NotionQueryResponse> {
  const res = await fetch(`${NOTION_API}/databases/${env.NOTION_DATABASE_ID}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.NOTION_API_KEY}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Notion API ${res.status}: ${detail.slice(0, 500)}`);
  }
  return (await res.json()) as NotionQueryResponse;
}

/** ID(Title) の完全一致で 1 人取得。いなければ null */
export async function getMember(id: string, env: NotionEnv): Promise<Member | null> {
  const data = await query(env, {
    page_size: 1,
    filter: { property: "ID", title: { equals: id } },
  });
  const page = data.results?.[0];
  return page ? toMember(page) : null;
}

/** 全メンバーを ID 昇順で取得（プレビュー一覧用） */
export async function listMembers(env: NotionEnv): Promise<MemberSummary[]> {
  const out: MemberSummary[] = [];
  let cursor: string | undefined;
  do {
    const data = await query(env, {
      page_size: 100,
      start_cursor: cursor,
      sorts: [{ property: "ID", direction: "ascending" }],
    });
    for (const page of data.results ?? []) {
      const id = text(page, "ID");
      if (id) out.push({ id, name: text(page, "Name_JP"), active: checkbox(page, "Active") });
    }
    cursor = data.has_more ? (data.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return out;
}

/* ── Notion ページ → Member ───────────────────────────── */

function toMember(page: NotionPage): Member {
  return {
    id: text(page, "ID"),
    active: checkbox(page, "Active"),
    targetUrl: url(page, "TargetURL"),
    fields: {
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
function normalizeHandle(raw: string, hosts: string[]): string {
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
  properties?: Record<string, NotionProperty | undefined>;
}
interface NotionQueryResponse {
  results?: NotionPage[];
  has_more?: boolean;
  next_cursor?: string | null;
}
