# tech-QR — 名刺QRコード動的リダイレクト + 名刺SVG生成

1 つの Cloudflare Worker で、Notion Database を管理画面（ヘッドレスCMS）にした 2 機能を提供します。

| 機能 | エンドポイント | 用途 |
| --- | --- | --- |
| **動的リダイレクト** | `GET /p/:id` | 名刺裏面の QR コードの転送先を、Notion の `TargetURL` を書き換えるだけで差し替え |
| **名刺SVG生成** | `GET /generate/:id` | Notion のメンバー情報を SVG テンプレートに流し込み、印刷入稿用 SVG を自動ダウンロード |

- **Runtime**: Cloudflare Workers (TypeScript)
- **管理画面 (CMS)**: Notion Database（1 つの DB を両機能で共有。`ID`(Title) がキー）
- **キャッシュ**: `/p/:id` のみ Cloudflare エッジキャッシュに短命キャッシュ（既定 45 秒 / 環境変数で調整可）。`/generate/:id` は毎回 Notion を参照。

---

## ルーティング仕様

| パス | 挙動 |
| --- | --- |
| `GET /p/:id` | `ID`(Title)=`:id` かつ `Active`=`true` のレコードの `TargetURL` へ `302`（または `307`）でリダイレクト。該当なしは `404`。 |
| `GET /generate/:id` | 名刺 **表面** SVG を生成し `content-disposition: attachment; filename="<id>-card-front.svg"` で返却。該当なしは `404`。 |
| `GET /generate/:id/back` | 名刺 **裏面** SVG（メンバー別QR入り）を生成し `filename="<id>-card-back.svg"` で返却。QR は `<PUBLIC_BASE_URL>/p/<id>` をエンコード。 |
| `GET /health` | `200 OK`（JSON。疎通確認用） |
| `GET /` およびその他すべて | `DEFAULT_REDIRECT_URL` へフォールバックリダイレクト |
| `GET` / `HEAD` 以外のメソッド | `405 Method Not Allowed` |

`/generate/:id` 系は末尾 `.svg` を付けても同じ（`/generate/haru`＝`/generate/haru.svg`、`/generate/haru/back.svg` も可）。
`:id` に使える文字は `A-Z a-z 0-9 . _ -`（1〜64 文字）に制限しています。`TargetURL` は `http` / `https` スキームのみ許可。Notion 由来の文字列は SVG 出力時に XML エスケープします。

---

## 1. Notion のセットアップ

### 1-1. データベースを作る

Notion で新しいデータベース（テーブル）を作成し、次のプロパティを用意します。**プロパティ名は完全一致**させてください（大文字小文字も区別）。

| プロパティ名 | 種類 | 使う機能 | 例 |
| --- | --- | --- | --- |
| `ID` | Title | 両方 | `haruharu` |
| `TargetURL` | URL | `/p/:id` | `https://github.com/haruharu` |
| `Active` | Checkbox | `/p/:id` | ☑（チェックしたレコードだけリダイレクト対象） |
| `Name_JP` | Text | 名刺（表） | `山田 太郎` |
| `Name_EN` | Text | 名刺（表） | `Taro Yamada`（大文字化して表示） |
| `Role` | **Select** | 名刺（表） | `部長` 等（下記の選択肢） |
| `Role_EN` | **Formula** | 名刺（表） | `Role` から英訳を自動生成（下記の式） |
| `Email` | URL | 名刺（表） | `you@example.com`（`mailto:` は自動除去） |
| `Github_ID` | Text | 名刺（表） | `octocat`（`@` や URL 形式でも可） |
| `X_ID` | Text | 名刺（表） | `octocat` |
| `SkillTags` | Text | 名刺（表） | `TypeScript, Cloudflare, UI/UX Design`（`,` / `、` 区切り、先頭 3 つを表示） |

**`Role`（Select）の選択肢と `Role_EN`（Formula）の対応**

| `Role` | `Role_EN`（自動） |
| --- | --- |
| 部長 | President |
| 副部長 | Vice President |
| 会計 | Treasurer |
| 書記 | Secretary |
| 広報 | Public Relations |
| 技術リード | Tech Lead |
| メンバー | Member |

`Role_EN` の式（Notion のプロパティ設定 → 数式）:

```
if(prop("Role") == "部長", "President", if(prop("Role") == "副部長", "Vice President",
if(prop("Role") == "会計", "Treasurer", if(prop("Role") == "書記", "Secretary",
if(prop("Role") == "広報", "Public Relations", if(prop("Role") == "技術リード", "Tech Lead",
if(prop("Role") == "メンバー", "Member", "")))))))
```

> 肩書きを増やしたいときは、`Role` の Select に選択肢を足し、上の式にも `if(prop("Role") == "新肩書き", "New Title", …)` を 1 段追加してください。

> リダイレクトだけ使う場合は `ID` / `TargetURL` / `Active` の 3 つで動きます。名刺生成を使うとき残りを追加してください。空欄のフィールドは SVG 上で単に非表示になります。裏面は QR のみなので Notion のプロパティは使いません（`ID` だけ）。

