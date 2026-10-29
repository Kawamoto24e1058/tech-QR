/**
 * 名刺（表面）に載せる項目の設定。部で 1 つ（全員共通）。管理画面「名刺」タブで編集し、Notion に保存する。
 * 既定値は設定を保存する前の名刺と同じ見た目。
 */
export const CONTACT_KINDS = ["mail", "github", "x"] as const;
export type ContactKind = (typeof CONTACT_KINDS)[number];

export interface CardSettings {
  /** 載せる連絡先（この順に並ぶ。含まれない種類は載せない） */
  contacts: ContactKind[];
  /** 載せるスキルの数（0〜3） */
  skills: number;
  /** 英語の氏名（ローマ字）を載せる */
  showNameEn: boolean;
  /** 英語の肩書きを載せる */
  showRoleEn: boolean;
  /** ヘッダの「DEV TEAM / ID」の行を載せる */
  showId: boolean;
}

export const DEFAULT_SETTINGS: CardSettings = {
  contacts: ["mail", "github", "x"],
  skills: 3,
  showNameEn: true,
  showRoleEn: true,
  showId: true,
};

/** 外から来た値を安全な設定にする（足りない・不正な項目は既定値） */
export function parseSettings(raw: unknown): CardSettings {
  const b = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const contacts = Array.isArray(b.contacts)
    ? [...new Set(b.contacts.filter((c): c is ContactKind => (CONTACT_KINDS as readonly unknown[]).includes(c)))]
    : DEFAULT_SETTINGS.contacts;
  const skills = typeof b.skills === "number" && Number.isInteger(b.skills) && b.skills >= 0 && b.skills <= 3 ? b.skills : DEFAULT_SETTINGS.skills;
  const flag = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
  return {
    contacts,
    skills,
    showNameEn: flag(b.showNameEn, DEFAULT_SETTINGS.showNameEn),
    showRoleEn: flag(b.showRoleEn, DEFAULT_SETTINGS.showRoleEn),
    showId: flag(b.showId, DEFAULT_SETTINGS.showId),
  };
}
