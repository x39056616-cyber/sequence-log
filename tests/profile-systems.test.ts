import { beforeEach, describe, expect, it } from "vitest";
import { db, ensureSeed } from "@/lib/db";
import { ATTRIBUTE_DISPLAY, attitudeFor, clampRelationship, DECAY_GRACE_DAYS, DECAY_PERIOD_DAYS, decayFloor, levelForProficiency, levelThreshold, proficiencyGain, settleDecay, SKILL_MAX_PROFICIENCY } from "@/lib/domain/skill";
import { ABILITIES } from "@/lib/lore/abilities";
import { AUTHOR_CONTENT } from "@/lib/lore/author-content";
import loreAudit from "@/lib/lore/lore-audit.generated.json";
import {
  completeQuest, createInventoryItem, createManualSkill, createQuest, exportBackup, importBackup, listInventory,
  listRelationships, listSkillEvents, listSkills, selectPathway, setEquipped, setStoryItemStatus, settleSkillDecay,
  trainSkillManually, undoCompletion, unlockCurrentSequenceSkill,
} from "@/lib/repository";
import type { QuestDraft } from "@/lib/repository";
import type { StoryItem, StoryActor } from "@/lib/types";

const draft: QuestDraft = {
  title: "扮演任务", description: "", type: "main", status: "today", difficulty: 3, priority: 3,
  estimatedMinutes: 60, dueAt: null, xpOverride: null, actingFit: 1, attributeIds: ["intellect"], tags: [], notes: "",
};

describe("属性只改显示名", () => {
  it("maps all eight keys to LoTM-flavoured names", () => {
    expect(Object.keys(ATTRIBUTE_DISPLAY)).toEqual(["intellect", "body", "focus", "social", "creativity", "execution", "will", "life"]);
    expect(ATTRIBUTE_DISPLAY.intellect.name).toBe("学识");
    expect(ATTRIBUTE_DISPLAY.focus.name).toBe("灵性");
    expect(ATTRIBUTE_DISPLAY.life.name).toBe("事务");
  });

  it("seeds the new names while keeping the internal keys", async () => {
    db.close(); await db.delete(); await db.open();
    await ensureSeed();
    const rows = await db.attributes.toArray();
    expect(rows).toHaveLength(8);
    for (const row of rows) {
      expect(row.name).toBe(ATTRIBUTE_DISPLAY[row.key].name);
      expect(row.id).toBe(row.key);
    }
  });
});

describe("技能熟练度规则", () => {
  it("levels map to the documented thresholds", () => {
    expect(levelForProficiency(0)).toBe("入门");
    expect(levelForProficiency(99)).toBe("入门");
    expect(levelForProficiency(100)).toBe("熟练");
    expect(levelForProficiency(299)).toBe("熟练");
    expect(levelForProficiency(300)).toBe("精通");
    expect(levelForProficiency(600)).toBe("大师");
    expect(SKILL_MAX_PROFICIENCY).toBe(1000);
  });

  it("only acting-fit >= 1 trains, and follows the public formula", () => {
    expect(proficiencyGain({ difficulty: 3, qualityMultiplier: 1, actingFit: 0.5 })).toBe(0);
    expect(proficiencyGain({ difficulty: 3, qualityMultiplier: 1, actingFit: 1 })).toBe(6);
    expect(proficiencyGain({ difficulty: 3, qualityMultiplier: 2, actingFit: 1.5 })).toBe(12);
    expect(proficiencyGain({ difficulty: 5, qualityMultiplier: 0.5, actingFit: 1 })).toBe(5);
  });

  it("decay respects the grace period", () => {
    const now = new Date("2026-06-01T00:00:00.000Z");
    const within = settleDecay({ proficiency: 500, peakProficiency: 500, level: "精通", lastTrainedAt: "2026-05-25T00:00:00.000Z", decaySettledAt: "2026-05-25T00:00:00.000Z", now });
    expect(within.decayed).toBe(0);
    expect(within.proficiency).toBe(500);
  });

  it("decays by one point per period and is idempotent", () => {
    const lastTrainedAt = "2026-05-01T00:00:00.000Z";
    const now = new Date("2026-06-01T00:00:00.000Z");
    const first = settleDecay({ proficiency: 500, peakProficiency: 500, level: "精通", lastTrainedAt, decaySettledAt: lastTrainedAt, now });
    expect(first.decayed).toBeGreaterThan(0);
    const second = settleDecay({ proficiency: first.proficiency, peakProficiency: 500, level: "精通", lastTrainedAt, decaySettledAt: first.settledAt, now });
    expect(second.decayed).toBe(0);
  });

  it("never decays below the level threshold or 60% of the peak", () => {
    const floor = decayFloor({ peakProficiency: 500, level: "精通" });
    expect(floor).toBeGreaterThanOrEqual(levelThreshold("精通"));
    expect(floor).toBeGreaterThanOrEqual(300);
    const now = new Date("2030-01-01T00:00:00.000Z");
    const result = settleDecay({ proficiency: 500, peakProficiency: 500, level: "精通", lastTrainedAt: "2026-01-01T00:00:00.000Z", decaySettledAt: "2026-01-01T00:00:00.000Z", now });
    expect(result.proficiency).toBeGreaterThanOrEqual(300);
    expect(levelForProficiency(result.proficiency)).not.toBe("入门");
    expect(DECAY_GRACE_DAYS).toBe(14);
    expect(DECAY_PERIOD_DAYS).toBe(3);
  });
});

