import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker from "../src/index";
import { fakeFontResponse } from "./helpers/fake-fonts";

interface Member {
  targetUrl?: string;
  active?: boolean;
  Name_JP?: string;
  Name_EN?: string;
  Role?: string;
  Role_EN?: string;
  Email?: string;
  Github_ID?: string;
  X_ID?: string;
  SkillTags?: string;
}

function richText(value: string) {
  return { type: "rich_text", rich_text: [{ plain_text: value }] };
}

/** Member を Notion のページ properties 形に変換 */
function toNotionPage(id: string, m: Member) {
  return {
    id: `page_${id}`,
    properties: {
      ID: { type: "title", title: [{ plain_text: id }] },
      TargetURL: { type: "url", url: m.targetUrl ?? null },
      Active: { type: "checkbox", checkbox: m.active ?? false },
      Name_JP: richText(m.Name_JP ?? ""),
      Name_EN: richText(m.Name_EN ?? ""),
      Role: { type: "select", select: m.Role ? { name: m.Role } : null },
      Role_EN: { type: "formula", formula: { type: "string", string: m.Role_EN ?? "" } },
      Email: { type: "url", url: m.Email ?? null },
      Github_ID: richText(m.Github_ID ?? ""),
      X_ID: richText(m.X_ID ?? ""),
      SkillTags: richText(m.SkillTags ?? ""),
    },
  };
}

