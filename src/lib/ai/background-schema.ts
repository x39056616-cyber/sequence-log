import { z } from "zod";

export const backgroundFieldsSchema = z.object({
  name: z.string().min(1).max(40),
  age: z.string().min(1).max(40),
  occupation: z.string().min(1).max(80),
  origin: z.string().min(1).max(120),
  appearance: z.string().min(4).max(300),
  personality: z.string().min(4).max(300),
  motive: z.string().min(4).max(300),
  secret: z.string().min(4).max(300),
  keepsake: z.string().min(2).max(160),
  weakness: z.string().min(4).max(300),
});

export const characterBackgroundSchema = z.object({
  fields: backgroundFieldsSchema,
  backgroundText: z.string().min(300).max(2000),
});

export type CharacterBackgroundDraft = z.infer<typeof characterBackgroundSchema>;

export const BACKGROUND_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["fields", "backgroundText"],
  properties: {
    fields: {
      type: "object",
      additionalProperties: false,
      required: ["name", "age", "occupation", "origin", "appearance", "personality", "motive", "secret", "keepsake", "weakness"],
      properties: {
        name: { type: "string" },
        age: { type: "string", description: "主角年龄，必须落在 20 到 26 岁之间。" },
        occupation: { type: "string" },
        origin: { type: "string" },
        appearance: { type: "string" },
        personality: { type: "string" },
        motive: { type: "string" },
        secret: { type: "string" },
        keepsake: { type: "string" },
        weakness: { type: "string" },
      },
    },
    backgroundText: { type: "string" },
  },
} as const;

export function emptyBackgroundFields() {
  return { name: "", age: "", occupation: "", origin: "", appearance: "", personality: "", motive: "", secret: "", keepsake: "", weakness: "" };
}

const CHINESE_AGES = ["二十六", "二十五", "二十四", "二十三", "二十二", "二十一", "二十"];

function stableAge(seed: string) {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.codePointAt(0)!) | 0;
  return 20 + (Math.abs(hash) % 7);
}

function normalizeAge(raw: string, seed: string) {
  const trimmed = raw.trim();
  const arabic = trimmed.match(/\d{1,3}/);
  const numeric = arabic ? Number(arabic[0]) : Number.NaN;
  if (numeric >= 20 && numeric <= 26) return `${numeric}岁`;
  const chineseIndex = CHINESE_AGES.findIndex((value) => trimmed.includes(value));
  if (chineseIndex >= 0) return `${CHINESE_AGES[chineseIndex]}岁`;
  return `${stableAge(seed)}岁`;
}

/** Clamps each field to the schema limits so a slightly verbose model reply never fails the request. */
export function normalizeBackgroundFields(input: Record<string, unknown>) {
  const limits: Record<keyof ReturnType<typeof emptyBackgroundFields>, number> = {
    name: 40, age: 40, occupation: 80, origin: 120, appearance: 300,
    personality: 300, motive: 300, secret: 300, keepsake: 160, weakness: 300,
  };
  const out = emptyBackgroundFields();
  for (const key of Object.keys(out) as Array<keyof typeof out>) {
    const raw = input[key];
    out[key] = typeof raw === "string" ? raw.trim().slice(0, limits[key]) : "";
  }
  out.age = normalizeAge(out.age, `${out.name}|${out.occupation}|${out.origin}`);
  return out;
}

