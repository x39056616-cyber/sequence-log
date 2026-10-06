import { db, buildBackup } from "@/lib/db";
import { calculateDigestion, calculateStatusAverage, allocateAttributeXp } from "@/lib/domain/digestion";
import { calculateDigestionCap } from "@/lib/domain/digestion";
import { getPathway, getSequence } from "@/lib/lore/pathways";
import { initialRealityRequirements, nextSequence, previousSequence, requiresRitual } from "@/lib/domain/sequence";
import type {
  ActingFit, AdventureEvent, AIRequestLog, Habit, HabitLog, ImportableBackup, PersonalProfile, Quality, Quest, QuestCompletion, SceneAsset, StoryActor, StoryCheckpoint, StoryFlag, StoryItem, StorySummary, StoryThread, StoryTurn, TaskProposal, WorldState,
  RealityRequirement, SequenceRank, Settings, XPEvent, BackgroundFields, CharacterBackground, FateAttribute, FateProfile, Formula, InventoryCategory, Item, Skill, SkillEvent, WheelCategory, WheelOption, WheelSpin,
} from "@/lib/types";
import { clamp, nowIso, uid } from "@/lib/utils";
import { abilityCitations, getSequenceAbility } from "@/lib/lore/abilities";
import { AUTHOR_CONTENT, getAuthorAbility } from "@/lib/lore/author-content";
import { levelForProficiency, proficiencyGain, settleDecay, SKILL_MAX_PROFICIENCY } from "@/lib/domain/skill";
import { attributeFromOption, buildFateProfile, makeSpinRecord, orderCategoriesForSpin, resolvePool, respinIndexFor, spinPool, unlockedPoolsFromAttributes, type SpecialPool } from "@/lib/wheel/engine";

export interface QuestDraft {
  title: string;
  description: string;
  type: Quest["type"];
  status: Quest["status"];
  difficulty: Quest["difficulty"];
  priority: Quest["priority"];
  estimatedMinutes: number;
  dueAt: string | null;
  xpOverride: number | null;
  actingFit: ActingFit;
  attributeIds: string[];
  tags: string[];
  notes: string;
  narrativeTitle?: string;
  narrativeDescription?: string;
  realityAction?: string;
  successCriteria?: string;
  originEventId?: string;
  branchChoiceId?: string;
  storyTags?: string[];
}

function defaultQuest(draft: QuestDraft): Quest {
  const now = nowIso();
  return { id: uid(), ...draft, createdAt: now, updatedAt: now, completedAt: null };
}

export async function createQuest(draft: QuestDraft) {
  const quest = defaultQuest(draft);
  await db.quests.add(quest);
  return quest;
}

export async function updateQuest(id: string, patch: Partial<QuestDraft>) {
  await db.quests.update(id, { ...patch, updatedAt: nowIso() });
}

export async function deleteQuest(id: string) {
  await db.transaction("rw", [db.quests, db.completions, db.xpEvents], async () => {
    const completions = await db.completions.where("questId").equals(id).toArray();
    for (const completion of completions) {
      if (!completion.revokedAt) await undoCompletion(completion.id);
    }
    await db.quests.delete(id);
  });
}

export async function moveQuest(id: string, status: Quest["status"]) {
  await db.quests.update(id, { status, updatedAt: nowIso() });
}

export interface CompleteQuestOptions {
  quality: Quality;
  actualMinutes: number;
  manualAdjustment?: number;
  manualFinal?: number | null;
}

export async function completeQuest(questId: string, options: CompleteQuestOptions): Promise<QuestCompletion> {
  return db.transaction("rw", [db.quests, db.completions, db.xpEvents, db.profile, db.sequenceState, db.settings, db.attributes, db.achievements, db.skills, db.skillEvents], async () => {
    const quest = await db.quests.get(questId);
    const settings = await db.settings.get("app");
    const state = await db.sequenceState.get("active");
    const profile = await db.profile.get("me");
    if (!quest || !settings || !state || !profile) throw new Error("核心数据不存在");
    const activeCompletion = await db.completions.where("questId").equals(questId).filter((item) => !item.revokedAt).first();
    if (activeCompletion) throw new Error("任务已经完成");

    const breakdown = calculateDigestion(quest, options.quality, settings, options.manualAdjustment ?? 0, options.manualFinal ?? null);
    const spirituality = Math.round(breakdown.base * breakdown.quality * breakdown.statusMultiplier);
    const attributeAllocations = allocateAttributeXp(spirituality, quest.attributeIds);
    const completedAt = nowIso();
    const completion: QuestCompletion = {
      id: uid(), questId, questTitle: quest.title, quality: options.quality,
      qualityMultiplier: breakdown.quality, baseDigestion: breakdown.base,
      statusMultiplier: Number(breakdown.statusMultiplier.toFixed(3)), actingFit: quest.actingFit,
      digestionAwarded: breakdown.awarded, spiritualityAwarded: spirituality,
      attributeAllocations, actualMinutes: options.actualMinutes, completedAt,
      revokedAt: null, sequenceAtCompletion: state.sequence,
    };
    const event: XPEvent = {
      id: uid(), kind: "quest", sourceId: completion.id, amount: spirituality,
      digestion: breakdown.awarded, attributeAllocations, reason: quest.title,
      createdAt: completedAt, reversesEventId: null,
    };
    await db.completions.add(completion);
    await db.xpEvents.add(event);
    await db.quests.update(questId, { status: "completed", completedAt, updatedAt: completedAt });
    await db.profile.update("me", { totalSpirituality: profile.totalSpirituality + spirituality, updatedAt: completedAt });
    const cap = calculateDigestionCap(state.sequence, settings);
    await db.sequenceState.update("active", { digestion: clamp(state.digestion + breakdown.awarded, 0, cap), updatedAt: completedAt });
    for (const [attributeId, amount] of Object.entries(attributeAllocations)) {
      const attribute = await db.attributes.get(attributeId);
      if (attribute) await db.attributes.update(attributeId, { xp: attribute.xp + amount, updatedAt: completedAt });
    }
    // 技能成长：仅「扮演契合度 >= 1」的任务训练当前序列技能，规则与 XP 一样公开。
    const skillGain = proficiencyGain({ difficulty: quest.difficulty, qualityMultiplier: breakdown.quality, actingFit: quest.actingFit });
    if (skillGain > 0 && state.pathwayId) {
      const skillId = `skill-${state.pathwayId}-${state.sequence}`;
      if (!(await db.skills.get(skillId))) await db.skills.add(skillRowFor({ pathwayId: state.pathwayId, sequence: state.sequence, now: completedAt }));
      await applyProficiency(skillId, skillGain, `完成任务：${quest.title}`, completion.id, "train");
    }
    const count = await db.completions.filter((item) => !item.revokedAt).count();
    if (count >= 1) await db.achievements.update("first-step", { unlockedAt: completedAt });
    return completion;
  });
}

