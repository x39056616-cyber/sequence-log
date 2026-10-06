import { beforeEach, describe, expect, it } from "vitest";
import { db, ensureSeed } from "@/lib/db";
import { calculateDigestionCap } from "@/lib/domain/digestion";
import { initialRealityRequirements } from "@/lib/domain/sequence";
import { advanceSequence, applyLossOfControl, completeQuest, createQuest, exportBackup, importBackup, selectPathway, transferPathway, undoCompletion } from "@/lib/repository";
import type { QuestDraft } from "@/lib/repository";

const draft: QuestDraft = { title: "深度阅读", description: "完成一章", type: "main", status: "today", difficulty: 3, priority: 3, estimatedMinutes: 60, dueAt: null, xpOverride: null, actingFit: 1, attributeIds: ["intellect"], tags: [], notes: "" };

describe("database transactions", () => {
  beforeEach(async () => { db.close(); await db.delete(); await db.open(); await ensureSeed(); });
  it("completes once and reverses the ledger", async () => {
    const quest = await createQuest(draft);
    const before = await db.profile.get("me");
    const completion = await completeQuest(quest.id, { quality: "done", actualMinutes: 60 });
    const after = await db.profile.get("me");
    expect(completion.digestionAwarded).toBeGreaterThan(0);
    expect(after!.totalSpirituality).toBeGreaterThan(before!.totalSpirituality);
    await expect(completeQuest(quest.id, { quality: "done", actualMinutes: 60 })).rejects.toThrow("已经完成");
    await undoCompletion(completion.id);
    expect((await db.profile.get("me"))!.totalSpirituality).toBe(before!.totalSpirituality);
    expect((await db.sequenceState.get("active"))!.digestion).toBe(0);
  });
  it("advances only after full digestion", async () => {
    await selectPathway("fool");
    const settings = (await db.settings.get("app"))!;
    const cap = calculateDigestionCap(9, settings);
    await db.sequenceState.update("active", { digestion: cap });
    const result = await advanceSequence();
    expect(result.sequence).toBe(8);
    expect((await db.sequenceState.get("active"))!.sequence).toBe(8);
  });
  it("enforces the advancement ritual before sequence 5", async () => {
    await selectPathway("fool");
    const settings = (await db.settings.get("app"))!;
    await db.sequenceState.update("active", { sequence: 6, digestion: calculateDigestionCap(6, settings) });
    await db.realityRequirements.bulkAdd(initialRealityRequirements("fool", 6));
    const requirement = await db.realityRequirements.where("pathwayId").equals("fool").filter((item) => item.sequence === 6 && item.kind === "ritual").first();
    expect(requirement).toBeTruthy();
    await expect(advanceSequence()).rejects.toThrow("晋升仪式尚未完成");
    await db.realityRequirements.update(requirement!.id, { completed: true });
    expect((await advanceSequence()).sequence).toBe(5);
  });
  it("transfers only to an adjacent pathway at sequence 4 or 3", async () => {
    await selectPathway("fool");
    await db.sequenceState.update("active", { sequence: 4 });
    const target = await transferPathway("door");
    expect(target.name).toBe("门");
    expect((await db.sequenceState.get("active"))!.pathwayId).toBe("door");
    await expect(transferPathway("sun")).rejects.toThrow("目标不是相邻途径");
  });
  it("applies confirmed loss of control with the sequence 9 floor", async () => {
    await selectPathway("fool");
    const settings = (await db.settings.get("app"))!;
    await db.sequenceState.update("active", { sequence: 7, digestion: Math.floor(calculateDigestionCap(7, settings) * .2) });
    await db.settings.update("app", { status: { san: 10, energy: 10, focus: 10, motivation: 10 } });
    const result = await applyLossOfControl("test");
    expect(result.sequence).toBe(8);
    await db.sequenceState.update("active", { sequence: 9, digestion: 1 });
    expect((await applyLossOfControl("test")).sequence).toBe(9);
  });
  it("migrates a v1 backup and creates the v2 profile fields", async () => {
    const snapshot = await exportBackup();
    const legacy = { ...snapshot, schemaVersion: 1 } as Record<string, unknown>;
    delete legacy.personalProfile;
    delete legacy.adventureEvents;
    delete legacy.storyFlags;
    delete legacy.storyActors;
    delete legacy.sceneAssets;
    delete legacy.aiRequestLogs;
    await importBackup(legacy as never);
    expect((await db.personalProfile.get("me"))?.id).toBe("me");
    expect(await db.adventureEvents.count()).toBe(0);
  });  it("round-trips a versioned backup", async () => {
    await selectPathway("error");
    const snapshot = await exportBackup();
    expect(snapshot.schemaVersion).toBe(7);
    await db.profile.update("me", { name: "Changed" });
    await importBackup(snapshot);
    expect((await db.profile.get("me"))!.name).toBe("调查员");
    expect((await db.sequenceState.get("active"))!.pathwayId).toBe("error");
  });
});







describe("dexie index coverage for live queries", () => {
  beforeEach(async () => { db.close(); await db.delete(); await db.open(); await ensureSeed(); });
  it("story tables expose every key path used by orderBy callers", async () => {
    await expect(db.adventureEvents.orderBy("createdAt").reverse().toArray()).resolves.toBeInstanceOf(Array);
    await expect(db.storyTurns.orderBy("createdAt").reverse().toArray()).resolves.toBeInstanceOf(Array);
    await expect(db.storyCheckpoints.orderBy("createdAt").reverse().toArray()).resolves.toBeInstanceOf(Array);
    await expect(db.storyThreads.orderBy("createdAt").reverse().toArray()).resolves.toBeInstanceOf(Array);
    await expect(db.attributes.orderBy("order").toArray()).resolves.toBeInstanceOf(Array);
  });
});