describe("关系态度推导", () => {
  it("follows the documented boundaries", () => {
    expect(attitudeFor(-40)).toBe("敌对");
    expect(attitudeFor(-11)).toBe("警惕");
    expect(attitudeFor(-10)).toBe("警惕");
    expect(attitudeFor(-9)).toBe("中立");
    expect(attitudeFor(9)).toBe("中立");
    expect(attitudeFor(10)).toBe("友好");
    expect(attitudeFor(39)).toBe("友好");
    expect(attitudeFor(40)).toBe("信任");
  });

  it("clamps to the −100..100 range", () => {
    expect(clampRelationship(-999)).toBe(-100);
    expect(clampRelationship(999)).toBe(100);
  });
});

describe("技能解锁与成长", () => {
  beforeEach(async () => {
    db.close(); await db.delete(); await db.open();
    await ensureSeed(); await selectPathway("fool");
  });

  it("unlocks the current sequence skill when a pathway is chosen", async () => {
    const skills = await listSkills();
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe("占卜家");
    expect(skills[0].sequence).toBe(9);
    expect(skills[0].status === "canon" || skills[0].status === "undisclosed").toBe(true);
    const events = await listSkillEvents(skills[0].id);
    expect(events.some((event) => event.kind === "grant")).toBe(true);
  });

  it("does not duplicate the skill on repeated unlocks", async () => {
    await unlockCurrentSequenceSkill();
    await unlockCurrentSequenceSkill();
    expect(await db.skills.count()).toBe(1);
  });

  it("trains the sequence skill on an acting-fit quest and reverses it on undo", async () => {
    const quest = await createQuest(draft);
    const completion = await completeQuest(quest.id, { quality: "good", actualMinutes: 60 });
    const after = (await listSkills())[0];
    expect(after.proficiency).toBeGreaterThan(0);

    await undoCompletion(completion.id);
    const reverted = (await listSkills())[0];
    expect(reverted.proficiency).toBe(0);
    const events = await listSkillEvents(reverted.id);
    expect(events.some((event) => event.kind === "train" && event.amount < 0)).toBe(true);
  });

  it("does not train for a 0.5 acting-fit quest", async () => {
    const quest = await createQuest({ ...draft, actingFit: 0.5 });
    await completeQuest(quest.id, { quality: "good", actualMinutes: 60 });
    expect((await listSkills())[0].proficiency).toBe(0);
  });

  it("settles decay once and records an audit event", async () => {
    const skill = (await listSkills())[0];
    await db.skills.update(skill.id, { proficiency: 200, peakProficiency: 200, level: "熟练", lastTrainedAt: "2026-01-01T00:00:00.000Z", decaySettledAt: "2026-01-01T00:00:00.000Z" });
    const first = await settleSkillDecay();
    expect(first).toBeGreaterThanOrEqual(0);
    const afterFirst = (await listSkills())[0].proficiency;
    await settleSkillDecay();
    expect((await listSkills())[0].proficiency).toBe(afterFirst);
  });

  it("supports manual skills with manual practice only", async () => {
    const manual = await createManualSkill({ name: "黑魔法", description: "自建" });
    await trainSkillManually(manual.id, 7);
    expect((await db.skills.get(manual.id))?.proficiency).toBe(7);
    const pathway = (await listSkills()).find((skill) => !skill.manual);
    await expect(trainSkillManually(pathway!.id, 5)).rejects.toThrow();
  });
});