export async function undoCompletion(completionId: string): Promise<void> {
  return db.transaction("rw", [db.completions, db.xpEvents, db.quests, db.profile, db.sequenceState, db.attributes, db.skills, db.skillEvents], async () => {
    const completion = await db.completions.get(completionId);
    const profile = await db.profile.get("me");
    const state = await db.sequenceState.get("active");
    if (!completion || !profile || !state) throw new Error("结算记录不存在");
    if (completion.revokedAt) return;
    const reversedAt = nowIso();
    const reversal: XPEvent = {
      id: uid(), kind: "reversal", sourceId: completion.id, amount: -completion.spiritualityAwarded,
      digestion: -completion.digestionAwarded, attributeAllocations: Object.fromEntries(Object.entries(completion.attributeAllocations).map(([key, value]) => [key, -value])),
      reason: "撤销任务结算", createdAt: reversedAt, reversesEventId: completion.id,
    };
    await db.xpEvents.add(reversal);
    await db.completions.update(completionId, { revokedAt: reversedAt });
    await db.quests.update(completion.questId, { status: "active", completedAt: null, updatedAt: reversedAt });
    await db.profile.update("me", { totalSpirituality: Math.max(0, profile.totalSpirituality - completion.spiritualityAwarded), updatedAt: reversedAt });
    await db.sequenceState.update("active", { digestion: Math.max(0, state.digestion - completion.digestionAwarded), updatedAt: reversedAt });
    for (const [attributeId, amount] of Object.entries(completion.attributeAllocations)) {
      const attribute = await db.attributes.get(attributeId);
      if (attribute) await db.attributes.update(attributeId, { xp: Math.max(0, attribute.xp - amount), updatedAt: reversedAt });
    }
    // 回退该次结算带来的技能熟练度（保留峰值与等级，不降级）
    const trained = await db.skillEvents.where("sourceId").equals(completionId).filter((event) => event.kind === "train" && event.amount > 0).toArray();
    for (const event of trained) {
      const skill = await db.skills.get(event.skillId);
      if (!skill) continue;
      await db.skills.update(skill.id, { proficiency: Math.max(0, skill.proficiency - event.amount), updatedAt: reversedAt });
      await db.skillEvents.add({ id: uid(), skillId: skill.id, kind: "train", amount: -event.amount, reason: "撤销任务结算", sourceId: completionId, createdAt: reversedAt, reversesEventId: event.id });
    }
  });
}

export async function selectPathway(pathwayId: string) {
  const pathway = getPathway(pathwayId);
  if (!pathway) throw new Error("未知途径");
  const now = nowIso();
  await db.transaction("rw", [db.profile, db.sequenceState, db.realityRequirements, db.achievements], async () => {
    await db.profile.update("me", { title: pathway.sequences[0].name, updatedAt: now });
    await db.sequenceState.put({ id: "active", pathwayId, sequence: 9, digestion: 0, stage: "formula", createdAt: now, updatedAt: now });
    await db.realityRequirements.where("pathwayId").equals(pathwayId).delete();
    await db.realityRequirements.bulkAdd(initialRealityRequirements(pathwayId, 9));
    await db.achievements.update("path-chosen", { unlockedAt: now });
  });
  // 选择途径后立即解锁该序列技能（幂等）
  await unlockCurrentSequenceSkill();
}
export async function setRealityRequirement(id: string, completed: boolean) {
  await db.realityRequirements.update(id, { completed, updatedAt: nowIso() });
}

export async function addRealityRequirement(input: Pick<RealityRequirement, "pathwayId" | "sequence" | "kind" | "title" | "description">) {
  const now = nowIso();
  await db.realityRequirements.add({ id: uid(), ...input, completed: false, createdAt: now, updatedAt: now });
}

export async function advanceSequence(): Promise<{ sequence: SequenceRank; name: string }> {
  return db.transaction("rw", [db.sequenceState, db.settings, db.profile, db.realityRequirements, db.xpEvents, db.achievements], async () => {
    const state = await db.sequenceState.get("active");
    const settings = await db.settings.get("app");
    const profile = await db.profile.get("me");
    if (!state || !settings || !profile || !state.pathwayId) throw new Error("尚未选择途径");
    const cap = calculateDigestionCap(state.sequence, settings);
    if (state.digestion < cap) throw new Error("魔药尚未完全消化");
    const next = nextSequence(state.sequence);
    if (next === null) throw new Error("已到达序列 0");
    if (requiresRitual(next)) {
      const ritual = await db.realityRequirements.where("[pathwayId+sequence]").equals([state.pathwayId, state.sequence]).filter((item) => item.kind === "ritual").first();
      if (ritual && !ritual.completed) throw new Error("晋升仪式尚未完成");
    }
    const sequence = getSequence(state.pathwayId, next);
    const pathway = getPathway(state.pathwayId);
    if (!sequence || !pathway) throw new Error("序列资料不存在");
    const now = nowIso();
    await db.sequenceState.update("active", { sequence: next, digestion: 0, stage: "formula", updatedAt: now });
    await db.profile.update("me", { title: sequence.name, updatedAt: now });
    await db.realityRequirements.bulkAdd(initialRealityRequirements(state.pathwayId, next));
    await db.xpEvents.add({ id: uid(), kind: "promotion", sourceId: sequence.id, amount: 0, digestion: 0, attributeAllocations: {}, reason: "晋升至序列 " + next + "·" + sequence.name, createdAt: now, reversesEventId: null });
    await db.achievements.update("sequence-8", { unlockedAt: now });
    return { sequence: next, name: sequence.name };
  });
  // 晋升后解锁新序列的技能（幂等）
  await unlockCurrentSequenceSkill();
}

export async function applyLossOfControl(note = "用户确认失控结算"): Promise<{ reason: string; sequence: SequenceRank }> {
  return db.transaction("rw", [db.settings, db.sequenceState, db.stabilityEvents, db.xpEvents, db.profile], async () => {
    const state = await db.sequenceState.get("active");
    const settings = await db.settings.get("app");
    const profile = await db.profile.get("me");
    if (!state || !settings || !profile) throw new Error("核心数据不存在");
    const average = calculateStatusAverage(settings.status);
    if (average >= 15) throw new Error("当前稳定度尚未达到失控阈值");
    const now = nowIso();
    let nextSequenceValue: SequenceRank = state.sequence;
    let nextDigestion = Math.floor(state.digestion * 0.75);
    let reason = "失控：损失 25% 当前消化度";
    const cap = calculateDigestionCap(state.sequence, settings);
    if (state.digestion < cap * 0.25) {
      const previous = previousSequence(state.sequence);
      if (previous !== null) {
        nextSequenceValue = previous;
        nextDigestion = Math.floor(calculateDigestionCap(previous, settings) * 0.5);
        reason = "失控：跌落至序列 " + previous;
      }
    }
    await db.sequenceState.update("active", { sequence: nextSequenceValue, digestion: nextDigestion, updatedAt: now });
    await db.xpEvents.add({ id: uid(), kind: "loss", sourceId: "loss-of-control", amount: 0, digestion: nextDigestion - state.digestion, attributeAllocations: {}, reason, createdAt: now, reversesEventId: null });
    await db.stabilityEvents.add({ id: uid(), average, ...settings.status, eventType: "loss_of_control", note, createdAt: now });
    await db.profile.update("me", { updatedAt: now });
    return { reason, sequence: nextSequenceValue };
  });
}

export async function transferPathway(toPathwayId: string): Promise<NonNullable<ReturnType<typeof getPathway>>> {
  return db.transaction("rw", [db.sequenceState, db.profile, db.pathwayTransfers, db.realityRequirements, db.xpEvents], async () => {
    const state = await db.sequenceState.get("active");
    if (!state?.pathwayId) throw new Error("尚未选择途径");
    if (![4, 3].includes(state.sequence)) throw new Error("只有序列 4 或 3 可以安全转途");
    const current = getPathway(state.pathwayId);
    const target = getPathway(toPathwayId);
    if (!current || !target || !current.adjacentIds.includes(toPathwayId)) throw new Error("目标不是相邻途径");
    const now = nowIso();
    await db.sequenceState.update("active", { pathwayId: toPathwayId, digestion: 0, stage: "formula", updatedAt: now });
    await db.profile.update("me", { title: getSequence(toPathwayId, state.sequence)?.name ?? target.name, updatedAt: now });
    await db.pathwayTransfers.add({ id: uid(), fromPathwayId: state.pathwayId, toPathwayId, sequence: state.sequence, createdAt: now });
    await db.realityRequirements.bulkAdd(initialRealityRequirements(toPathwayId, state.sequence));
    await db.xpEvents.add({ id: uid(), kind: "transfer", sourceId: toPathwayId, amount: 0, digestion: 0, attributeAllocations: {}, reason: current.name + " → " + target.name, createdAt: now, reversesEventId: null });
    return target;
  });
}

