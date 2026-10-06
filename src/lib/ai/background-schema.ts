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
        age: { type: "string" },
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
  return out;
}