describe("背包", () => {
  beforeEach(async () => {
    db.close(); await db.delete(); await db.open();
    await ensureSeed(); await selectPathway("fool");
  });

  it("creates items and keeps 称手 mutually exclusive", async () => {
    const a = await createInventoryItem({ name: "黄铜怀表", description: "", rarity: "rare", category: "beyond", notes: "", source: "手动" });
    const b = await createInventoryItem({ name: "封印物-01", description: "", rarity: "unique", category: "sealed", notes: "", source: "手动" });
    await setEquipped(a.id, "item");
    expect((await db.items.get(a.id))?.equipped).toBe(true);
    await setEquipped(b.id, "item");
    expect((await db.items.get(a.id))?.equipped).toBe(false);
    expect((await db.items.get(b.id))?.equipped).toBe(true);
  });

  it("lets story items be equipped and marked lost", async () => {
    const storyItem: StoryItem = { id: "s1", threadId: "t1", name: "单片眼镜", description: "", rarity: "rare", status: "held", equipped: false, category: "beyond", updatedAt: new Date().toISOString() };
    await db.storyItems.put(storyItem);
    await setEquipped("s1", "story");
    expect((await db.storyItems.get("s1"))?.equipped).toBe(true);
    const permanent = await createInventoryItem({ name: "黄铜日记本", description: "", rarity: "common", category: "beyond", notes: "", source: "手动" });
    await setEquipped(permanent.id, "item");
    expect((await db.storyItems.get("s1"))?.equipped).toBe(false);
    await setStoryItemStatus("s1", "lost");
    expect((await db.storyItems.get("s1"))?.status).toBe("lost");
  });

  it("lists permanent and story items together", async () => {
    await createInventoryItem({ name: "魔药瓶", description: "", rarity: "common", category: "beyond", notes: "", source: "手动" });
    const inventory = await listInventory();
    expect(inventory.items.some((item) => item.name === "魔药瓶")).toBe(true);
  });
});

describe("人物关系只读展示", () => {
  beforeEach(async () => {
    db.close(); await db.delete(); await db.open();
    await ensureSeed(); await selectPathway("fool");
  });

  it("sorts by relationship and derives attitude from the value", async () => {
    const actors: StoryActor[] = [
      { id: "a1", threadId: "t1", name: "邓恩", role: "队长", relationship: 30, attitude: "友好", notes: "", updatedAt: "" },
      { id: "a2", threadId: "t1", name: "阿蒙", role: "未知", relationship: -60, attitude: "敌对", notes: "", updatedAt: "" },
    ];
    await db.storyActors.bulkPut(actors);
    const rows = await listRelationships("t1");
    expect(rows[0].name).toBe("邓恩");
    expect(attitudeFor(rows[0].relationship)).toBe("友好");
    expect(attitudeFor(rows[1].relationship)).toBe("敌对");
  });
});