/** globalThis.fetch をスタブして Notion API 呼び出しを横取りする */
function stubNotion(members: Record<string, Member>, opts: { fail?: boolean; fontsFail?: boolean } = {}) {
  const spy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const fonts = fakeFontResponse(new URL(url));
    if (fonts) return opts.fontsFail ? new Response("down", { status: 500 }) : fonts;
    if (!url.includes("api.notion.com")) {
      throw new Error(`unexpected fetch: ${url}`);
    }
    if (opts.fail) {
      return new Response("boom", { status: 500 });
    }
    const body = JSON.parse(String(init?.body ?? "{}"));
    const requestedId: string | undefined = body.filter?.title?.equals;
    // filter あり = 1件検索 / filter なし = 全件（fetchAllMembers）
    const results =
      requestedId === undefined
        ? Object.entries(members).map(([id, m]) => toNotionPage(id, m))
        : members[requestedId]
          ? [toNotionPage(requestedId, members[requestedId])]
          : [];
    return new Response(JSON.stringify({ object: "list", results, has_more: false, next_cursor: null }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", spy);
  return spy;
}

async function call(path: string, init?: RequestInit) {
  const request = new Request(`https://qr.test${path}`, init);
  const ctx = createExecutionContext();
  const res = await worker.fetch(request, env, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GET /health", () => {
  it("returns 200 with ok status", async () => {
    const res = await call("/health");
    expect(res.status).toBe(200);
    const json = (await res.json()) as { status: string };
    expect(json.status).toBe("ok");
  });
});

describe("GET /p/:id", () => {
  it("redirects to the Notion TargetURL (302)", async () => {
    stubNotion({ haruharu: { targetUrl: "https://github.com/haruharu", active: true } });
    const res = await call("/p/haruharu");
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("https://github.com/haruharu");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns 404 when the record is inactive", async () => {
    stubNotion({ haruharu: { targetUrl: "https://github.com/haruharu", active: false } });
    const res = await call("/p/haruharu");
    expect(res.status).toBe(404);
  });

  it("returns 404 when the id is unknown", async () => {
    stubNotion({});
    const res = await call("/p/nobody");
    expect(res.status).toBe(404);
  });

  it("returns 404 for ids with illegal characters (no Notion call)", async () => {
    const spy = stubNotion({});
    const res = await call("/p/" + encodeURIComponent("../etc/passwd"));
    expect(res.status).toBe(404);
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns 502 when Notion API errors", async () => {
    stubNotion({}, { fail: true });
    const res = await call("/p/haruharu");
    expect(res.status).toBe(502);
  });


});

describe("GET /generate/:id (front)", () => {
  beforeEach(() => {
    stubNotion({
      haruharu: {
        Name_JP: "山田 太郎",
        Name_EN: "Taro Yamada",
        Role: "部長",
        Role_EN: "Club President",
        Email: "taro@example.com",
        Github_ID: "@taro",
        X_ID: "https://x.com/taro_dev/",
        SkillTags: "TypeScript, Cloudflare、UI/UX Design",
      },
    });
  });

  it("returns an SVG attachment for a known id", async () => {
    const res = await call("/generate/haruharu");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/svg+xml; charset=utf-8");
    expect(res.headers.get("Content-Disposition")).toBe(
      'attachment; filename="haruharu-card-front.svg"',
    );

    const svg = await res.text();
    // 入稿用は塗り足し 3mm 付き（97×61mm）。文字はアウトライン化されている（<text> が無い）
    expect(svg).toContain('viewBox="-30 -30 970 610"');
    expect(svg).toContain('width="97mm" height="61mm"');
    expect(svg).not.toContain("<text");
    expect(svg).not.toContain("font-family");
    for (const label of ["山田 太郎", "Taro Yamada", "部長", "Club President", "github.com/taro", "@taro_dev", "TypeScript", "Cloudflare", "DEV TEAM / HARUHARU"]) {
      expect(svg, label).toContain(`aria-label="${label}"`);
    }
    expect(svg).not.toContain("{{");
  });

  it("accepts an optional .svg suffix", async () => {
    const res = await call("/generate/haruharu.svg");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toBe(
      'attachment; filename="haruharu-card-front.svg"',
    );
  });

  it("escapes XML-significant characters from Notion data", async () => {
    stubNotion({ xss: { Name_JP: '<script>alert("x")</script>' } });
    const res = await call("/generate/xss");
    const svg = await res.text();
    expect(svg).toContain("&#60;script&#62;"); // aria-label にも図形にもマークアップとして残らない
    expect(svg).not.toContain("<script>");
  });

  it("reads Role from a select and Role_EN from a formula string", async () => {
    stubNotion({ m: { Name_JP: "佐藤", Role: "会計", Role_EN: "Treasurer" } });
    const svg = await (await call("/generate/m")).text();
    expect(svg).toContain('aria-label="会計"');
    expect(svg).toContain('aria-label="Treasurer"'); // 英語表記は大文字で出る
  });

  it("omits the role lines when Role is unset", async () => {
    stubNotion({ m: { Name_JP: "無役" } });
    const res = await call("/generate/m");
    expect(res.status).toBe(200);
  });

  it("returns 404 for an unknown id", async () => {
    const res = await call("/generate/nobody");
    expect(res.status).toBe(404);
  });

  it("returns 502 when Notion API errors", async () => {
    stubNotion({}, { fail: true });
    const res = await call("/generate/haruharu");
    expect(res.status).toBe(502);
  });
});

describe("card rendering edge cases", () => {
  it("?bleed=0 gives the trim-size (91×55mm) file", async () => {
    stubNotion({ haruharu: { Name_JP: "山田" } });
    const svg = await (await call("/generate/haruharu?bleed=0")).text();
    expect(svg).toContain('viewBox="0 0 910 550"');
    expect(svg).toContain('width="91mm" height="55mm"');
    const back = await (await call("/generate/haruharu/back?bleed=0")).text();
    expect(back).toContain('viewBox="0 0 910 550"');
  });

  it("renders a card with only the bare minimum (no role, links, or skills) and omits the empty parts", async () => {
    stubNotion({ bare: { Name_JP: "無名" } });
    const svg = await (await call("/generate/bare")).text();
    expect(svg).toContain('aria-label="無名"');
    expect(svg).not.toContain('aria-label="github');
    expect(svg).not.toContain("TypeScript");
    expect(svg).toContain('aria-label="DEV TEAM / BARE"'); // ID だけは常に出る
  });

  it("shrinks a very long name / email to stay inside the card instead of overflowing", async () => {
    const long = "一".repeat(30);
    stubNotion({ long: { Name_JP: long, Email: `${"a".repeat(80)}@example.com` } });
    const svg = await (await call("/generate/long")).text();
    expect(svg).toContain(`aria-label="${long}"`);
    // 仮フォント(1 文字 = 0.6em)で 30 文字を 806 に収めるには size ≈ 44.8 以下 = 輪郭の高さが 124 単位のときより小さい
    const nameD = svg.match(new RegExp(`aria-label="${long}"><path[^>]* d="([^"]+)"`))![1];
    const ys = [...nameD.matchAll(/[ML]([\d.-]+) ([\d.-]+)/g)].map((m) => Number(m[2]));
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(60); // 縮小済み（既定サイズなら ≈ 87）
  });

  it("returns 503 (retryable) for downloads when Google Fonts is unavailable, but keeps the preview page up", async () => {
    stubNotion({ gone: { Name_JP: "未取得の文字列ふがほげ" } }, { fontsFail: true });
    const dl = await call("/generate/gone");
    expect(dl.status).toBe(503);
    expect(dl.headers.get("Retry-After")).toBe("10");

    const page = await call("/preview/gone");
    expect(page.status).toBe(200);
    expect(await page.text()).toContain("名刺を描画できませんでした");
  });
});

describe("GET /generate/:id/back", () => {
  beforeEach(() => {
    stubNotion({ haruharu: { Name_JP: "山田 太郎" } });
  });

  it("returns the back SVG with an embedded QR pointing at /p/:id", async () => {
    const res = await call("/generate/haruharu/back");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toBe(
      'attachment; filename="haruharu-card-back.svg"',
    );

    const svg = await res.text();
    expect(svg).toContain('viewBox="-30 -30 970 610"');
    expect(svg).toContain('aria-label="リンクを見る"');
    // QR modules are rendered in the dark ink colour
    expect(svg).toContain('<g fill="#0a0a0c">');
    // display URL derived from request origin
    expect(svg).toContain('aria-label="qr.test"');
    expect(svg).toContain('aria-label="/p/haruharu"');
  });

  it("accepts /back.svg", async () => {
    const res = await call("/generate/haruharu/back.svg");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toBe(
      'attachment; filename="haruharu-card-back.svg"',
    );
  });

  it("returns 404 for an unknown id", async () => {
    const res = await call("/generate/nobody/back");
    expect(res.status).toBe(404);
  });

  /**
   * QR の <rect> 群を格子に逆マッピングし、uqr の生成した行列と一致することを検証。
   * ファインダー領域（各コーナー 7×7）は装飾描画のため比較から除外する。
   * ox/oy/size は buildBackCard() 内の renderQr 呼び出しと一致させること。
   */
  it("renders a QR whose modules faithfully match the encoded data", async () => {
    const { encode } = await import("uqr");
    const svg = await (await call("/generate/haruharu/back")).text();
    const url = "https://qr.test/p/haruharu";
    const { data, size: n } = encode(url, { ecc: "Q", border: 0 });

    // back() の qr(url, px, py, pw) = qr(url, 522, 115, 320)
    const OX = 522;
    const OY = 115;
    const SIZE = 320;
    const quiet = 4;
    const cell = SIZE / (n + quiet * 2);
    const inFinder = (r: number, c: number) =>
      (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);

    const group = svg.match(/<g fill="#0a0a0c">([\s\S]*?)<\/g>/);
    expect(group).not.toBeNull();
    const rects = [...group![1].matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)"/g)];

    const painted = new Set<string>();
    let eyeSquares = 0;
    for (const [, xs, ys, ws] of rects) {
      const w = Number(ws);
      if (w > cell * 2) {
        if (Math.abs(w - cell * 7) < 0.5) eyeSquares++;
        continue; // finder decoration
      }
      const c = Math.round((Number(xs) + w / 2 - OX) / cell - quiet - 0.5);
      const r = Math.round((Number(ys) + w / 2 - OY) / cell - quiet - 0.5);
      expect(data[r]?.[c]).toBe(true); // every drawn module is a real dark module
      painted.add(`${r},${c}`);
    }

    // every dark module outside the finders must be drawn
    let expectedOutsideFinders = 0;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (data[r][c] && !inFinder(r, c)) {
          expectedOutsideFinders++;
          expect(painted.has(`${r},${c}`)).toBe(true);
        }
      }
    }
    expect(painted.size).toBe(expectedOutsideFinders);
    expect(eyeSquares).toBe(3); // three finder patterns
  });
});