### 1-2. Integration（APIキー）を発行する

1. <https://www.notion.so/my-integrations> を開く → **New integration**
2. 種類は **Internal**、ワークスペースを選択して作成
3. 発行された **Internal Integration Token**（`ntn_...` または `secret_...`）を控える → これが `NOTION_API_KEY`

### 1-3. データベースに Integration を接続する

作成したデータベースのページを開く → 右上 `•••` → **Connections（接続）** → 1-2 で作った Integration を追加。
これをやらないと API から 404 / 権限エラーになります。

### 1-4. Database ID を調べる

データベースを**フルページ**で開いた時の URL:

```
https://www.notion.so/<workspace>/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx?v=...
                                   └──────── これが 32 文字の Database ID ────────┘
```

ダッシュ入り（`xxxxxxxx-xxxx-...`）でもそのまま使えます → これが `NOTION_DATABASE_ID`

---

## 2. ローカル開発

### 2-1. 依存インストール

```bash
npm install
```

### 2-2. 環境変数ファイルを用意

```bash
cp .dev.vars.example .dev.vars
```

`.dev.vars` を編集して値を埋めます（このファイルは Git 管理外）。

| 変数 | 必須 | 説明 |
| --- | --- | --- |
| `NOTION_API_KEY` | ✅ | 1-2 の Integration Token |
| `NOTION_DATABASE_ID` | ✅ | 1-4 の Database ID |
| `DEFAULT_REDIRECT_URL` | ✅ | 未定義パスのフォールバック先 |
| `REDIRECT_STATUS` | 任意 | `302`（既定）または `307` |
| `CACHE_TTL_SECONDS` | 任意 | エッジキャッシュ秒数。既定 `45`。`0` でキャッシュ無効（毎回 Notion へ） |
| `PUBLIC_BASE_URL` | 任意 | 裏面 QR に埋め込む公開 URL の基点（例 `https://qr.tech-club.dev`）。空ならリクエストのオリジンを使用 |

> `NOTION_DATABASE_ID` / `DEFAULT_REDIRECT_URL` などの非機密値は `wrangler.toml` の `[vars]` にも書けます。`.dev.vars` に書いた値が開発時は優先されます。

### 2-3. 起動

```bash
npm run dev
```

`http://localhost:8787` で起動します。動作確認例:

```bash
curl -i http://localhost:8787/health
curl -i http://localhost:8787/p/haruharu                     # 302 Location: <TargetURL>
curl -i http://localhost:8787/p/notexist                     # 404
curl -i http://localhost:8787/                               # 302 Location: <DEFAULT_REDIRECT_URL>
curl -o haruharu-front.svg http://localhost:8787/generate/haruharu        # 名刺 表面SVG
curl -o haruharu-back.svg  http://localhost:8787/generate/haruharu/back   # 名刺 裏面SVG（QR入り）
```

### 2-4. テスト / 型チェック / ビルド

```bash
npm test          # Vitest（Workers ランタイム上で実行、Notion API はモック）
npm run typecheck # tsc --noEmit
npm run build     # wrangler deploy --dry-run（バンドル検証）
```

---

## 3. デプロイ（Cloudflare）

### 3-1. 初回ログイン

```bash
npx wrangler login
```

### 3-2. 非機密の変数を設定

`wrangler.toml` の `[vars]` を編集します（`NOTION_DATABASE_ID` はここに実値を入れて可）。

```toml
[vars]
NOTION_DATABASE_ID = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
DEFAULT_REDIRECT_URL = "https://github.com/Kawamoto24e1058"
REDIRECT_STATUS = "302"
CACHE_TTL_SECONDS = "45"
PUBLIC_BASE_URL = "https://qr.tech-club.dev"   # 裏面QRの基点。本番ドメインを入れる
```

`wrangler.toml` を変更したら型定義を再生成します:

```bash
npm run cf-typegen   # = wrangler types
```

### 3-3. シークレット（APIキー）を登録

`NOTION_API_KEY` は `[vars]` に書かず、必ずシークレットとして登録します。

```bash
npx wrangler secret put NOTION_API_KEY
# プロンプトに Integration Token を貼り付け
```

### 3-4. デプロイ

```bash
npm run deploy       # = wrangler deploy
```

デプロイ後、`https://tech-qr.<your-subdomain>.workers.dev` で公開されます。
独自ドメイン（例 `qr.example.com`）を使う場合は `wrangler.toml` の `routes` のコメントを外して設定してください。

### 3-5. QR コードに埋める URL

```
https://qr.example.com/p/haruharu
```

以降、飛び先を変えたいときは **Notion の `TargetURL` を書き換えるだけ**。最大 `CACHE_TTL_SECONDS` 秒で反映されます（即時反映したい場合は `CACHE_TTL_SECONDS=0`）。

---

## 4. 名刺SVGの生成と入稿

### 4-1. ダウンロード

```
https://qr.example.com/generate/haruharu        # 表面
https://qr.example.com/generate/haruharu/back    # 裏面（QR入り）
```

