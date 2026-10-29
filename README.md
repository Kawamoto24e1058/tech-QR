# tech-QR — 名刺QR + プロフィール + 名刺SVG生成

テック部の名刺用 Cloudflare Worker。**データの置き場所は Notion の Database 1 か所だけ**で、編集は管理画面（`/admin`）からでも Notion からでもできます。
メンバーが触れるのは「データ」で、名刺の見た目はコード（`src/layout.ts`）に固定して組織で統一しています。

| 何をする | URL | 内容 |
| --- | --- | --- |
| **QRの着地点** | `/p/:id` | 名刺裏面のQRが指す先。普段は**プロフィールページ**、`TargetURL` を入れた人だけその URL へ転送 |
| プロフィール | `/profile/:id` | 転送先を設定していても常にプロフィールを表示 |
| 名刺の確認・DL | `/preview` → `/preview/:id` | 表裏の名刺を画面で見て、そこから SVG をダウンロード |
| 名刺SVG | `/generate/:id` `/generate/:id/back` | 表面 / 裏面（メンバー別QR入り）を直接ダウンロード |
| **管理画面** | `/admin` | パスワードでログインし、**Notion を開かずに**メンバーのデータと肩書きを編集 |
| 疎通確認 | `/health` | |

その他のパスは `DEFAULT_REDIRECT_URL` へ転送されます。

---

## QRの行き先・メンバー情報を変える場所 = 管理画面（`/admin`）

**https://tech-qr.momotech.workers.dev/admin** にパスワードでログインして、すべてアプリの中で編集できます（Notion を開く必要なし）。
保存先は Notion のままなので、**Notion で直接編集しても同じデータ**です（どちらの入口を使っても OK）。

| できること | 場所 |
| --- | --- |
| メンバーの追加・編集・削除、公開/停止 | 管理画面「メンバー」タブ |
| 肩書きの選択肢の追加・英訳の修正・並び替え | 管理画面「肩書き」タブ（Notion の `Role` と `Role_EN` の数式を自動更新） |
| QRの行き先の切り替え | メンバーの「QRコードの行き先」 |

`/p/:id` は、そのメンバーの設定で次のように振り分けます。

| 設定 | QR を読み取ると |
| --- | --- |
| 公開 ON + 行き先「プロフィールページ」（`TargetURL` 空） | **プロフィールページ**（名前・肩書き・スキル・GitHub/X/メール） |
| 公開 ON + 行き先「別のURLへ転送」 | その URL へ**転送** |
| 公開 OFF | 404 |

- 管理画面で保存した内容は **QR・プロフィールにすぐ反映**（同一拠点のキャッシュを破棄。他拠点は最大 45 秒）。Notion で直接直した場合は最大 45 秒（`CACHE_TTL_SECONDS`）。
- **ID は変更できません**（QRのURLの鍵で、印刷済みQRが無効になるため）。削除は Notion のゴミ箱へ移るので復元できます。
- 使用中の肩書きは削除・日本語名の変更ができません（メンバーの肩書きが空になるため）。英語表記はいつでも直せます。

### 管理画面のパスワード

部で共通の合言葉 1 つ。**設定するまで管理画面は無効**（503）です。

```bash
npx wrangler secret put ADMIN_PASSWORD   # 16 文字以上の長い合言葉を推奨
```

- ログインは署名付き Cookie（HttpOnly / SameSite=Strict / 7 日）。パスワードを変えると全員ログアウトされます。
- 総当たり対策: IP ごとに **1 分 5 回**まで（Cloudflare Rate Limiting）＋失敗時は遅延。
- 書き込み API は同一オリジンからのみ受け付けます（CSRF 対策）。

---

## 1. Notion の準備

### 1-1. Database の列（**名前は完全一致**。管理画面が読み書きします）

| 列 | 種類 | 用途 |
| --- | --- | --- |
| `ID` | Title | メンバー識別子（URL に入る。`A-Z a-z 0-9 . _ -`、64 文字まで） |
| `Active` | Checkbox | ☑ のメンバーだけ公開（QR もプロフィールも） |
| `TargetURL` | URL | **任意**。空ならプロフィール、入れればそこへ転送 |
| `Name_JP` / `Name_EN` | Text | 氏名 |
| `Role` | **Select** | 肩書き（下記の選択肢） |
| `Role_EN` | **Formula** | `Role` から英訳を自動生成 |
| `Email` | URL | `mailto:` は自動除去 |
| `Github_ID` / `X_ID` | Text | `octocat` / `@octocat` / URL 形式でも可 |
| `SkillTags` | Text | `TypeScript, Cloudflare` のように `,` か `、` 区切り（名刺は先頭 3 つ） |

`Role` の選択肢と `Role_EN` の自動英訳:

| 部長 | 副部長 | 会計 | 書記 | 広報 | 技術リード | メンバー |
| --- | --- | --- | --- | --- | --- | --- |
| President | Vice President | Treasurer | Secretary | Public Relations | Tech Lead | Member |

`Role_EN` の式:

```
if(prop("Role") == "部長", "President", if(prop("Role") == "副部長", "Vice President",
if(prop("Role") == "会計", "Treasurer", if(prop("Role") == "書記", "Secretary",
if(prop("Role") == "広報", "Public Relations", if(prop("Role") == "技術リード", "Tech Lead",
if(prop("Role") == "メンバー", "Member", "")))))))
```

> 肩書きを増やすときは、`Role` に選択肢を足し、式にも `if(...)` を 1 段足してください。

### 1-2. Integration（APIキー）

1. <https://www.notion.so/my-integrations> で **Internal** な Integration を作成 → トークン（`ntn_...`）
2. Database の `•••` → **接続** → その Integration を追加（これを忘れると 404）
3. Database ID = Database を開いた URL の 32 文字

---

## 2. 名刺デザインの微調整

見た目は **`src/layout.ts` の `LAYOUT` 1 つ**（全員共通）。位置・サイズ・太さ・字間・色・表示/非表示をここで決めます。
数値を直して再デプロイすれば全員の名刺に反映されます（Claude Code に「○○を右に10px」と頼めば数分）。

- 座標は 910 × 550 の viewBox（= 91mm × 55mm）。
- 外枠・四隅マーク・区切り線などの固定装飾は `src/card-template.ts`。
- **ロゴ**: `src/logo.png`（黒の PNG）を差し替えて `npm run embed-logo`（`src/logo.ts` を再生成）。

### 入稿時の注意
- テキストは**ライブテキスト**です。入稿前に Illustrator 等で**アウトライン化**してください。
- 塗り足し（通常 3mm）が必要なら `viewBox` と背景・外枠を拡張します（今は仕上がりサイズぴったり）。
- 裏面のQRは `<PUBLIC_BASE_URL>/p/<id>`。**最終データで実機スキャン**してください。

---

## 3. セットアップとデプロイ

```bash
npm install
cp .dev.vars.example .dev.vars    # NOTION_API_KEY / NOTION_DATABASE_ID / ADMIN_PASSWORD などを記入（Git管理外）
npm run dev                       # http://localhost:8787
npm test                          # Vitest（Workers ランタイム、Notion はモック）
npm run typecheck
```

```bash
npx wrangler login
npx wrangler secret put NOTION_API_KEY   # トークンを貼り付け（[vars] には書かない）
npx wrangler secret put ADMIN_PASSWORD   # 管理画面の合言葉（未設定だと /admin は無効）
npm run deploy
```

`wrangler.toml` の `[vars]`:

| 変数 | 説明 |
| --- | --- |
| `NOTION_DATABASE_ID` | Database ID |
| `DEFAULT_REDIRECT_URL` | 未定義パスのフォールバック先 |
| `REDIRECT_STATUS` | `302`（既定）/ `307` |
| `CACHE_TTL_SECONDS` | `/p` `/profile` の Notion 参照キャッシュ秒（既定 45、`0` で無効） |
| `PUBLIC_BASE_URL` | 裏面QRの基点。**本番ドメインを入れる**（例 `https://tech-qr.momotech.workers.dev`） |

`wrangler.toml` を変えたら `npm run cf-typegen`。独自ドメインにするなら `routes` のコメントを外します。

---

## 4. ファイル構成

```
src/index.ts          ルーティングだけ（どの URL が何をするかはここを見れば分かる）
src/notion.ts         Notion の読み書き（メンバー・肩書き。これが唯一のデータ源）
src/admin.ts          管理画面の認証と API（/admin/*）
src/admin-page.ts     管理画面の HTML / JS
src/lookup.ts         /p /profile 用の短命キャッシュ
src/profile.ts        プロフィールページ（QR の着地点）
src/card-template.ts  名刺SVG（表/裏/QR）の組み立て
src/layout.ts         名刺の配置・サイズ・色（見た目の唯一の設定）
src/preview.ts        /preview の画面
src/assets.ts         ロゴ画像の配信
src/logo.ts / logo.png ロゴ（logo.ts は embed-logo で生成）
test/index.spec.ts    テスト
```

## 5. 設計メモ

- Notion は fetch 直叩き（API `2022-06-28`）。QR 読み取りは集中しうるので `/p` `/profile` は Cache API で短命キャッシュ（「いない」結果は最大 15 秒）。`/preview` `/generate` は常に最新。
- 公開ページは `noindex`。プロフィールのリンクは `https://github.com/<id>` `https://x.com/<id>` `mailto:` のみ生成し、形式外のハンドル/メールは文字として表示（リンクにしない）。
- `TargetURL` は `http(s)` のみ許可。Notion 由来の文字列は HTML/SVG へ出す際に必ずエスケープ。
- 名刺の**見た目**を編集する UI は意図的に持たない（誰でも変えられると統一感が崩れるため）。見た目は `layout.ts` に固定し、変更は数値を直して再デプロイ。
- 管理画面が書くのは Notion だけ。データの置き場所は常に 1 か所。肩書きの英訳は Notion の数式（`Role_EN`）を正とし、管理画面はその数式を読み書きする。