describe("GET /preview", () => {
  it("lists all members as HTML with links to each preview", async () => {
    stubNotion({
      haruharu: { Name_JP: "山田 太郎", active: true },
      sato: { Name_JP: "佐藤 花子", active: false },
    });
    const res = await call("/preview");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/html; charset=utf-8");

    const html = await res.text();
    expect(html).toContain("山田 太郎");
    expect(html).toContain("佐藤 花子");
    expect(html).toContain('href="/preview/haruharu"');
    expect(html).toContain('href="/preview/sato"');
    expect(html).toContain("Active");
    expect(html).toContain("停止中");
  });
});

describe("GET /preview/:id", () => {
  beforeEach(() => {
    stubNotion({
      haruharu: {
        Name_JP: "山田 太郎",
        Role: "部長",
        Role_EN: "President",
        Email: "taro@example.com",
      },
    });
  });

  it("renders both cards inline with download links", async () => {
    const res = await call("/preview/haruharu");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/html; charset=utf-8");

    const html = await res.text();
    expect(html).toContain("山田 太郎");
    // both card SVGs embedded
    expect(html.match(/<svg /g)?.length).toBeGreaterThanOrEqual(2);
    expect(html).toContain('aria-label="リンクを見る"'); // back card present
    expect(html).toContain('viewBox="0 0 910 550"'); // 画面表示は仕上がりサイズ
    // download links point at the attachment endpoints
    expect(html).toContain('href="/generate/haruharu" download');
    expect(html).toContain('href="/generate/haruharu/back" download');
    expect(html).toContain('href="/generate/haruharu?bleed=0" download'); // 塗り足しなし
    // QR target uses the request origin
    expect(html).toContain("https://qr.test/p/haruharu");
  });

  it("returns 404 for an unknown id", async () => {
    const res = await call("/preview/nobody");
    expect(res.status).toBe(404);
  });
});