ブラウザで開くと `haruharu-card-front.svg` / `haruharu-card-back.svg` が自動ダウンロードされます。
Notion を編集すれば次回アクセス時に即反映されます（`/generate` はキャッシュしません）。

### 4-2. デザイン仕様（`src/card-template.ts`）

- 日本標準名刺サイズ **91mm × 55mm**（`viewBox="0 0 910 550"`、`width="91mm" height="55mm"`）
- Figma Make のデザイン（`business-card-front.svg` / `-back.svg`）に準拠。背景 `#0a0a0c`、外枠 + 内側ヘアライン + 四隅マーク
- 書体: 見出し・氏名 = Inter / Noto Sans JP、ラベル・URL・連絡先 = Courier New（等幅）
- **表面**: ロゴ + `TECH CLUB / DEV TEAM`、肩書き（`Role` 和文大 / `Role_EN` 欧文小）、氏名（`Name_JP` / `Name_EN`）、
  スキルタグのチップ（先頭 3 件）、連絡先（`Email` / `github.com/<Github_ID>` / `@<X_ID>`。空欄は非表示）
- **裏面**: `<PUBLIC_BASE_URL>/p/<id>` をエンコードした実データ QR（丸みモジュール、ファインダーは 1:1:3:1:1 比を厳守）、
  URL 表記、両サイドにロゴのウォーターマーク、フッター `BUILD · LEARN · SHIP`

### 4-3. ロゴの差し替え

ロゴは `src/logo.png`（黒の PNG）を base64 で `src/logo.ts` に埋め込み、SVG 側の `feColorMatrix` で白黒反転して使っています。
差し替えるときは:

```bash
# src/logo.png を新しい黒ロゴ PNG に置き換えてから
npm run embed-logo   # src/logo.ts を再生成
```

> PNG 埋め込みのため、生成される SVG は 1 枚あたり約 300KB、Worker バンドルは gzip 約 240KB になります（無料プランの上限内）。
> よりシャープにしたい場合は将来ロゴをベクター化し、`src/logo.ts` の代わりにパスを直接埋め込んでください。

### 4-4. 入稿時の注意

- テキストは **ライブテキスト**（`font-family` 指定）です。
  入稿前に **Illustrator 等で「アウトライン化（テキスト → パス）」** してから提出してください。
- QR はブラウザの `BarcodeDetector` で読み取り確認済み・テストで uqr の生成データと完全一致を検証済みですが、
  **最終入稿データで一度実機スキャン**してください。
- 塗り足し（bleed）が必要な場合は、印刷所の指定に合わせて `viewBox` と背景 `<rect>`・外枠を拡張してください
  （テンプレートは仕上がりサイズちょうど）。

---

## 5. 仕組み / 設計メモ

- Notion へは公式 SDK を使わず `fetch` で直接クエリ（Workers 向けに依存を最小化）。Notion API バージョンは `2022-06-28`。
- 両エンドポイントとも `ID`(Title) の完全一致でレコードを 1 件引く。`/p/:id` は追加で `Active` を検査。
- `/p/:id` は `caches.default`（Cloudflare エッジキャッシュ）に `id → TargetURL` を短命キャッシュ。`404`（該当なし）も最大 15 秒キャッシュして Notion への連打を防止。リダイレクト応答自体は `Cache-Control: no-store`。
- `/generate/:id`（表・裏とも）はキャッシュせず毎回生成。応答は `Cache-Control: no-store`。
- QR 生成は `uqr`（依存ゼロ・ランタイム非依存）。ECC レベル `Q`、クワイエットゾーン 4 モジュール。Figma 版のダミー QR は実データ QR に置換。
- `Role` は Notion の Select、`Role_EN` は Formula。Worker 側は `select.name` / `formula.string` を読む。
- Notion API がエラーを返した場合は `502 Bad Gateway`。
- セキュリティ: `:id` は文字種を制限、`TargetURL` は `http(s)` のみ許可（`javascript:` 等を弾く）、Notion 文字列は SVG 出力時に XML エスケープ、リダイレクトに `Referrer-Policy: no-referrer`。

## 6. ファイル構成

```
src/index.ts             Worker 本体（ルーティング / Notion 連携 / キャッシュ）
src/card-template.ts     名刺SVG生成（表面 / 裏面 / QR描画）
src/logo.png             テック部ロゴ（黒 PNG。差し替え元）
src/logo.ts              logo.png を base64 で埋め込んだ定数（embed-logo で生成）
scripts/embed-logo.mjs   logo.png → logo.ts 再生成スクリプト
wrangler.toml            Worker 設定
vitest.config.ts         Vitest（@cloudflare/vitest-pool-workers）設定
test/index.spec.ts       テスト（QR のモジュール一致検証を含む）
worker-configuration.d.ts  `wrangler types` 生成（Git 管理外 / postinstall で自動生成）
worker-env.d.ts          シークレットの型宣言
.dev.vars.example        ローカル環境変数テンプレート
```
