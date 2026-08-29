// wrangler.toml の [vars] は `wrangler types` が worker-configuration.d.ts に生成する。
// シークレット（`wrangler secret put` で登録する値）はここで手動宣言して
// Cloudflare.Env にマージする。
declare namespace Cloudflare {
  interface Env {
    /** Notion Internal Integration Token（シークレット） */
    NOTION_API_KEY: string;
  }
}
