/**
 * 肩書き（日本語）→ 名刺に載せる英語表記の自動提案。
 *
 * 1. よくある部活・サークルの役職は辞書で即答する（「副」は Vice を付ける）
 * 2. 辞書にないものは Workers AI（`AI` バインディング）に短い肩書きとして訳させる。無ければ提案なし
 * 提案はあくまで下書き。管理画面で確認・修正してから保存する。
 */

const DICT: Record<string, string> = {
  部長: "President",
  会長: "President",
  代表: "Representative",
  代表理事: "Representative",
  主将: "Captain",
  キャプテン: "Captain",
  リーダー: "Leader",
  責任者: "Manager",
  幹事長: "Secretary General",
  幹事: "Organizer",
  書記: "Secretary",
  会計: "Treasurer",
  広報: "Public Relations",
  渉外: "External Relations",
  文サ: "Culture Circle Liaison",
  文化サークル連絡: "Culture Circle Liaison",
  企画: "Planning",
  運営: "Operations",
  総務: "General Affairs",
  技術: "Engineering",
  技術リード: "Tech Lead",
  デザイン: "Design",
  監査: "Auditor",
  顧問: "Advisor",
  副顧問: "Vice Advisor",
  メンバー: "Member",
  部員: "Member",
  一般部員: "Member",
  新入部員: "New Member",
  OB: "Alumni",
  OG: "Alumni",
  OBOG: "Alumni",
};

const clean = (s: string) => s.replace(/\s+/g, "").trim();

/** 辞書だけで引く（副〇〇 → Vice 〇〇 を含む）。見つからなければ空文字 */
export function dictRoleEn(jp: string): string {
  const k = clean(jp);
  if (!k) return "";
  if (DICT[k]) return DICT[k];
  const vice = /^(?:副|サブ)(.+)$/.exec(k);
  if (vice) {
    const rest = dictRoleEn(vice[1]);
    return rest ? `Vice ${rest}` : "";
  }
  return "";
}

type AiBinding = { run(model: string, input: unknown): Promise<unknown> };

/** 辞書 → AI の順で提案する。出せなければ空文字 */
export async function suggestRoleEn(jp: string, env: object): Promise<{ en: string; source: "dict" | "ai" | "" }> {
  const hit = dictRoleEn(jp);
  if (hit) return { en: hit, source: "dict" };
  const ai = (env as { AI?: AiBinding }).AI;
  const k = clean(jp);
  if (!ai || !k || k.length > 16) return { en: "", source: "" };
  try {
    const out = (await ai.run("@cf/meta/llama-3.1-8b-instruct", {
      messages: [
        {
          role: "system",
          content:
            "You translate Japanese student-club officer titles into short English job titles for a business card. " +
            "Answer with the English title only (1-4 words, Title Case, no quotes, no explanation). Titles may be abbreviations (e.g. 文サ = 文化サークル連絡 = Culture Circle Liaison).",
        },
        { role: "user", content: k },
      ],
      max_tokens: 24,
      temperature: 0,
    })) as { response?: string };
    const en = (out.response ?? "")
      .split("\n")[0]
      .replace(/["'`.。]/g, "")
      .trim()
      .slice(0, 40);
    return /^[A-Za-z][A-Za-z &/-]*$/.test(en) ? { en, source: "ai" } : { en: "", source: "" };
  } catch {
    return { en: "", source: "" };
  }
}