export async function checkInStatus(values: Settings["status"], note = "每日状态记录") {
  const now = nowIso();
  const settings = await db.settings.get("app");
  if (!settings) throw new Error("设置不存在");
  const average = Math.round((values.san + values.energy + values.focus + values.motivation) / 4);
  await db.transaction("rw", [db.settings, db.stabilityEvents], async () => {
    await db.settings.update("app", { status: values, updatedAt: now });
    await db.stabilityEvents.add({ id: uid(), average, ...values, eventType: "checkin", note, createdAt: now });
  });
  return average;
}

export async function createHabit(title: string, description: string, actingFit: ActingFit) {
  const now = nowIso();
  const habit: Habit = { id: uid(), title, description, frequency: "daily", targetPerWeek: 7, actingFit, graceDays: 1, active: true, createdAt: now, updatedAt: now };
  await db.habits.add(habit);
  return habit;
}

export async function logHabit(habitId: string, status: HabitLog["status"], localDate: string) {
  const existing = await db.habitLogs.where("[habitId+localDate]").equals([habitId, localDate]).first();
  if (existing) {
    await db.habitLogs.update(existing.id, { status, createdAt: nowIso() });
    return;
  }
  await db.habitLogs.add({ id: uid(), habitId, localDate, status, note: "", createdAt: nowIso() });
}

export function createDefaultPersonalProfile(): PersonalProfile {
  const now = nowIso();
  return {
    id: "me", summary: "", interests: [], preferredDomains: [], avoidedTasks: [], goals: [], constraints: [],
    weekdayMinutes: 45, weekendMinutes: 90, preferredTime: "flexible", energyPattern: "variable",
    environment: ["home"], equipment: [], socialPreference: "solo", difficultyPreference: 3,
    consentVersion: 0, updatedAt: now,
  };
}

export async function savePersonalProfile(profile: PersonalProfile) {
  const existing = await db.personalProfile.get("me");
  const next = { ...profile, id: "me" as const, updatedAt: nowIso() };
  await db.personalProfile.put(next);
  if (!existing || existing.consentVersion !== next.consentVersion) {
    await db.aiRequestLogs.add({ id: uid(), provider: "local", protocol: "consent", model: "none", endpoint: "local", contextHash: "", contextPreview: "生活画像授权版本 " + next.consentVersion, status: "success", error: "", createdAt: nowIso() });
  }
  return next;
}

export async function getAdventureEvent(id: string) {
  return db.adventureEvents.get(id);
}

export async function getAdventureEventForDate(localDate: string, kind: AdventureEvent["kind"]) {
  return db.adventureEvents.where("[localDate+kind]").equals([localDate, kind]).first();
}

export async function saveAdventureEvent(event: AdventureEvent) {
  return db.transaction("rw", [db.adventureEvents, db.storyThreads, db.worldStates, db.storyCheckpoints], async () => {
    const threadId = event.threadId ?? uid();
    const thread: StoryThread = { id: threadId, eventId: event.id, title: event.title, parentCheckpointId: null, currentTurnId: null, providerResponseId: null, provider: event.provider, model: event.model, status: "active", canonDivergent: false, createdAt: event.createdAt, updatedAt: nowIso() };
    const nextEvent: AdventureEvent = { ...event, threadId };
    await db.adventureEvents.put(nextEvent);
    await db.storyThreads.put(thread);
    await db.worldStates.put(createInitialWorldStateForRepository(threadId));
    await db.storyCheckpoints.put({ id: uid(), threadId, turnId: null, label: "章节开始", automatic: true, worldState: createInitialWorldStateForRepository(threadId), flags: [], actors: [], items: [], summary: event.opening, providerResponseId: null, createdAt: nowIso() });
    return nextEvent;
  });
}

export async function getStoryContext(threadId: string) {
  const [thread, worldState, allFlags, allActors, items, turns, summaries, checkpoints] = await Promise.all([
    db.storyThreads.get(threadId), db.worldStates.get(threadId), db.storyFlags.toArray(), db.storyActors.toArray(), db.storyItems.where("threadId").equals(threadId).toArray(), db.storyTurns.where("threadId").equals(threadId).reverse().sortBy("createdAt"), db.storySummaries.where("threadId").equals(threadId).reverse().sortBy("createdAt"), db.storyCheckpoints.where("threadId").equals(threadId).reverse().sortBy("createdAt"),
  ]);
  const flags = allFlags.filter((flag) => !flag.threadId || flag.threadId === threadId);
  const actors = allActors.filter((actor) => !actor.threadId || actor.threadId === threadId);
  return { thread, worldState, flags, actors, items, turns, summaries, checkpoints };
}

export async function createStoryCheckpoint(input: { threadId: string; turnId: string | null; label: string; automatic?: boolean }) {
  const context = await getStoryContext(input.threadId);
  if (!context.worldState) throw new Error("时间线不存在");
  const checkpoint: StoryCheckpoint = { id: uid(), threadId: input.threadId, turnId: input.turnId, label: input.label.slice(0, 80), automatic: input.automatic ?? false, worldState: structuredClone(context.worldState), flags: structuredClone(context.flags), actors: structuredClone(context.actors), items: structuredClone(context.items), summary: context.summaries[0]?.text ?? context.worldState.summary, providerResponseId: context.thread?.providerResponseId ?? null, createdAt: nowIso() };
  await db.storyCheckpoints.put(checkpoint);
  return checkpoint;
}

export async function commitStoryTurn(input: { turn: StoryTurn; worldState: WorldState; flags: StoryFlag[]; actors: StoryActor[]; items: StoryItem[] }) {
  return db.transaction("rw", [db.storyTurns, db.storyThreads, db.worldStates, db.storyFlags, db.storyActors, db.storyItems, db.adventureEvents], async () => {
    await db.storyTurns.put(input.turn);
    await db.worldStates.put(input.worldState);
    await db.storyFlags.bulkPut(input.flags);
    await db.storyActors.bulkPut(input.actors);
    await db.storyItems.bulkPut(input.items);
    await db.storyThreads.update(input.turn.threadId, { currentTurnId: input.turn.id, providerResponseId: input.turn.providerResponseId, provider: input.turn.provider, model: input.turn.model, canonDivergent: input.worldState.canonDivergence.length > 0, updatedAt: nowIso() });
    const thread = await db.storyThreads.get(input.turn.threadId);
    if (thread) {
      const event = await db.adventureEvents.get(thread.eventId);
      if (event) {
        const proposals = [...event.proposals];
        for (const operation of input.turn.operations) if (operation.type === "add_task_proposal") proposals.push(operation.proposal);
        await db.adventureEvents.put({ ...event, currentTurnId: input.turn.id, proposals });
      }
    }
    return input.turn;
  });
}

export async function saveStorySummary(summary: StorySummary) {
  await db.storySummaries.put(summary);
  await db.worldStates.update(summary.threadId, { summary: summary.text, updatedAt: nowIso() });
}

