import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db, ensureSeed } from "@/lib/db";
import { exportBackup, getActiveCharacterBackground, importBackup, listCharacterBackgrounds, saveCharacterBackground, selectPathway } from "@/lib/repository";
import { BANNED_NARRATION_PHRASES, findBannedPhrase, generateCharacterBackground, maxTokensForChapterLength, turnPrompt, type NarrativeStreamInput } from "@/lib/ai/provider";
import { BACKGROUND_JSON_SCHEMA, characterBackgroundSchema } from "@/lib/ai/background-schema";
import type { BackgroundFields } from "@/lib/types";
import type { ResolvedAIConfig } from "@/lib/ai/config";

const fields: BackgroundFields = {
  name: "伊莱亚斯·索恩",
  age: "二十六",
  occupation: "档案整理员",
  origin: "廷根市旧城区的钟表铺",
  appearance: "浅灰眼睛，右手食指有一道旧伤。",
  personality: "谨慎、记性极好，但不擅长拒绝别人。",
  motive: "想弄明白父亲失踪那晚到底发生了什么。",
  secret: "他能听见旧物件残留的情绪回声。",
  keepsake: "一枚停摆的黄铜怀表",
  weakness: "在密闭空间里会短暂失去判断力。",
};

const status: ResolvedAIConfig = {
  configured: true,
  provider: "deepseek",
  providerLabel: "DeepSeek",
  protocol: "chat-completions",
  baseUrl: "https://api.deepseek.com/v1",
  apiKey: "sk-test",
  model: "deepseek-chat",
  narrativeModel: "deepseek-chat",
  adjudicatorModel: "deepseek-chat",
  imageModel: "",
  useThinking: false,
  source: "runtime",
};

function completion(content: unknown) {
  return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(content) } }] }) } as unknown as Response;
}

afterEach(() => { vi.restoreAllMocks(); });

describe("character background schema", () => {
  it("accepts a complete background", () => {
    const parsed = characterBackgroundSchema.safeParse({ fields, backgroundText: "灰雾".repeat(200) });
    expect(parsed.success).toBe(true);
  });

  it("rejects a background with a missing field", () => {
    const { keepsake, ...rest } = fields;
    void keepsake;
    const parsed = characterBackgroundSchema.safeParse({ fields: rest, backgroundText: "灰雾".repeat(200) });
    expect(parsed.success).toBe(false);
  });

  it("rejects a background text that is too short", () => {
    const parsed = characterBackgroundSchema.safeParse({ fields, backgroundText: "太短" });
    expect(parsed.success).toBe(false);
  });

  it("declares the same required fields in the JSON schema", () => {
    const required = (BACKGROUND_JSON_SCHEMA.properties.fields as { required: readonly string[] }).required;
    expect(required).toContain("name");
    expect(required).toContain("keepsake");
    expect(required).toHaveLength(10);
  });
});

describe("character background generation", () => {
  it("retries once and returns the second attempt", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 500 } as unknown as Response)
      .mockResolvedValueOnce(completion({ fields, backgroundText: "灰雾".repeat(200) }));
    vi.stubGlobal("fetch", fetchMock);
    const draft = await generateCharacterBackground({ fateSummary: "", fateAttributes: [], pathwayName: "愚者", sequenceName: "占卜家", sequenceRank: 9, realitySummary: "", existingFields: {} }, status);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(draft.fields.name).toBe(fields.name);
  });

  it("gives up after two attempts instead of substituting template prose", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503 } as unknown as Response);
    vi.stubGlobal("fetch", fetchMock);
    await expect(generateCharacterBackground({ fateSummary: "", fateAttributes: [], pathwayName: "愚者", sequenceName: "占卜家", sequenceRank: 9, realitySummary: "", existingFields: {} }, status)).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("truncates verbose fields instead of failing the whole background", async () => {
    const verbose = {
      fields: { ...fields, keepsake: "黄".repeat(400), appearance: "蓝".repeat(900), name: "名".repeat(120) },
      backgroundText: "灰雾".repeat(2000),
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(completion(verbose)));
    const draft = await generateCharacterBackground({ fateSummary: "", fateAttributes: [], pathwayName: "愚者", sequenceName: "占卜家", sequenceRank: 9, realitySummary: "", existingFields: {} }, status);
    expect(draft.fields.keepsake.length).toBeLessThanOrEqual(160);
    expect(draft.fields.appearance.length).toBeLessThanOrEqual(300);
    expect(draft.fields.name.length).toBeLessThanOrEqual(40);
    expect(draft.backgroundText.length).toBeLessThanOrEqual(2000);
  });
  it("refuses to run when no provider is configured", async () => {
    await expect(generateCharacterBackground({ fateSummary: "", fateAttributes: [], pathwayName: "愚者", sequenceName: "占卜家", sequenceRank: 9, realitySummary: "", existingFields: {} }, { ...status, configured: false })).rejects.toThrow("尚未配置 AI");
  });
});

