import { defineConfig } from "vitest/config";
import { cloudflareTest } from "@cloudflare/vitest-pool-workers";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.toml" },
      miniflare: {
        bindings: {
          NOTION_API_KEY: "test-key",
          NOTION_DATABASE_ID: "test-db-id",
          DEFAULT_REDIRECT_URL: "https://example.com/default",
          REDIRECT_STATUS: "302",
          // テストでは Notion をモックするのでキャッシュは無効化
          CACHE_TTL_SECONDS: "0",
        },
      },
    }),
  ],
});