export async function branchFromCheckpoint(checkpointId: string) {
  return db.transaction("rw", [db.storyCheckpoints, db.storyThreads, db.worldStates, db.storyItems, db.storyFlags, db.storyActors, db.adventureEvents], async () => {
    const checkpoint = await db.storyCheckpoints.get(checkpointId);
    if (!checkpoint) throw new Error("存档点不存在");
    const oldThread = await db.storyThreads.get(checkpoint.threadId);
    if (!oldThread) throw new Error("原时间线不存在");
    const threadId = uid();
    const now = nowIso();
    const thread: StoryThread = { ...oldThread, id: threadId, parentCheckpointId: checkpoint.id, currentTurnId: null, providerResponseId: checkpoint.providerResponseId, status: "active", createdAt: now, updatedAt: now };
    const worldState = { ...structuredClone(checkpoint.worldState), id: threadId, threadId, updatedAt: now };
    const items = checkpoint.items.map((item) => ({ ...item, id: uid(), threadId }));
    const flags = checkpoint.flags.map((flag) => ({ ...flag, id: uid(), threadId }));
    const actors = checkpoint.actors.map((actor) => ({ ...actor, id: uid(), threadId }));
    await db.storyThreads.update(oldThread.id, { status: "archived", updatedAt: now });
    await db.storyThreads.put(thread);
    await db.worldStates.put(worldState);
    await db.storyItems.bulkPut(items);
    await db.storyFlags.bulkPut(flags);
    await db.storyActors.bulkPut(actors);
    await db.adventureEvents.update(oldThread.eventId, { threadId, currentTurnId: undefined });
    return thread;
  });
}

function createInitialWorldStateForRepository(threadId: string): WorldState {
  const now = nowIso();
  return { id: threadId, threadId, chapter: 1, timeLabel: "灰雾之上的清晨", location: "现实与灵界交界处", knownFacts: [], openThreads: [], canonDivergence: [], threatLevel: 0, protagonistState: "alive", summary: "", updatedAt: now };
}


export async function resolveAdventureChoice(eventId: string, choiceId: string): Promise<AdventureEvent> {
  return db.transaction("rw", [db.adventureEvents, db.storyFlags], async () => {
    const event = await db.adventureEvents.get(eventId);
    if (!event) throw new Error("事件不存在");
    if (event.chosenChoiceId) throw new Error("事件已经作出选择");
    const choice = event.choices.find((item) => item.id === choiceId);
    if (!choice) throw new Error("选择不存在");
    const now = nowIso();
    for (const [key, delta] of Object.entries(choice.effects.flags)) {
      const existing = await db.storyFlags.where("key").equals(key).first();
      const value = clamp((existing?.value ?? 0) + delta, -100, 100);
      await db.storyFlags.put(existing ? { ...existing, value, updatedAt: now } : {
        id: uid(), threadId: event.threadId, key, value, label: key, description: "由剧情选择改变的长期倾向", updatedAt: now,
      });
    }
    const proposals = event.proposals.map((proposal) => ({
      ...proposal,
      proposalStatus: choice.proposalIds.includes(proposal.id) ? "pending" as const : "rejected" as const,
      sourceChoiceId: choice.proposalIds.includes(proposal.id) ? choice.id : proposal.sourceChoiceId,
    }));
    const next: AdventureEvent = { ...event, status: "resolved", chosenChoiceId: choice.id, proposals, resolvedAt: now };
    await db.adventureEvents.put(next);
    return next;
  });
}

export async function acceptTaskProposal(eventId: string, proposalId: string): Promise<Quest> {
  return db.transaction("rw", [db.quests, db.adventureEvents], async () => {
    const event = await db.adventureEvents.get(eventId);
    const proposal = event?.proposals.find((item) => item.id === proposalId);
    if (!event || !proposal) throw new Error("任务提案不存在");
    if (proposal.proposalStatus === "accepted") {
      const existing = await db.quests.where("originEventId").equals(eventId).filter((quest) => quest.branchChoiceId === proposal.id).first();
      if (existing) return existing;
    }
    const now = nowIso();
    const quest: Quest = {
      id: uid(), title: proposal.title, description: proposal.realityAction, status: "inbox", type: proposal.type,
      difficulty: proposal.difficulty, priority: proposal.priority, estimatedMinutes: proposal.estimatedMinutes, dueAt: null,
      xpOverride: null, actingFit: proposal.actingFit, attributeIds: proposal.attributeIds, tags: proposal.tags, notes: proposal.safetyNotes.join("；"),
      narrativeTitle: proposal.narrativeTitle, narrativeDescription: proposal.narrativeDescription, realityAction: proposal.realityAction,
      successCriteria: proposal.successCriteria, originEventId: eventId, branchChoiceId: proposal.id, storyTags: proposal.tags,
      createdAt: now, updatedAt: now, completedAt: null,
    };
    await db.quests.add(quest);
    const proposals = event.proposals.map((item) => item.id === proposalId ? { ...item, proposalStatus: "accepted" as const } : item);
    await db.adventureEvents.put({ ...event, proposals });
    return quest;
  });
}

export async function rejectTaskProposal(eventId: string, proposalId: string) {
  const event = await db.adventureEvents.get(eventId);
  if (!event) return;
  await db.adventureEvents.put({ ...event, proposals: event.proposals.map((item) => item.id === proposalId ? { ...item, proposalStatus: "rejected" } : item) });
}

export async function updateTaskProposal(eventId: string, proposalId: string, patch: Partial<Pick<TaskProposal, "realityAction" | "successCriteria" | "estimatedMinutes" | "difficulty" | "priority">>) {
  const event = await db.adventureEvents.get(eventId);
  if (!event) throw new Error("事件不存在");
  const proposals = event.proposals.map((item) => item.id === proposalId ? { ...item, ...patch, title: patch.realityAction ?? item.title } : item);
  await db.adventureEvents.put({ ...event, proposals });
}

export async function recordAIRequest(log: AIRequestLog) {
  await db.aiRequestLogs.add(log);
}

export async function saveSceneAsset(asset: SceneAsset) {
  await db.sceneAssets.put(asset);
  await db.adventureEvents.update(asset.eventId, { imageAssetId: asset.id });
}
export async function exportBackup() {
  const [profile, sequenceState, settings, attributes, quests, completions, xpEvents, habits, habitLogs, realityRequirements, stabilityEvents, achievements, items, pathwayTransfers, personalProfile, adventureEvents, storyFlags, storyActors, sceneAssets, aiRequestLogs, storyThreads, storyTurns, storyCheckpoints, worldStates, storyItems, storySummaries, wheelCategories, wheelOptions, fateProfiles, wheelSpins, characterBackgrounds, skills, skillEvents, formulas] = await Promise.all([
    db.profile.get("me"), db.sequenceState.get("active"), db.settings.get("app"), db.attributes.toArray(), db.quests.toArray(), db.completions.toArray(), db.xpEvents.toArray(), db.habits.toArray(), db.habitLogs.toArray(), db.realityRequirements.toArray(), db.stabilityEvents.toArray(), db.achievements.toArray(), db.items.toArray(), db.pathwayTransfers.toArray(), db.personalProfile.get("me"), db.adventureEvents.toArray(), db.storyFlags.toArray(), db.storyActors.toArray(), db.sceneAssets.toArray(), db.aiRequestLogs.toArray(), db.storyThreads.toArray(), db.storyTurns.toArray(), db.storyCheckpoints.toArray(), db.worldStates.toArray(), db.storyItems.toArray(), db.storySummaries.toArray(), db.wheelCategories.toArray(), db.wheelOptions.toArray(), db.fateProfiles.toArray(), db.wheelSpins.toArray(), db.characterBackgrounds.toArray(), db.skills.toArray(), db.skillEvents.toArray(), db.formulas.toArray(),
  ]);
  if (!profile || !sequenceState || !settings) throw new Error("核心数据不存在");
  return buildBackup({ profile, sequenceState, settings, attributes, quests, completions, xpEvents, habits, habitLogs, realityRequirements, stabilityEvents, achievements, items, pathwayTransfers, personalProfile: personalProfile ?? createDefaultPersonalProfile(), adventureEvents, storyFlags, storyActors, sceneAssets, aiRequestLogs, storyThreads, storyTurns, storyCheckpoints, worldStates, storyItems, storySummaries, wheelCategories, wheelOptions, fateProfiles, wheelSpins, characterBackgrounds, skills, skillEvents, formulas });
}

