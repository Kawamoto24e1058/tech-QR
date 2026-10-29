/**
 * tech-QR : Notion を管理画面にした、名刺QRのリダイレクト + 名刺SVG生成 Worker
 *
 * 管理する場所は Notion の Database 1 か所だけ。メンバーが触れるのは「データ」で、
 * 名刺の見た目は src/layout.ts に固定（組織で統一）。
 *
 *   GET /p/:id             QR の着地点。TargetURL が空 → プロフィールページ / あり → その URL へ転送
 *   GET /profile/:id       プロフィールページ（転送先を設定していても常にこちらを表示）
 *   GET /preview           メンバー一覧
 *   GET /preview/:id       表裏の名刺を表示し、そこから SVG をダウンロード
 *   GET /generate/:id      表面 SVG をダウンロード
 *   GET /generate/:id/back 裏面 SVG（メンバー別 QR 入り）をダウンロード
 *   GET /assets/logo.png   ロゴ画像（プロフィールページ用）
 *   GET /admin             管理画面（パスワードでログイン。メンバーのデータと肩書きを編集）
 *   GET /health            疎通確認
 *   その他                 DEFAULT_REDIRECT_URL へ転送
 */
import { handleAdmin } from "./admin";
import { logoPngBytes } from "./assets";
import { buildBackCard, buildFrontCard, escapeXml } from "./card-template";
import { lookup } from "./lookup";
import { getMember, ID_PATTERN, listMembers } from "./notion";
import { buildCardPreview, buildIndexPage } from "./preview";
import { buildProfilePage } from "./profile";

/**
 * 環境変数 / シークレット（型は `wrangler types` 生成の Cloudflare.Env + worker-env.d.ts）
 * - NOTION_API_KEY (secret) / NOTION_DATABASE_ID (var)
 * - DEFAULT_REDIRECT_URL: 未定義パスのフォールバック先
 * - REDIRECT_STATUS: "302" | "307"（既定 302）
 * - CACHE_TTL_SECONDS: /p/:id と /profile/:id の Notion 参照キャッシュ秒。"0" で無効
 * - PUBLIC_BASE_URL: 裏面QRに埋め込む公開URLの基点。空ならリクエストの origin
 */
export type Env = Cloudflare.Env;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // 管理画面（認証つき。GET 以外のメソッドもここで扱う）
    const admin = await handleAdmin(request, env);
    if (admin) return admin;

    const url = new URL(request.url);
    const { pathname } = url;

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { Allow: "GET, HEAD", "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    if (pathname === "/health") {
      return Response.json({ status: "ok", time: new Date().toISOString() }, noStore());
    }

    if (pathname === "/assets/logo.png") {
      return new Response(logoPngBytes(), {
        headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" },
      });
    }

    const base = (env.PUBLIC_BASE_URL || url.origin).replace(/\/+$/, "");

    try {
      // ── QR の着地点 ─────────────────────────────────
      const p = pathname.match(/^\/p\/([^/]+)\/?$/);
      if (p) {
        const id = decodeURIComponent(p[1]);
        const member = ID_PATTERN.test(id) ? await lookup(id, env, ctx) : null;
        if (!member || !member.active) return notFound(id);
        // 転送先が設定されていればそこへ、なければプロフィールページ
        if (isSafeHttpUrl(member.targetUrl)) return redirect(member.targetUrl, env);
        return html(buildProfilePage(member));
      }

      const prof = pathname.match(/^\/profile\/([^/]+)\/?$/);
      if (prof) {
        const id = decodeURIComponent(prof[1]);
        const member = ID_PATTERN.test(id) ? await lookup(id, env, ctx) : null;
        if (!member || !member.active) return notFound(id);
        return html(buildProfilePage(member));
      }

      // ── 名刺プレビュー / ダウンロード ────────────────
      if (pathname === "/preview" || pathname === "/preview/") {
        return html(buildIndexPage(await listMembers(env)));
      }

      const prev = pathname.match(/^\/preview\/([^/]+)\/?$/);
      if (prev) {
        const id = decodeURIComponent(prev[1]);
        const member = ID_PATTERN.test(id) ? await getMember(id, env) : null;
        return member ? html(buildCardPreview(member, base)) : notFound(id);
      }

      const gen = pathname.match(/^\/generate\/([^/]+?)(?:\.svg)?(\/back)?(?:\.svg)?\/?$/);
      if (gen) {
        const id = decodeURIComponent(gen[1]);
        const member = ID_PATTERN.test(id) ? await getMember(id, env) : null;
        if (!member) return notFound(id);
        return gen[2]
          ? svgDownload(buildBackCard(member.fields, `${base}/p/${id}`), `${id}-card-back`)
          : svgDownload(buildFrontCard(member.fields), `${id}-card-front`);
      }
    } catch (err) {
      console.error("request failed", { pathname, error: String(err) });
      return badGateway();
    }

    // ルート / その他すべて
    return redirect(env.DEFAULT_REDIRECT_URL, env);
  },
} satisfies ExportedHandler<Env>;

/* ────────────────────────────────────────────────────────────
 *  レスポンス
 * ──────────────────────────────────────────────────────────── */

function noStore(): ResponseInit {
  return { headers: { "Cache-Control": "no-store" } };
}

function redirect(location: string, env: Env): Response {
  const status = String(env.REDIRECT_STATUS) === "307" ? 307 : 302;
  const safe = isSafeHttpUrl(location) ? location : "https://github.com/Kawamoto24e1058";
  return new Response(null, {
    status,
    // 転送先は Notion で随時変わるので、ブラウザ/CDN には覚えさせない
    headers: { Location: safe, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}

function html(body: string): Response {
  return new Response(body, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function svgDownload(svg: string, basename: string): Response {
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${basename}.svg"`,
      "Cache-Control": "no-store",
    },
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
<p>Notion の ID プロパティ（と Active のチェック）を確認してください。</p>
</html>`;
  return new Response(body, {
    status: 404,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/* ────────────────────────────────────────────────────────────
 *  ユーティリティ
 * ──────────────────────────────────────────────────────────── */

/** http(s) スキームのみ許可 (javascript:, data: 等を弾く) */
function isSafeHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}
