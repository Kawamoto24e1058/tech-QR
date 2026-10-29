// wrangler.toml の [vars] は `wrangler types` が worker-configuration.d.ts に生成する。
// シークレット（`wrangler secret put` で登録する値）や任意の変数はここで手動宣言して
// Cloudflare.Env にマージする。
declare namespace Cloudflare {
  interface Env {
    /** Notion Internal Integration Token（シークレット） */
    NOTION_API_KEY: string;
    /** 管理画面 /admin のパスワード（シークレット）。未設定なら管理画面は無効 */
    ADMIN_PASSWORD?: string;
    /** Notion API の基点を差し替える（テスト用モックサーバー向け）。通常は未設定 */
    NOTION_API_BASE?: string;
  }
}
