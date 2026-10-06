import { beforeEach, describe, expect, it } from "vitest";
import { db, ensureSeed } from "@/lib/db";
import { buildAIContext, detectSensitiveInput, sanitizeText } from "@/lib/adventure/privacy";
import { localChapter } from "@/lib/adventure/local-narrative";
import { turnAdjudicationSchema } from "@/lib/ai/turn-schema";
import { planAdventure } from "@/lib/adventure/planner";
import { applyTurnOperations, createInitialWorldState } from "@/lib/adventure/state";
import { createStoryCheckpoint, branchFromCheckpoint, saveAdventureEvent } from "@/lib/repository";
import { acceptTaskProposal, rejectTaskProposal, resolveAdventureChoice, updateTaskProposal } from "@/lib/repository";

async function plannerInput() {
  const [profile, settings, state, quests, completions, attributes, flags, events, habits, habitLogs] = await Promise.all([
    db.personalProfile.get("me"), db.settings.get("app"), db.sequenceState.get("active"), db.quests.toArray(), db.completions.toArray(), db.attributes.toArray(), db.storyFlags.toArray(), db.adventureEvents.toArray(), db.habits.toArray(), db.habitLogs.toArray(),
  ]);
  return { profile: profile!, settings: settings!, state: state!, quests, completions, attributes, flags, events, habits, habitLogs };
}