export async function importBackup(snapshot: ImportableBackup) {
  if (![1, 2, 3, 4, 5, 6, 7].includes(snapshot.schemaVersion)) throw new Error("不支持的备份版本");
  const personalProfile = snapshot.schemaVersion === 2 || snapshot.schemaVersion === 3 ? snapshot.personalProfile : createDefaultPersonalProfile();
  const adventureEvents = snapshot.schemaVersion === 2 || snapshot.schemaVersion === 3 ? snapshot.adventureEvents : [];
  const storyFlags = snapshot.schemaVersion === 2 || snapshot.schemaVersion === 3 ? snapshot.storyFlags : [];
  const storyActors = snapshot.schemaVersion === 2 || snapshot.schemaVersion === 3 ? snapshot.storyActors : [];
  const sceneAssets = snapshot.schemaVersion === 2 || snapshot.schemaVersion === 3 ? snapshot.sceneAssets : [];
  const aiRequestLogs = snapshot.schemaVersion === 2 || snapshot.schemaVersion === 3 ? snapshot.aiRequestLogs : [];
  const storyThreads = snapshot.schemaVersion === 3 || snapshot.schemaVersion === 4 || snapshot.schemaVersion === 5 || snapshot.schemaVersion === 6 ? snapshot.storyThreads : [];
  const storyTurns = snapshot.schemaVersion === 3 || snapshot.schemaVersion === 4 || snapshot.schemaVersion === 5 || snapshot.schemaVersion === 6 ? snapshot.storyTurns : [];
  const storyCheckpoints = snapshot.schemaVersion === 3 || snapshot.schemaVersion === 4 || snapshot.schemaVersion === 5 || snapshot.schemaVersion === 6 ? snapshot.storyCheckpoints : [];
  const worldStates = snapshot.schemaVersion === 3 || snapshot.schemaVersion === 4 || snapshot.schemaVersion === 5 || snapshot.schemaVersion === 6 ? snapshot.worldStates : [];
  const storyItems = snapshot.schemaVersion === 3 || snapshot.schemaVersion === 4 || snapshot.schemaVersion === 5 || snapshot.schemaVersion === 6 ? snapshot.storyItems : [];
  const storySummaries = snapshot.schemaVersion === 3 || snapshot.schemaVersion === 4 || snapshot.schemaVersion === 5 || snapshot.schemaVersion === 6 ? snapshot.storySummaries : [];
  const wheelCategories = (snapshot.schemaVersion === 4 || snapshot.schemaVersion === 5 || snapshot.schemaVersion === 6 || snapshot.schemaVersion === 7) ? snapshot.wheelCategories ?? [] : [];
  const wheelOptions = (snapshot.schemaVersion === 4 || snapshot.schemaVersion === 5 || snapshot.schemaVersion === 6 || snapshot.schemaVersion === 7) ? snapshot.wheelOptions ?? [] : [];
  const fateProfiles = (snapshot.schemaVersion === 4 || snapshot.schemaVersion === 5 || snapshot.schemaVersion === 6 || snapshot.schemaVersion === 7) ? snapshot.fateProfiles ?? [] : [];
  const wheelSpins = (snapshot.schemaVersion === 4 || snapshot.schemaVersion === 5 || snapshot.schemaVersion === 6 || snapshot.schemaVersion === 7) ? snapshot.wheelSpins ?? [] : [];
  const characterBackgrounds = (snapshot.schemaVersion === 5 || snapshot.schemaVersion === 6 || snapshot.schemaVersion === 7) ? snapshot.characterBackgrounds ?? [] : [];
  const skills = snapshot.schemaVersion === 6 || snapshot.schemaVersion === 7 ? snapshot.skills ?? [] : [];
  const skillEvents = snapshot.schemaVersion === 6 || snapshot.schemaVersion === 7 ? snapshot.skillEvents ?? [] : [];
  const formulas = snapshot.schemaVersion === 7 ? snapshot.formulas ?? [] : [];
  await db.transaction("rw", [db.profile, db.sequenceState, db.settings, db.attributes, db.quests, db.completions, db.xpEvents, db.habits, db.habitLogs, db.realityRequirements, db.stabilityEvents, db.achievements, db.items, db.pathwayTransfers, db.personalProfile, db.adventureEvents, db.storyFlags, db.storyActors, db.sceneAssets, db.aiRequestLogs, db.storyThreads, db.storyTurns, db.storyCheckpoints, db.worldStates, db.storyItems, db.storySummaries, db.wheelCategories, db.wheelOptions, db.fateProfiles, db.wheelSpins, db.characterBackgrounds, db.skills, db.skillEvents, db.formulas], async () => {
    await Promise.all([db.profile.clear(), db.sequenceState.clear(), db.settings.clear(), db.attributes.clear(), db.quests.clear(), db.completions.clear(), db.xpEvents.clear(), db.habits.clear(), db.habitLogs.clear(), db.realityRequirements.clear(), db.stabilityEvents.clear(), db.achievements.clear(), db.items.clear(), db.pathwayTransfers.clear(), db.personalProfile.clear(), db.adventureEvents.clear(), db.storyFlags.clear(), db.storyActors.clear(), db.sceneAssets.clear(), db.aiRequestLogs.clear(), db.storyThreads.clear(), db.storyTurns.clear(), db.storyCheckpoints.clear(), db.worldStates.clear(), db.storyItems.clear(), db.storySummaries.clear(), db.wheelCategories.clear(), db.wheelOptions.clear(), db.fateProfiles.clear(), db.wheelSpins.clear(), db.characterBackgrounds.clear(), db.skills.clear(), db.skillEvents.clear(), db.formulas.clear()]);
    await Promise.all([
      db.profile.put(snapshot.profile), db.sequenceState.put(snapshot.sequenceState), db.settings.put(snapshot.settings), db.attributes.bulkPut(snapshot.attributes), db.quests.bulkPut(snapshot.quests), db.completions.bulkPut(snapshot.completions), db.xpEvents.bulkPut(snapshot.xpEvents), db.habits.bulkPut(snapshot.habits), db.habitLogs.bulkPut(snapshot.habitLogs), db.realityRequirements.bulkPut(snapshot.realityRequirements), db.stabilityEvents.bulkPut(snapshot.stabilityEvents), db.achievements.bulkPut(snapshot.achievements), db.items.bulkPut(snapshot.items), db.pathwayTransfers.bulkPut(snapshot.pathwayTransfers), db.personalProfile.put(personalProfile), db.adventureEvents.bulkPut(adventureEvents), db.storyFlags.bulkPut(storyFlags), db.storyActors.bulkPut(storyActors), db.sceneAssets.bulkPut(sceneAssets), db.aiRequestLogs.bulkPut(aiRequestLogs), db.storyThreads.bulkPut(storyThreads), db.storyTurns.bulkPut(storyTurns), db.storyCheckpoints.bulkPut(storyCheckpoints), db.worldStates.bulkPut(worldStates), db.storyItems.bulkPut(storyItems), db.storySummaries.bulkPut(storySummaries), db.wheelCategories.bulkPut(wheelCategories), db.wheelOptions.bulkPut(wheelOptions), db.fateProfiles.bulkPut(fateProfiles), db.wheelSpins.bulkPut(wheelSpins), db.characterBackgrounds.bulkPut(characterBackgrounds), db.skills.bulkPut(skills), db.skillEvents.bulkPut(skillEvents), db.formulas.bulkPut(formulas),
    ]);
  });
}
function csvEscape(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? '"' + text.replaceAll('"', '""') + '"' : text;
}