describe("技能内容来自原著", () => {
  it("covers all 220 sequences", () => {
    expect(ABILITIES.abilities).toHaveLength(220);
    expect(ABILITIES.coverage.sequences).toBe(220);
  });

  it("prioritizes author content and keeps novel fallback citations valid", () => {
    const author = ABILITIES.abilities.filter((entry) => entry.status === "author");
    const canon = ABILITIES.abilities.filter((entry) => entry.status === "canon");
    expect(ABILITIES.coverage.withAbilityEvidence).toBeGreaterThanOrEqual(150);
    expect(ABILITIES.coverage.withAuthorAbility).toBeGreaterThanOrEqual(180);
    expect(ABILITIES.coverage.undisclosed).toBeLessThanOrEqual(12);
    expect(author.length).toBeGreaterThanOrEqual(180);
    for (const entry of author) {
      expect(entry.authorText.length, entry.sequenceName).toBeGreaterThan(20);
      expect(entry.sourceKind).toBe("author");
    }
    for (const entry of canon) {
      expect(entry.evidence.length, entry.sequenceName).toBeGreaterThan(0);
      for (const item of entry.evidence) {
        expect(item.quote, entry.sequenceName).toContain("能力");
        expect(item.quote, entry.sequenceName).toContain(entry.sequenceName);
      }
    }
  });

  it("never invents an ability name for undisclosed sequences", () => {
    const undisclosed = ABILITIES.abilities.filter((entry) => entry.status === "undisclosed");
    expect(undisclosed.length).toBeGreaterThan(0);
    for (const entry of undisclosed) {
      expect(entry.skillName).toBe(entry.sequenceName);
      expect(entry.evidence).toHaveLength(0);
    }
  });

  it("keeps the generated audit aligned with ability coverage", () => {
    const audit = loreAudit as unknown as {
      summary: { sequences: number; withAbilityEvidence: number; undisclosed: number; formulaTotal: number };
      abilities: Array<{ status: string; reason: string }>;
      formulas: { missingByPathway: Record<string, number[]> };
    };
    expect(audit.summary.sequences).toBe(220);
    expect(audit.summary.withAbilityEvidence).toBe(ABILITIES.coverage.withAbilityEvidence);
    expect(audit.summary.undisclosed).toBe(ABILITIES.coverage.undisclosed);
    expect(audit.summary.formulaTotal).toBe(AUTHOR_CONTENT.coverage.formulas);
    expect(audit.abilities.filter((entry) => entry.status === "undisclosed")).toHaveLength(audit.summary.undisclosed);
    for (const entry of audit.abilities) expect(entry.reason.length).toBeGreaterThan(0);
  });

  it("keeps the user-supplied justiciar formulas complete from sequence 9 through 1", () => {
    const formulas = AUTHOR_CONTENT.formulas.filter((formula) => formula.pathwayId === "justiciar");
    expect(formulas.map((formula) => formula.sequence)).toEqual([9, 8, 7, 6, 5, 4, 3, 2, 1]);
    for (const formula of formulas) {
      expect(formula.main.length, `${formula.pathwayId}-${formula.sequence}`).toBeGreaterThan(0);
      expect(formula.aux.length, `${formula.pathwayId}-${formula.sequence}`).toBeGreaterThan(0);
    }
  });
});

describe("备份 v6", () => {
  beforeEach(async () => {
    db.close(); await db.delete(); await db.open();
    await ensureSeed(); await selectPathway("fool");
  });

  it("round-trips skills and skill events", async () => {
    const quest = await createQuest(draft);
    await completeQuest(quest.id, { quality: "good", actualMinutes: 60 });
    const backup = await exportBackup();
    expect(backup.schemaVersion).toBe(7);
    expect(backup.skills.length).toBeGreaterThan(0);
    expect(backup.skillEvents.length).toBeGreaterThan(0);

    db.close(); await db.delete(); await db.open();
    await importBackup(backup);
    expect((await listSkills())[0].proficiency).toBeGreaterThan(0);
    expect(await db.skillEvents.count()).toBeGreaterThan(0);
  });

  it("still accepts a v5 backup without skills", async () => {
    const backup = await exportBackup();
    const legacy = { ...backup, schemaVersion: 5 } as Record<string, unknown>;
    delete legacy.skills;
    delete legacy.skillEvents;
    db.close(); await db.delete(); await db.open();
    await importBackup(legacy as never);
    expect(await db.skills.count()).toBe(0);
  });
});

