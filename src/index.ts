/**
 * tech-QR : Notion Database を管理画面(ヘッドレスCMS)にした Cloudflare Worker
 *
 * ルーティング:
 *   GET /preview            -> メンバー一覧(HTML)
 *   GET /preview/:id        -> 表裏の名刺を画面表示 + そこからSVGダウンロード(HTML)
 *   GET /p/:id             -> Notion の ID(Title)=:id かつ Active=true のレコードの
 *                             TargetURL へ 302/307 リダイレクト。該当なし -> 404
 *   GET /generate/:id       -> 名刺の表面SVGを生成し attachment で返す。該当なし -> 404
 *   GET /generate/:id/back  -> 名刺の裏面SVG(メンバー別QR入り)を生成し attachment で返す
 *   GET /health             -> 200 OK (疎通確認)
 *   その他                  -> DEFAULT_REDIRECT_URL へフォールバックリダイレクト
 */

import { buildBackCard, buildFrontCard, escapeXml, type CardFields } from "./card-template";
import { buildCardPreview, buildIndexPage, type MemberSummary } from "./preview";

/**
 * 環境変数 / シークレット。
 * - `NOTION_API_KEY` (secret): Notion Internal Integration Token
 * - `NOTION_DATABASE_ID` (var): Notion Database ID (32文字, ダッシュ有無可)
 * - `DEFAULT_REDIRECT_URL` (var): 未定義パスへアクセスされた時のフォールバック先
 * - `REDIRECT_STATUS` (var): "302" | "307" (未指定なら 302)
 * - `CACHE_TTL_SECONDS` (var): /p/:id のエッジキャッシュTTL秒。"0"/未指定でキャッシュ無効
 * - `PUBLIC_BASE_URL` (var): 裏面QRに埋め込む公開URLの基点。空ならリクエストのoriginを使用
 *
 * 実体の型は `wrangler types` が生成する `Cloudflare.Env` +
 * `worker-env.d.ts` のシークレット宣言。
 */
export type Env = Cloudflare.Env;

const NOTION_API_BASE = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

/** ID プロパティに使える文字。SSRF / インジェクション回避のため厳しめに制限 */
const ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    // GET / HEAD 以外は許可しない
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { Allow: "GET, HEAD", "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    // /health : 疎通確認
    if (pathname === "/health") {
      return Response.json(
        { status: "ok", time: new Date().toISOString() },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const base = (env.PUBLIC_BASE_URL || url.origin).replace(/\/+$/, "");

    // /preview : メンバー一覧
    if (pathname === "/preview" || pathname === "/preview/") {
      let members: MemberSummary[];
      try {
        members = await fetchAllMembers(env);
      } catch (err) {
        console.error("fetchAllMembers failed", { error: String(err) });
        return badGateway();
      }
      return htmlResponse(buildIndexPage(members));
    }

    // /preview/:id : 名刺プレビュー
    const previewMatch = pathname.match(/^\/preview\/([^/]+)\/?$/);
    if (previewMatch) {
      const id = decodeURIComponent(previewMatch[1]);
      if (!ID_PATTERN.test(id)) {
        return notFound(id);
      }
      let page: NotionPage | null;
      try {
        page = await fetchMemberById(id, env);
      } catch (err) {
        console.error("fetchMemberById failed", { id, error: String(err) });
        return badGateway();
      }
      if (!page) {
        return notFound(id);
      }
      return htmlResponse(buildCardPreview(id, toCardFields(page), base));
    }

    // /generate/:id[/back] : 名刺SVG生成
    const genMatch = pathname.match(/^\/generate\/([^/]+?)(?:\.svg)?(\/back)?(?:\.svg)?\/?$/);
    if (genMatch) {
      const id = decodeURIComponent(genMatch[1]);
      const isBack = Boolean(genMatch[2]);
      if (!ID_PATTERN.test(id)) {
        return notFound(id);
      }

      let page: NotionPage | null;
      try {
        page = await fetchMemberById(id, env);
      } catch (err) {
        console.error("fetchMemberById failed", { id, error: String(err) });
        return badGateway();
      }
      if (!page) {
        return notFound(id);
      }

      const fields = toCardFields(page);
      if (isBack) {
        return svgDownload(buildBackCard(fields, `${base}/p/${id}`), `${id}-card-back`);
      }
      return svgDownload(buildFrontCard(fields), `${id}-card-front`);
    }

    // /p/:id : リダイレクト処理
    const redirectMatch = pathname.match(/^\/p\/([^/]+)\/?$/);
    if (redirectMatch) {
      const id = decodeURIComponent(redirectMatch[1]);
      if (!ID_PATTERN.test(id)) {
        return notFound(id);
      }

      let target: string | null;
      try {
        target = await resolveTarget(id, env, ctx);
      } catch (err) {
        console.error("resolveTarget failed", { id, error: String(err) });
        return badGateway();
      }

      if (!target) {
        return notFound(id);
      }
      return redirect(target, env);
    }

    // ルート / その他すべて : デフォルトURLへフォールバック
    return redirect(env.DEFAULT_REDIRECT_URL, env);
  },
} satisfies ExportedHandler<Env>;

/* ────────────────────────────────────────────────────────────
 *  Notion 連携
 * ──────────────────────────────────────────────────────────── */

/** Notion Database を ID(Title) で検索して 1 レコード返す。該当なしは null */
async function fetchMemberById(id: string, env: Env): Promise<NotionPage | null> {
  const res = await fetch(`${NOTION_API_BASE}/databases/${env.NOTION_DATABASE_ID}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.NOTION_API_KEY}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      page_size: 1,
      filter: { property: "ID", title: { equals: id } },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Notion API ${res.status}: ${detail.slice(0, 500)}`);
  }

  const data = (await res.json()) as NotionQueryResponse;
  return data.results?.[0] ?? null;
}