export async function exportQuestsCsv() {
  const quests = await db.quests.toArray();
  const headers = ["title", "description", "status", "type", "difficulty", "priority", "estimatedMinutes", "actingFit", "dueAt", "tags"];
  return [headers.join(","), ...quests.map((quest) => headers.map((key) => csvEscape(key === "tags" ? quest.tags.join("|") : quest[key as keyof Quest])).join(","))].join("\n");
}

export async function importQuestsCsv(text: string) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return 0;
  const headers = lines[0].split(",").map((item) => item.trim());
  const rows = lines.slice(1);
  for (const row of rows) {
    const values = row.match(/(".*?"|[^,]+)(?=,|$)/g)?.map((value) => value.replace(/^"|"$/g, "").replaceAll('""', '"')) ?? [];
    const record = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
    if (!record.title) continue;
    await createQuest({
      title: record.title, description: record.description ?? "", status: (record.status || "inbox") as Quest["status"],
      type: (record.type || "side") as Quest["type"], difficulty: Number(record.difficulty || 3) as Quest["difficulty"],
      priority: Number(record.priority || 2) as Quest["priority"], estimatedMinutes: Number(record.estimatedMinutes || 30),
      dueAt: record.dueAt || null, xpOverride: null, actingFit: Number(record.actingFit || 1) as ActingFit,
      attributeIds: ["execution"], tags: record.tags ? record.tags.split("|") : [], notes: "",
    });
  }
  return rows.length;
}

export async function clearDatabase() {
  await db.delete();
}















// ---------------------------------------------------------------------------
// 命运转盘（Fate Wheel）
// ---------------------------------------------------------------------------

export interface WheelCategoryDraft {
  label: string;
  description: string;
  order: number;
  taskAffinityAllowed: boolean;
}

export interface WheelOptionDraft {
  categoryId: string;
  label: string;
  description: string;
  order: number;
  enabled: boolean;
  pool: WheelOption["pool"];
  taskAffinity: boolean;
}

export async function createWheelCategory(draft: WheelCategoryDraft) {
  const now = nowIso();
  const category: WheelCategory = {
    id: uid(),
    label: draft.label.trim() || "未命名类别",
    description: draft.description,
    order: draft.order,
    builtIn: false,
    gate: false,
    taskAffinityAllowed: draft.taskAffinityAllowed,
    sourceKind: "authored",
    sourceNote: "自建类别",
    createdAt: now,
    updatedAt: now,
  };
  await db.wheelCategories.add(category);
  return category;
}

export async function updateWheelCategory(id: string, patch: Partial<WheelCategoryDraft>) {
  await db.wheelCategories.update(id, { ...patch, updatedAt: nowIso() });
}

export async function deleteWheelCategory(id: string) {
  await db.transaction("rw", [db.wheelCategories, db.wheelOptions], async () => {
    await db.wheelOptions.where("categoryId").equals(id).delete();
    await db.wheelCategories.delete(id);
  });
}

export async function createWheelOption(draft: WheelOptionDraft) {
  const now = nowIso();
  const option: WheelOption = {
    id: uid(),
    categoryId: draft.categoryId,
    label: draft.label.trim() || "未命名扇区",
    description: draft.description,
    order: draft.order,
    enabled: draft.enabled,
    pool: draft.pool,
    unlocks: [],
    taskAffinity: draft.taskAffinity,
    sourceKind: "authored",
    sourceNote: "自建扇区",
    citations: [],
    builtIn: false,
    createdAt: now,
    updatedAt: now,
  };
  await db.wheelOptions.add(option);
  return option;
}

export async function updateWheelOption(id: string, patch: Partial<WheelOptionDraft>) {
  await db.wheelOptions.update(id, { ...patch, updatedAt: nowIso() });
}

export async function deleteWheelOption(id: string) {
  await db.wheelOptions.delete(id);
}

/**
 * Draws one option for a category using the pools unlocked so far in the draft,
 * and always writes an auditable spin record (raw bytes + pool snapshot).
 */
export async function recordWheelSpin(input: { categoryId: string; unlockedPools: SpecialPool[]; era?: string | null; parent?: string | null; allowNonCanon?: boolean }): Promise<{ option: WheelOption; category: WheelCategory; spin: WheelSpin }> {
  const category = await db.wheelCategories.get(input.categoryId);
  if (!category) throw new Error("类别不存在");
  const [options, priorSpins] = await Promise.all([db.wheelOptions.toArray(), db.wheelSpins.toArray()]);
  const pool = resolvePool(options, input.categoryId, input.unlockedPools, { era: input.era ?? null, parent: input.parent ?? null, allowNonCanon: input.allowNonCanon });
  if (pool.length === 0) throw new Error("该类别当前没有可用扇区");
  const outcome = spinPool(pool);
  const createdAt = nowIso();
  const respinIndex = respinIndexFor(priorSpins, input.categoryId);
  const spin = makeSpinRecord({
    id: uid(),
    fateProfileId: null,
    category,
    outcome,
    isRespin: respinIndex > 0,
    respinIndex,
    createdAt,
  });
  await db.wheelSpins.add(spin);
  return { option: outcome.option, category, spin };
}

export async function getActiveFateProfile(): Promise<FateProfile | null> {
  const active = await db.fateProfiles.where("status").equals("active").toArray();
  if (active.length === 0) return null;
  return active.sort((a, b) => b.spunAt.localeCompare(a.spunAt))[0];
}

export async function listFateProfiles(): Promise<FateProfile[]> {
  const all = await db.fateProfiles.toArray();
  return all.sort((a, b) => b.spunAt.localeCompare(a.spunAt));
}