describe("immersive adventure pipeline", () => {
  beforeEach(async () => { db.close(); await db.delete(); await db.open(); await ensureSeed(); });
  it("redacts common private identifiers", () => {
    const text = sanitizeText("联系 test@example.com 或 13800138000，我住在北京市朝阳区。");
    expect(text).not.toContain("test@example.com");
    expect(text).not.toContain("13800138000");
    expect(text).not.toContain("北京市朝阳区");
  });
  it("detects sensitive freeform input and rejects malformed adjudication", () => {
    expect(detectSensitiveInput("联系 test@example.com")).toBe(true);
    expect(turnAdjudicationSchema.safeParse({ operations: [{ type: "adjust_flag", key: "x", label: "x", delta: 99 }], suggestedChoices: [] }).success).toBe(false);
  });
  it("creates a long local chapter when no AI key exists", () => {
    const text = localChapter({ userInput: "我走进教堂", mode: "action", worldState: createInitialWorldState("thread"), sequenceName: "占卜家", pathwayName: "愚者" });
    expect(text.length).toBeGreaterThanOrEqual(1200);
  });
  it("keeps local-only constraints out of AI context", async () => {
    const input = await plannerInput();
    input.profile.constraints = [{ id: "h", category: "health", summary: "不能高强度运动", detail: "诊断内容", sharing: "local" }];
    const context = buildAIContext({ localDate: "2026-10-03", profile: input.profile, quests: input.quests, completions: input.completions, flags: input.flags, events: input.events, habits: input.habits, habitLogs: input.habitLogs, pathwayId: null, sequence: 9, digestion: 0, digestionCap: 100, status: input.settings.status });
    expect(context.constraints).toHaveLength(0);
  });
  it("plans one main and two side proposals within the task budget", async () => {
    const input = await plannerInput();
    const event = planAdventure({ localDate: "2026-10-03", kind: "daily", profile: input.profile, quests: input.quests, completions: input.completions, attributes: input.attributes, settings: input.settings, pathwayId: null, sequence: 9, flags: input.flags });
    expect(event.proposals).toHaveLength(3);
    expect(event.proposals.filter((item) => item.type === "main")).toHaveLength(1);
    expect(event.proposals.filter((item) => item.type === "side")).toHaveLength(2);
    expect(event.proposals.reduce((total, item) => total + item.estimatedMinutes, 0)).toBeLessThanOrEqual(110);
    expect(event.choices).toHaveLength(3);
  });
  it("applies structured world operations without touching XP", () => {
    const threadId = crypto.randomUUID();
    const base = { worldState: createInitialWorldState(threadId), flags: [], actors: [], items: [] };
    const result = applyTurnOperations(base, [{ type: "adjust_flag", key: "resolve", label: "决心", delta: 2 }, { type: "upsert_actor", name: "雾中访客", role: "线人", relationshipDelta: 1, notes: "谨慎" }, { type: "add_item", name: "黄铜钥匙", description: "陌生钥匙", rarity: "rare" }, { type: "add_fact", fact: "发现了一扇隐藏的门" }]);
    expect(result.flags[0].value).toBe(2);
    expect(result.actors[0].name).toBe("雾中访客");
    expect(result.items[0].status).toBe("held");
    expect(result.worldState.knownFacts).toContain("发现了一扇隐藏的门");
  });
  it("creates a new timeline from a checkpoint", async () => {
    const input = await plannerInput();
    const event = await saveAdventureEvent(planAdventure({ localDate: "2026-10-03", kind: "daily", profile: input.profile, quests: input.quests, completions: input.completions, attributes: input.attributes, settings: input.settings, pathwayId: input.state.pathwayId, sequence: input.state.sequence, flags: input.flags }));
    const checkpoint = await createStoryCheckpoint({ threadId: event.threadId!, turnId: null, label: "测试存档", automatic: true });
    const branch = await branchFromCheckpoint(checkpoint.id);
    expect(branch.parentCheckpointId).toBe(checkpoint.id);
    expect((await db.storyThreads.get(event.threadId!))?.status).toBe("archived");
    const branchState = await db.worldStates.get(branch.id);
    expect(branchState?.threadId).toBe(branch.id);
    expect(branchState?.id).not.toBe(checkpoint.worldState.id);
    expect((await db.storyThreads.get(event.threadId!))?.currentTurnId).toBeNull();
  });
  it("resolves a branch and accepts only its linked proposal", async () => {
    const input = await plannerInput();
    const event = planAdventure({ localDate: "2026-10-03", kind: "daily", profile: input.profile, quests: input.quests, completions: input.completions, attributes: input.attributes, settings: input.settings, pathwayId: input.state.pathwayId, sequence: input.state.sequence, flags: input.flags });
    await saveAdventureEvent(event);
    const resolved = await resolveAdventureChoice(event.id, event.choices[0].id);
    const pending = resolved.proposals.filter((item) => item.proposalStatus === "pending");
    expect(pending).toHaveLength(1);
    const quest = await acceptTaskProposal(event.id, pending[0].id);
    expect(quest.originEventId).toBe(event.id);
    expect(quest.realityAction).toBe(pending[0].realityAction);
    expect((await db.storyFlags.toArray()).length).toBeGreaterThan(0);
  });
  it("lets a pending proposal be edited before acceptance", async () => {
    const input = await plannerInput();
    const event = await saveAdventureEvent(planAdventure({ localDate: "2026-10-03", kind: "daily", profile: input.profile, quests: input.quests, completions: input.completions, attributes: input.attributes, settings: input.settings, pathwayId: input.state.pathwayId, sequence: input.state.sequence, flags: input.flags }));
    const proposal = event.proposals[0];
    await updateTaskProposal(event.id, proposal.id, { realityAction: "修改后的现实行动", successCriteria: "完成后写下三行记录", estimatedMinutes: 25 });
    const updated = (await db.adventureEvents.get(event.id))!;
    const row = updated.proposals.find((item) => item.id === proposal.id)!;
    expect(row.realityAction).toBe("修改后的现实行动");
    expect(row.successCriteria).toContain("三行记录");
    expect(row.estimatedMinutes).toBe(25);
    expect(row.proposalStatus).toBe("pending");
  });
  it("rejects a proposal without creating a quest or penalty", async () => {
    const input = await plannerInput();
    const event = await saveAdventureEvent(planAdventure({ localDate: "2026-10-03", kind: "daily", profile: input.profile, quests: input.quests, completions: input.completions, attributes: input.attributes, settings: input.settings, pathwayId: input.state.pathwayId, sequence: input.state.sequence, flags: input.flags }));
    const before = await db.quests.count();
    await rejectTaskProposal(event.id, event.proposals[0].id);
    const after = await db.adventureEvents.get(event.id);
    expect(after?.proposals.find((item) => item.id === event.proposals[0].id)?.proposalStatus).toBe("rejected");
    expect(await db.quests.count()).toBe(before);
  });
});