describe("narrative prompt", () => {
  const baseInput: NarrativeStreamInput = {
    context: {
      generatedFor: "2026-10-04",
      personalSummary: "", goals: [], interests: [], preferredDomains: [], avoidedTasks: [], constraints: [],
      schedule: { weekdayMinutes: 45, weekendMinutes: 90, preferredTime: "flexible", energyPattern: "variable" },
      resources: { environment: [], equipment: [], socialPreference: "solo", difficultyPreference: 3 },
      state: { pathway: "愚者", sequence: 9, sequenceName: "占卜家", status: {}, digestion: 0, digestionCap: 100 },
      recentCompletions: [], currentQuests: [], storyFlags: [], recentEvents: [], habits: [], habitLogs: [], loreEvidence: [],
      skills: [{ name: "占卜家", level: "入门", proficiency: 12 }],
      relationships: [{ name: "邓恩", role: "值夜者队长", faction: "黑夜女神教会", attitude: "友好", relationship: 20, notes: "可信任的上级" }],
      background: { name: "伊莱亚斯·索恩", age: "二十六", occupation: "档案整理员", origin: "廷根", appearance: "", personality: "", motive: "", secret: "", keepsake: "黄铜怀表", weakness: "", text: "背景正文" },
      fate: { summary: "身份类型：穿书者", attributes: [{ category: "身份类型", value: "穿书者", pool: "default", maySuggestRealityTask: false }], note: "" },
    },
    userInput: "",
    mode: "auto",
    worldState: {},
    recentTurns: [],
    summary: "",
    phase: "opening",
    chapterLength: "long",
  };

  it("carries the background and the fate into every turn prompt", () => {
    const prompt = turnPrompt(baseInput, "narrative");
    expect(prompt).toContain("characterBackground");
    expect(prompt).toContain("伊莱亚斯·索恩");
    expect(prompt).toContain("穿书者");
  });

  it("asks for a full-length opening chapter instead of a short intro", () => {
    const prompt = turnPrompt(baseInput, "narrative");
    expect(prompt).toContain("第一章开篇");
    expect(prompt).toContain("1500–2500");
  });

  it("honours the configured chapter length", () => {
    expect(turnPrompt({ ...baseInput, chapterLength: "brief" }, "narrative")).toContain("800–1200");
    expect(maxTokensForChapterLength("brief")).toBeLessThan(maxTokensForChapterLength("long"));
  });

  it("forbids fourth-wall phrasing", () => {
    for (const phrase of BANNED_NARRATION_PHRASES) expect(findBannedPhrase("前文…" + phrase + "…后文")).toBe(phrase);
    expect(findBannedPhrase("……你可以继续输入行动。")).toBe("你可以继续输入");
    expect(findBannedPhrase("灰雾散开，脚步声远去。")).toBeNull();
  });
});

describe("character background persistence", () => {
  beforeEach(async () => {
    db.close(); await db.delete(); await db.open();
    await ensureSeed(); await selectPathway("fool");
  });

  it("opens v7 with the characterBackgrounds table", async () => {
    expect(db.tables.map((table) => table.name)).toContain("characterBackgrounds");
    expect(db.verno).toBe(8);
  });

  it("supersedes the previous background while keeping history", async () => {
    const first = await saveCharacterBackground({ fields, backgroundText: "第一版", fateProfileId: null, provider: "deepseek", model: "deepseek-chat" });
    const second = await saveCharacterBackground({ fields: { ...fields, name: "第二版" }, backgroundText: "第二版", fateProfileId: null, provider: "deepseek", model: "deepseek-chat" });
    const active = await getActiveCharacterBackground();
    expect(active?.id).toBe(second.id);
    const all = await listCharacterBackgrounds();
    expect(all).toHaveLength(2);
    expect(all.find((item) => item.id === first.id)?.status).toBe("superseded");
    expect(all.find((item) => item.id === first.id)?.supersededAt).toBeTruthy();
  });
});

describe("backup v5", () => {
  beforeEach(async () => {
    db.close(); await db.delete(); await db.open();
    await ensureSeed(); await selectPathway("fool");
  });

  it("exports and re-imports character backgrounds", async () => {
    await saveCharacterBackground({ fields, backgroundText: "备份正文", fateProfileId: null, provider: "deepseek", model: "deepseek-chat" });
    const backup = await exportBackup();
    expect(backup.schemaVersion).toBe(7);
    expect(backup.characterBackgrounds).toHaveLength(1);

    db.close(); await db.delete(); await db.open();
    await importBackup(backup);
    expect((await getActiveCharacterBackground())?.backgroundText).toBe("备份正文");
  });

  it("still accepts a v4 backup without backgrounds", async () => {
    const backup = await exportBackup();
    const legacy = { ...backup, schemaVersion: 4 } as Record<string, unknown>;
    delete legacy.characterBackgrounds;
    delete legacy.skills;
    delete legacy.skillEvents;
    db.close(); await db.delete(); await db.open();
    await importBackup(legacy as never);
    expect(await getActiveCharacterBackground()).toBeNull();
  });
});









