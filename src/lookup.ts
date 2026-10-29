/**
 * /p/:id と /profile/:id が使う、Notion 参照の短命キャッシュ。
 * QR 読み取りは集中しうるので Cache API に数十秒だけ覚えさせ、管理画面で書き換えたら即座に消す。
 */
import { getMember, type Member, type NotionEnv } from "./notion";

const keyFor = (id: string) => new Request(`https://tech-qr.cache/member/${encodeURIComponent(id)}`);

export function toPositiveInt(value: string | undefined): number {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export async function lookup(
  id: string,
  env: NotionEnv & { CACHE_TTL_SECONDS?: string },
  ctx: ExecutionContext,
): Promise<Member | null> {
  const ttl = toPositiveInt(env.CACHE_TTL_SECONDS);
  if (ttl === 0) return getMember(id, env);

  const cache = caches.default;
  const hit = await cache.match(keyFor(id));
  if (hit) return (await hit.json()) as Member | null;

  const member = await getMember(id, env);
  // 「いない」結果も短く覚えて、存在しない ID への連打が Notion に届かないようにする
  const age = member ? ttl : Math.min(ttl, 15);
  ctx.waitUntil(
    cache.put(
      keyFor(id),
      new Response(JSON.stringify(member), {
        headers: { "Content-Type": "application/json", "Cache-Control": `public, max-age=${age}` },
      }),
    ),
  );
  return member;
}

/** 管理画面で書き換えた直後に呼ぶ（同じ拠点のキャッシュを破棄。他拠点は TTL で更新） */
export async function invalidateMember(id: string): Promise<void> {
  await caches.default.delete(keyFor(id)).catch(() => false);
}