/** Notion Database の全レコードを ID 昇順で取得（プレビュー一覧用） */
async function fetchAllMembers(env: Env): Promise<MemberSummary[]> {
  const members: MemberSummary[] = [];
  let cursor: string | undefined;

  do {
    const res = await fetch(`${NOTION_API_BASE}/databases/${env.NOTION_DATABASE_ID}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.NOTION_API_KEY}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        page_size: 100,
        start_cursor: cursor,
        sorts: [{ property: "ID", direction: "ascending" }],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Notion API ${res.status}: ${detail.slice(0, 500)}`);
    }

    const data = (await res.json()) as NotionQueryResponse;
    for (const page of data.results ?? []) {
      const id = getPlainText(page, "ID");
      if (id) {
        members.push({ id, name: getPlainText(page, "Name_JP"), active: getCheckbox(page, "Active") });
      }
    }
    cursor = data.has_more ? data.next_cursor ?? undefined : undefined;
  } while (cursor);

  return members;
}

/**
 * :id に対応する転送先URLを返す。Active=false / 該当なし / 不正URL は null。
 * CACHE_TTL_SECONDS > 0 の場合は Cloudflare Cache API で結果を短命キャッシュする。
 */
async function resolveTarget(id: string, env: Env, ctx: ExecutionContext): Promise<string | null> {
  const ttl = toPositiveInt(env.CACHE_TTL_SECONDS);
  const cache = caches.default;
  // キャッシュキーはリクエストURLに依存しない合成キーにする
  const cacheKey = new Request(`https://tech-qr.cache/lookup/${encodeURIComponent(id)}`);

  if (ttl > 0) {
    const cached = await cache.match(cacheKey);
    if (cached) {
      const value = await cached.text();
      return value === "" ? null : value;
    }
  }

  const page = await fetchMemberById(id, env);
  const rawUrl = page ? getUrl(page, "TargetURL") : "";
  const target =
    page && getCheckbox(page, "Active") && isSafeHttpUrl(rawUrl) ? rawUrl : null;

  if (ttl > 0) {
    // null も「存在しない」結果として短くキャッシュし、Notion への連打を防ぐ
    const cacheTtl = target ? ttl : Math.min(ttl, 15);
    const toStore = new Response(target ?? "", {
      headers: { "Cache-Control": `public, max-age=${cacheTtl}`, "Content-Type": "text/plain" },
    });
    ctx.waitUntil(cache.put(cacheKey, toStore));
  }

  return target;
}

/* ── Notion プロパティ読み取り ─────────────────────────────── */

function getProp(page: NotionPage, name: string): NotionProperty | undefined {
  return page.properties?.[name];
}