describe("QR landing: /p/:id", () => {
  it("shows the profile page when TargetURL is empty", async () => {
    stubNotion({
      haruharu: {
        active: true,
        Name_JP: "山田 太郎",
        Name_EN: "Taro Yamada",
        Role: "部長",
        Role_EN: "President",
        Email: "taro@example.com",
        Github_ID: "@taro-dev",
        X_ID: "https://x.com/taro_dev/",
        SkillTags: "TypeScript, Cloudflare",
      },
    });
    const res = await call("/p/haruharu");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/html; charset=utf-8");

    const html = await res.text();
    expect(html).toContain("山田 太郎");
    expect(html).toContain("Taro Yamada"); // 表示時に CSS で大文字化
    expect(html).toContain("部長");
    expect(html).toContain('href="https://github.com/taro-dev"');
    expect(html).toContain('href="https://x.com/taro_dev"');
    expect(html).toContain('href="mailto:taro@example.com"');
    expect(html).toContain("TypeScript");
    expect(html).toContain('content="noindex, nofollow"');
    expect(html).toContain('src="/assets/logo.png"');
  });

  it("redirects instead when TargetURL is set (override)", async () => {
    stubNotion({ haruharu: { active: true, targetUrl: "https://example.org/me", Name_JP: "山田" } });
    const res = await call("/p/haruharu");
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("https://example.org/me");
  });

  it("falls back to the profile when TargetURL is not a safe http(s) URL", async () => {
    stubNotion({ evil: { active: true, targetUrl: "javascript:alert(1)", Name_JP: "悪者" } });
    const res = await call("/p/evil");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("悪者");
  });

  it("escapes Notion text and refuses to link odd handles / emails", async () => {
    stubNotion({
      x: {
        active: true,
        Name_JP: '<img src=x onerror=alert(1)>',
        Github_ID: 'a" onmouseover="alert(1)',
        Email: "not an email",
      },
    });
    const html = await (await call("/p/x")).text();
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x");
    expect(html).not.toContain('href="https://github.com/a"'); // never turned into a link
    expect(html).not.toContain("mailto:not");
  });

  it("returns 404 for an inactive member's profile", async () => {
    stubNotion({ haruharu: { active: false, Name_JP: "山田" } });
    expect((await call("/p/haruharu")).status).toBe(404);
    expect((await call("/profile/haruharu")).status).toBe(404);
  });

  it("/profile/:id always shows the profile, even with a redirect override", async () => {
    stubNotion({ haruharu: { active: true, targetUrl: "https://example.org/me", Name_JP: "山田 太郎" } });
    const res = await call("/profile/haruharu");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("山田 太郎");
  });
});

describe("GET /assets/logo.png", () => {
  it("serves a cacheable PNG", async () => {
    const res = await call("/assets/logo.png");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    expect(res.headers.get("Cache-Control")).toContain("max-age");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([...bytes.slice(1, 4)]).toEqual([80, 78, 71]); // "PNG"
  });
});

describe("fallback routing", () => {
  it("redirects / to DEFAULT_REDIRECT_URL", async () => {
    stubNotion({});
    const res = await call("/");
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("https://example.com/default");
  });

  it("redirects unknown paths to DEFAULT_REDIRECT_URL", async () => {
    stubNotion({});
    const res = await call("/about/us");
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("https://example.com/default");
  });

  it("rejects non-GET methods with 405", async () => {
    const res = await call("/p/haruharu", { method: "POST" });
    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toBe("GET, HEAD");
  });
});