export async function listWheelSpins(): Promise<WheelSpin[]> {
  const all = await db.wheelSpins.toArray();
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Saves a draft as the new active fate profile. The previous active profile is
 * superseded (kept for history) inside the same transaction, and the latest spin
 * of each category is linked to the new profile.
 */
export async function saveFateProfile(input: { selections: FateAttribute[]; note: string; name?: string }): Promise<FateProfile> {
  const profileId = uid();
  const now = nowIso();
  const profile = buildFateProfile({
    id: profileId,
    name: input.name,
    attributes: input.selections,
    unlockedPools: unlockedPoolsFromAttributes(input.selections),
    note: input.note,
    spunAt: now,
  });
  await db.transaction("rw", [db.fateProfiles, db.wheelSpins], async () => {
    const activeProfiles = await db.fateProfiles.where("status").equals("active").toArray();
    for (const previous of activeProfiles) {
      await db.fateProfiles.update(previous.id, { status: "superseded", supersededAt: now });
    }
    await db.fateProfiles.add(profile);
    const spins = await db.wheelSpins.toArray();
    const latestByCategory = new Map<string, WheelSpin>();
    for (const spin of spins.sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
      latestByCategory.set(spin.categoryId, spin);
    }
    for (const attribute of input.selections) {
      const spin = latestByCategory.get(attribute.categoryId);
      if (spin) await db.wheelSpins.update(spin.id, { fateProfileId: profileId });
    }
  });
  return profile;
}

export async function clearFateProfile(): Promise<void> {
  const now = nowIso();
  await db.transaction("rw", [db.fateProfiles], async () => {
    const activeProfiles = await db.fateProfiles.where("status").equals("active").toArray();
    for (const profile of activeProfiles) {
      await db.fateProfiles.update(profile.id, { status: "superseded", supersededAt: now });
    }
  });
}

/** Builds the full draft in gate-first order, used by 一键抽整套命运. */
export async function spinAllCategories(): Promise<Array<{ category: WheelCategory; option: WheelOption; spin: WheelSpin }>> {
  const [categoriesRaw, settings] = await Promise.all([db.wheelCategories.toArray(), db.settings.get("app")]);
  const categories = orderCategoriesForSpin(categoriesRaw);
  const allowNonCanon = settings?.allowNonCanonGeo !== false;
  const results: Array<{ category: WheelCategory; option: WheelOption; spin: WheelSpin }> = [];
  const attributes: FateAttribute[] = [];
  for (const category of categories) {
    const unlockedPools = unlockedPoolsFromAttributes(attributes);
    // 层级上下文：年代约束大地点，大地点约束小地点，阵营约束代号。
    const era = attributes.find((attribute) => attribute.categoryId === "era")?.optionLabel ?? null;
    const parent = category.id === "locality"
      ? attributes.find((attribute) => attribute.categoryId === "region")?.optionLabel ?? null
      : category.id === "codename"
        ? attributes.find((attribute) => attribute.categoryId === "faction")?.optionLabel ?? null
        : null;
    // 该纪元可能没有这个类别的资料（如第一纪没有当代教会）——跳过而不是报错。
    const available = resolvePool(await db.wheelOptions.toArray(), category.id, unlockedPools, { era, parent, allowNonCanon });
    if (available.length === 0) continue;
    const { option, spin } = await recordWheelSpin({ categoryId: category.id, unlockedPools, era, parent, allowNonCanon });
    attributes.push(attributeFromOption(category, option));
    results.push({ category, option, spin });
  }
  return results;
}



// ---------------------------------------------------------------------------
// 人物档案（Character Background）
// ---------------------------------------------------------------------------

export async function getActiveCharacterBackground(): Promise<CharacterBackground | null> {
  const active = await db.characterBackgrounds.where("status").equals("active").toArray();
  if (active.length === 0) return null;
  return active.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

export async function listCharacterBackgrounds(): Promise<CharacterBackground[]> {
  const all = await db.characterBackgrounds.toArray();
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Saves a background as the new active version. The previous active background is
 * superseded (kept as 前史) in the same transaction, so started chapters are unaffected.
 */
export async function saveCharacterBackground(input: {
  fields: BackgroundFields;
  backgroundText: string;
  fateProfileId: string | null;
  provider: string;
  model: string;
}): Promise<CharacterBackground> {
  const now = nowIso();
  const background: CharacterBackground = {
    id: uid(),
    status: "active",
    fields: input.fields,
    backgroundText: input.backgroundText,
    fateProfileId: input.fateProfileId,
    seed: [input.fields.name, input.fields.occupation, input.fields.origin].filter(Boolean).join("·"),
    provider: input.provider,
    model: input.model,
    createdAt: now,
    supersededAt: null,
  };
  await db.transaction("rw", [db.characterBackgrounds], async () => {
    const active = await db.characterBackgrounds.where("status").equals("active").toArray();
    for (const previous of active) {
      await db.characterBackgrounds.update(previous.id, { status: "superseded", supersededAt: now });
    }
    await db.characterBackgrounds.add(background);
  });
  return background;
}

export async function updateActiveCharacterBackground(patch: { fields?: BackgroundFields; backgroundText?: string }): Promise<void> {
  const active = await getActiveCharacterBackground();
  if (!active) throw new Error("还没有人物档案");
  await db.characterBackgrounds.update(active.id, {
    ...(patch.fields ? { fields: patch.fields } : {}),
    ...(patch.backgroundText !== undefined ? { backgroundText: patch.backgroundText } : {}),
  });
}

export async function clearCharacterBackground(): Promise<void> {
  const now = nowIso();
  const active = await db.characterBackgrounds.where("status").equals("active").toArray();
  for (const background of active) {
    await db.characterBackgrounds.update(background.id, { status: "superseded", supersededAt: now });
  }
}

// ---------------------------------------------------------------------------
// 技能（Skill）
// ---------------------------------------------------------------------------

function skillRowFor(input: { pathwayId: string; sequence: number; now: string }): Skill {
  const ability = getSequenceAbility(input.pathwayId, input.sequence);
  const author = getAuthorAbility(input.pathwayId, input.sequence);
  const hasNovel = ability?.status === "canon";
  return {
    id: `skill-${input.pathwayId}-${input.sequence}`,
    pathwayId: input.pathwayId,
    sequence: input.sequence,
    name: ability?.skillName ?? `序列 ${input.sequence}`,
    status: author ? "author" : hasNovel ? "canon" : "undisclosed",
    authorText: author?.text ?? "",
    evidenceText: ability?.evidence[0]?.quote ?? "",
    citations: abilityCitations(ability),
    proficiency: 0,
    peakProficiency: 0,
    level: "入门",
    manual: false,
    unlockedAt: input.now,
    lastTrainedAt: input.now,
    decaySettledAt: input.now,
    updatedAt: input.now,
  };
}

export async function listSkills(): Promise<Skill[]> {
  const rows = await db.skills.toArray();
  return rows.sort((a, b) => {
    if ((a.sequence ?? 99) !== (b.sequence ?? 99)) return (a.sequence ?? 99) - (b.sequence ?? 99);
    return a.name.localeCompare(b.name, "zh-CN");
  });
}

/** Unlocks the skill of the sequence the character currently holds (idempotent). */
export async function unlockCurrentSequenceSkill(): Promise<Skill | null> {
  const state = await db.sequenceState.get("active");
  if (!state?.pathwayId) return null;
  const id = `skill-${state.pathwayId}-${state.sequence}`;
  const existing = await db.skills.get(id);
  if (existing) return existing;
  const now = nowIso();
  const skill = skillRowFor({ pathwayId: state.pathwayId, sequence: state.sequence, now });
  await db.transaction("rw", [db.skills, db.skillEvents], async () => {
    await db.skills.add(skill);
    const event: SkillEvent = { id: uid(), skillId: skill.id, kind: "grant", amount: 0, reason: `解锁序列 ${state.sequence} 技能`, sourceId: null, createdAt: now, reversesEventId: null };
    await db.skillEvents.add(event);
  });
  return skill;
}

export async function createManualSkill(input: { name: string; description: string }): Promise<Skill> {
  const now = nowIso();
  const name = input.name.trim().slice(0, 40) || "自建技能";
  const skill: Skill = {
    id: uid(),
    pathwayId: null,
    sequence: null,
    name,
    status: "manual",
    authorText: "",
    evidenceText: input.description.trim().slice(0, 400),
    citations: [],
    proficiency: 0,
    peakProficiency: 0,
    level: "入门",
    manual: true,
    unlockedAt: now,
    lastTrainedAt: now,
    decaySettledAt: now,
    updatedAt: now,
  };
  await db.transaction("rw", [db.skills, db.skillEvents], async () => {
    await db.skills.add(skill);
    await db.skillEvents.add({ id: uid(), skillId: skill.id, kind: "manual", amount: 0, reason: "新增自建技能", sourceId: null, createdAt: now, reversesEventId: null });
  });
  return skill;
}

export async function deleteManualSkill(skillId: string): Promise<void> {
  const skill = await db.skills.get(skillId);
  if (!skill?.manual) return;
  await db.transaction("rw", [db.skills, db.skillEvents], async () => {
    await db.skills.delete(skillId);
    await db.skillEvents.where("skillId").equals(skillId).delete();
  });
}

async function applyProficiency(skillId: string, amount: number, reason: string, sourceId: string | null, kind: SkillEvent["kind"]) {
  const skill = await db.skills.get(skillId);
  if (!skill) return null;
  const next = Math.max(0, Math.min(SKILL_MAX_PROFICIENCY, skill.proficiency + amount));
  const peak = Math.max(skill.peakProficiency, next);
  await db.skills.update(skillId, {
    proficiency: next,
    peakProficiency: peak,
    level: levelForProficiency(peak),
    lastTrainedAt: amount > 0 ? nowIso() : skill.lastTrainedAt,
    updatedAt: nowIso(),
  });
  const event: SkillEvent = { id: uid(), skillId, kind, amount, reason, sourceId, createdAt: nowIso(), reversesEventId: null };
  await db.skillEvents.add(event);
  return event;
}

/** Manual practice for user-created skills (pathway skills grow only from quests). */
export async function trainSkillManually(skillId: string, amount = 5): Promise<void> {
  const skill = await db.skills.get(skillId);
  if (!skill?.manual) throw new Error("只有自建技能可以手动练习");
  await db.transaction("rw", [db.skills, db.skillEvents], async () => {
    await applyProficiency(skillId, Math.max(1, Math.min(50, Math.round(amount))), "手动练习", null, "manual");
  });
}

/** Lazy, idempotent decay settlement. Returns how many skills actually decayed. */
export async function settleSkillDecay(): Promise<number> {
  const now = new Date();
  let decayed = 0;
  await db.transaction("rw", [db.skills, db.skillEvents], async () => {
    const rows = await db.skills.toArray();
    for (const skill of rows) {
      const result = settleDecay({
        proficiency: skill.proficiency,
        peakProficiency: skill.peakProficiency,
        level: skill.level,
        lastTrainedAt: skill.lastTrainedAt,
        decaySettledAt: skill.decaySettledAt,
        now,
      });
      if (result.decayed <= 0 && result.settledAt === skill.decaySettledAt) continue;
      await db.skills.update(skill.id, { proficiency: result.proficiency, level: levelForProficiency(skill.peakProficiency), decaySettledAt: result.settledAt, updatedAt: now.toISOString() });
      if (result.decayed > 0) {
        decayed += 1;
        await db.skillEvents.add({ id: uid(), skillId: skill.id, kind: "decay", amount: -result.decayed, reason: "长期未练习的缓慢衰减", sourceId: null, createdAt: now.toISOString(), reversesEventId: null });
      }
    }
  });
  return decayed;
}

export async function listSkillEvents(skillId?: string): Promise<SkillEvent[]> {
  const rows = skillId ? await db.skillEvents.where("skillId").equals(skillId).toArray() : await db.skillEvents.toArray();
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ---------------------------------------------------------------------------
// 背包（Inventory）
// ---------------------------------------------------------------------------

export interface ItemDraft {
  name: string;
  description: string;
  rarity: Item["rarity"];
  category: InventoryCategory;
  notes: string;
  source: string;
}

export async function createInventoryItem(draft: ItemDraft): Promise<Item> {
  const now = nowIso();
  const item: Item = {
    id: uid(),
    name: draft.name.trim().slice(0, 60) || "未命名物品",
    description: draft.description.slice(0, 300),
    rarity: draft.rarity,
    equipped: false,
    category: draft.category,
    notes: draft.notes.slice(0, 300),
    source: draft.source.slice(0, 120),
    acquiredAt: now,
    unlockedAt: now,
  };
  await db.items.add(item);
  return item;
}

export async function updateInventoryItem(id: string, patch: Partial<ItemDraft>): Promise<void> {
  await db.items.update(id, { ...patch });
}

export async function deleteInventoryItem(id: string): Promise<void> {
  await db.items.delete(id);
}

/** 称手 is mutually exclusive across permanent items and story items. */
export async function setEquipped(id: string, kind: "item" | "story"): Promise<void> {
  await db.transaction("rw", [db.items, db.storyItems], async () => {
    const [items, storyItems] = await Promise.all([db.items.toArray(), db.storyItems.toArray()]);
    for (const item of items) {
      const shouldEquip = kind === "item" && item.id === id;
      if (Boolean(item.equipped) !== shouldEquip) await db.items.update(item.id, { equipped: shouldEquip });
    }
    for (const item of storyItems) {
      const shouldEquip = kind === "story" && item.id === id;
      if (Boolean(item.equipped) !== shouldEquip) await db.storyItems.update(item.id, { equipped: shouldEquip });
    }
  });
}

export async function setStoryItemStatus(id: string, status: StoryItem["status"]): Promise<void> {
  await db.storyItems.update(id, { status, equipped: status === "held" ? undefined : false, updatedAt: nowIso() });
}

export async function listInventory(): Promise<{ items: Item[]; storyItems: StoryItem[] }> {
  const [items, storyItems] = await Promise.all([db.items.toArray(), db.storyItems.toArray()]);
  return {
    items: items.sort((a, b) => Number(Boolean(b.equipped)) - Number(Boolean(a.equipped)) || a.name.localeCompare(b.name, "zh-CN")),
    storyItems: storyItems.sort((a, b) => Number(Boolean(b.equipped)) - Number(Boolean(a.equipped)) || b.updatedAt.localeCompare(a.updatedAt)),
  };
}

// ---------------------------------------------------------------------------
// 人物关系（只读，只能由剧情改变）
// ---------------------------------------------------------------------------

export async function listRelationships(threadId?: string | null): Promise<StoryActor[]> {
  const rows = await db.storyActors.toArray();
  const filtered = threadId ? rows.filter((actor) => !actor.threadId || actor.threadId === threadId) : rows;
  return filtered.sort((a, b) => b.relationship - a.relationship);
}






// ---------------------------------------------------------------------------
// 魔药配方（作者补充设定）
// ---------------------------------------------------------------------------

/** 将作者发布的配方写入本机库（幂等；作者未发布配方的途径保持为空）。 */
export async function ensureAuthorFormulas(): Promise<number> {
  const rows: Formula[] = AUTHOR_CONTENT.formulas.map((formula) => ({
    id: `${formula.pathwayId}-${formula.sequence}`,
    pathwayId: formula.pathwayId,
    sequence: formula.sequence,
    sequenceName: formula.sequenceName,
    main: formula.main,
    auxiliary: formula.aux,
    potionLook: formula.potionLook,
    traitLook: formula.traitLook,
    mythicForm: formula.mythicForm,
    sourceKind: "author",
  }));
  if (rows.length === 0) return 0;
  await db.formulas.bulkPut(rows);
  return rows.length;
}

export async function listFormulas(pathwayId?: string | null): Promise<Formula[]> {
  const rows = pathwayId ? await db.formulas.where("pathwayId").equals(pathwayId).toArray() : await db.formulas.toArray();
  return rows.sort((a, b) => b.sequence - a.sequence);
}