/** title / rich_text / select / formula(string) プロパティを平文で取得 */
function getPlainText(page: NotionPage, name: string): string {
  const p = getProp(page, name);
  if (!p) return "";
  const parts = p.title ?? p.rich_text;
  if (parts) {
    return parts
      .map((t) => t.plain_text ?? "")
      .join("")
      .trim();
  }
  if (p.select) return (p.select.name ?? "").trim();
  if (p.formula?.type === "string" || p.formula?.string != null) {
    return (p.formula.string ?? "").trim();
  }
  return "";
}

/** url プロパティを取得（無ければ rich_text を試す） */
function getUrl(page: NotionPage, name: string): string {
  const p = getProp(page, name);
  return (p?.url ?? "").trim() || getPlainText(page, name);
}

function getCheckbox(page: NotionPage, name: string): boolean {
  return getProp(page, name)?.checkbox === true;
}

/** Notion ページ -> 名刺フィールド */
function toCardFields(page: NotionPage): CardFields {
  return {
    nameJp: getPlainText(page, "Name_JP"),
    nameEn: getPlainText(page, "Name_EN"),
    roleJp: getPlainText(page, "Role"),
    roleEn: getPlainText(page, "Role_EN"),
    email: getUrl(page, "Email").replace(/^mailto:/i, "").trim(),
    githubId: normalizeHandle(getPlainText(page, "Github_ID"), ["github.com"]),
    xId: normalizeHandle(getPlainText(page, "X_ID"), ["x.com", "twitter.com"]),
    skillTags: getPlainText(page, "SkillTags")
      .split(/[,、，]/)
      .map((t) => t.trim())
      .filter(Boolean),
  };
}

/** "@name" / "https://github.com/name/" などを "name" に正規化 */
function normalizeHandle(raw: string, hosts: string[]): string {
  let s = raw.trim().replace(/^@/, "");
  for (const host of hosts) {
    const re = new RegExp(`^https?://(www\\.)?${host.replace(/\./g, "\\.")}/`, "i");
    s = s.replace(re, "");
  }
  return s.replace(/[/\s]+$/, "");
}

/* ────────────────────────────────────────────────────────────
 *  レスポンス生成ヘルパ
 * ──────────────────────────────────────────────────────────── */

function redirect(location: string, env: Env): Response {
  const status = String(env.REDIRECT_STATUS) === "307" ? 307 : 302;
  const safe = isSafeHttpUrl(location) ? location : "https://github.com/Kawamoto24e1058";
  return new Response(null, {
    status,
    headers: {
      Location: safe,
      // リダイレクト自体はキャッシュさせない(転送先はNotionで即時変更されうる)
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}

function svgDownload(svg: string, basename: string): Response {
  return new Response(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${basename}.svg"`,
      // Notion のデータが随時変わるためキャッシュさせない
      "Cache-Control": "no-store",
    },
  });
}

function htmlResponse(html: string): Response {
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function badGateway(): Response {
  return new Response("Bad Gateway (Notion API error)", {
    status: 502,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function notFound(id: string): Response {
  const body = `<!doctype html>
<html lang="ja">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>404 Not Found</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 32rem; margin: 20vh auto; padding: 0 1.5rem; line-height: 1.7; }
  code { background: #f0f0f0; padding: .1em .4em; border-radius: 4px; }
</style>
<h1>404 Not Found</h1>
<p><code>${escapeXml(id)}</code> は見つかりませんでした。</p>
<p>Notion の ID プロパティを確認してください。</p>
</html>`;
  return new Response(body, {
    status: 404,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/* ────────────────────────────────────────────────────────────
 *  ユーティリティ
 * ──────────────────────────────────────────────────────────── */

function toPositiveInt(value: string | undefined): number {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** http(s) スキームのみ許可 (javascript:, data: 等を弾く) */
function isSafeHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/* ────────────────────────────────────────────────────────────
 *  Notion API レスポンス型 (必要な部分のみ)
 * ──────────────────────────────────────────────────────────── */

interface NotionRichTextItem {
  plain_text?: string;
}

interface NotionProperty {
  type?: string;
  title?: NotionRichTextItem[];
  rich_text?: NotionRichTextItem[];
  url?: string | null;
  checkbox?: boolean;
  select?: { name?: string } | null;
  formula?: { type?: string; string?: string | null };
}

interface NotionPage {
  id: string;
  properties?: Record<string, NotionProperty | undefined>;
}

interface NotionQueryResponse {
  results?: NotionPage[];
  has_more?: boolean;
  next_cursor?: string | null;
}
