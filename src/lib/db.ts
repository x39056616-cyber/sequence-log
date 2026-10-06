import Dexie, { type Table } from "dexie";
import { uid } from "@/lib/utils";
import type {
  Achievement, AdventureEvent, AIRequestLog, Attribute, BackupSnapshotV7, CharacterBackground, FateProfile, Formula, Habit, HabitLog, Item,
  PathwayTransfer, PersonalProfile, Quest, QuestCompletion, RealityRequirement, SceneAsset, SequenceState, Settings, Skill, SkillEvent,
  StabilityEvent, StoryActor, StoryCheckpoint, StoryFlag, StoryItem, StorySummary, StoryThread, StoryTurn, UserProfile, WheelCategory,
  WheelOption, WheelSpin, WorldState, XPEvent,
} from "@/lib/types";
import { WHEEL_CATEGORY_PRESETS, WHEEL_OPTION_PRESETS, presetCategoryRow, presetOptionRow } from "@/lib/wheel/presets";
import { ATTRIBUTE_DISPLAY } from "@/lib/domain/skill";

export class SequenceDatabase extends Dexie {
  profile!: Table<UserProfile, string>;
  attributes!: Table<Attribute, string>;
  sequenceState!: Table<SequenceState, string>;
  quests!: Table<Quest, string>;
  completions!: Table<QuestCompletion, string>;
  xpEvents!: Table<XPEvent, string>;
  habits!: Table<Habit, string>;
  habitLogs!: Table<HabitLog, string>;
  realityRequirements!: Table<RealityRequirement, string>;
  achievements!: Table<Achievement, string>;
  items!: Table<Item, string>;
  stabilityEvents!: Table<StabilityEvent, string>;
  pathwayTransfers!: Table<PathwayTransfer, string>;
  settings!: Table<Settings, string>;
  personalProfile!: Table<PersonalProfile, string>;
  adventureEvents!: Table<AdventureEvent, string>;
  storyFlags!: Table<StoryFlag, string>;
  storyActors!: Table<StoryActor, string>;
  sceneAssets!: Table<SceneAsset, string>;
  aiRequestLogs!: Table<AIRequestLog, string>;
  storyThreads!: Table<StoryThread, string>;
  storyTurns!: Table<StoryTurn, string>;
  storyCheckpoints!: Table<StoryCheckpoint, string>;
  worldStates!: Table<WorldState, string>;
  storyItems!: Table<StoryItem, string>;
  storySummaries!: Table<StorySummary, string>;
  wheelCategories!: Table<WheelCategory, string>;
  wheelOptions!: Table<WheelOption, string>;
  fateProfiles!: Table<FateProfile, string>;
  wheelSpins!: Table<WheelSpin, string>;
  characterBackgrounds!: Table<CharacterBackground, string>;
  skills!: Table<Skill, string>;
  skillEvents!: Table<SkillEvent, string>;
  formulas!: Table<Formula, string>;

  constructor() {
    super("sequence-log");
    this.version(1).stores({
      profile: "id, updatedAt",
      attributes: "id, key, order",
      sequenceState: "id, pathwayId, sequence, updatedAt",
      quests: "id, status, type, difficulty, dueAt, createdAt, updatedAt",
      completions: "id, questId, completedAt, revokedAt",
      xpEvents: "id, kind, sourceId, createdAt, reversesEventId",
      habits: "id, active, createdAt, updatedAt",
      habitLogs: "id, habitId, localDate, status, [habitId+localDate], createdAt",
      realityRequirements: "id, pathwayId, sequence, kind, [pathwayId+sequence], completed",
      achievements: "id, unlockedAt",
      items: "id, rarity, equipped, unlockedAt",
      stabilityEvents: "id, eventType, createdAt",
      pathwayTransfers: "id, fromPathwayId, toPathwayId, createdAt",
      settings: "id, updatedAt",
    });
    this.version(2).stores({
      profile: "id, updatedAt",
      attributes: "id, key, order",
      sequenceState: "id, pathwayId, sequence, updatedAt",
      quests: "id, status, type, difficulty, dueAt, createdAt, updatedAt, originEventId",
      completions: "id, questId, completedAt, revokedAt",
      xpEvents: "id, kind, sourceId, createdAt, reversesEventId",
      habits: "id, active, createdAt, updatedAt",
      habitLogs: "id, habitId, localDate, status, [habitId+localDate], createdAt",
      realityRequirements: "id, pathwayId, sequence, kind, [pathwayId+sequence], completed",
      achievements: "id, unlockedAt",
      items: "id, rarity, equipped, unlockedAt",
      stabilityEvents: "id, eventType, createdAt",
      pathwayTransfers: "id, fromPathwayId, toPathwayId, createdAt",
      settings: "id, updatedAt",
      personalProfile: "id, updatedAt",
      adventureEvents: "id, localDate, kind, status, createdAt, [localDate+kind]",
      storyFlags: "id, key, updatedAt",
      storyActors: "id, name, updatedAt",
      sceneAssets: "id, eventId, createdAt",
      aiRequestLogs: "id, provider, model, status, createdAt",
    });
    this.version(3).stores({
      profile: "id, updatedAt",
      attributes: "id, key, order",
      sequenceState: "id, pathwayId, sequence, updatedAt",
      quests: "id, status, type, difficulty, dueAt, createdAt, updatedAt, originEventId",
      completions: "id, questId, completedAt, revokedAt",
      xpEvents: "id, kind, sourceId, createdAt, reversesEventId",
      habits: "id, active, createdAt, updatedAt",
      habitLogs: "id, habitId, localDate, status, [habitId+localDate], createdAt",
      realityRequirements: "id, pathwayId, sequence, kind, [pathwayId+sequence], completed",
      achievements: "id, unlockedAt",
      items: "id, rarity, equipped, unlockedAt",
      stabilityEvents: "id, eventType, createdAt",
      pathwayTransfers: "id, fromPathwayId, toPathwayId, createdAt",
      settings: "id, updatedAt",
      personalProfile: "id, updatedAt",
      adventureEvents: "id, localDate, kind, status, createdAt, threadId, [localDate+kind]",
      storyFlags: "id, key, updatedAt",
      storyActors: "id, name, updatedAt",
      sceneAssets: "id, eventId, createdAt",
      aiRequestLogs: "id, provider, model, status, createdAt",
      storyThreads: "id, eventId, status, updatedAt, parentCheckpointId",
      storyTurns: "id, threadId, parentTurnId, createdAt",
      storyCheckpoints: "id, threadId, turnId, createdAt",
      worldStates: "id, threadId, updatedAt",
      storyItems: "id, threadId, status, updatedAt",
      storySummaries: "id, threadId, throughTurnId, createdAt",
    });
    this.version(4).stores({
      profile: "id, updatedAt",
      attributes: "id, key, order",
      sequenceState: "id, pathwayId, sequence, updatedAt",
      quests: "id, status, type, difficulty, dueAt, createdAt, updatedAt, originEventId",
      completions: "id, questId, completedAt, revokedAt",
      xpEvents: "id, kind, sourceId, createdAt, reversesEventId",
      habits: "id, active, createdAt, updatedAt",
      habitLogs: "id, habitId, localDate, status, [habitId+localDate], createdAt",
      realityRequirements: "id, pathwayId, sequence, kind, [pathwayId+sequence], completed",
      achievements: "id, unlockedAt",
      items: "id, rarity, equipped, unlockedAt",
      stabilityEvents: "id, eventType, createdAt",
      pathwayTransfers: "id, fromPathwayId, toPathwayId, createdAt",
      settings: "id, updatedAt",
      personalProfile: "id, updatedAt",
      adventureEvents: "id, localDate, kind, status, createdAt, threadId, [localDate+kind]",
      storyFlags: "id, key, updatedAt",
      storyActors: "id, name, updatedAt",
      sceneAssets: "id, eventId, createdAt",
      aiRequestLogs: "id, provider, model, status, createdAt",
      storyThreads: "id, eventId, status, createdAt, updatedAt, parentCheckpointId",
      storyTurns: "id, threadId, parentTurnId, createdAt",
      storyCheckpoints: "id, threadId, turnId, createdAt",
      worldStates: "id, threadId, updatedAt",
      storyItems: "id, threadId, status, updatedAt",
      storySummaries: "id, threadId, throughTurnId, createdAt",
    });
    this.version(5).stores({
      profile: "id, updatedAt",
      attributes: "id, key, order",
      sequenceState: "id, pathwayId, sequence, updatedAt",
      quests: "id, status, type, difficulty, dueAt, createdAt, updatedAt, originEventId",
      completions: "id, questId, completedAt, revokedAt",
      xpEvents: "id, kind, sourceId, createdAt, reversesEventId",
      habits: "id, active, createdAt, updatedAt",
      habitLogs: "id, habitId, localDate, status, [habitId+localDate], createdAt",
      realityRequirements: "id, pathwayId, sequence, kind, [pathwayId+sequence], completed",
      achievements: "id, unlockedAt",
      items: "id, rarity, equipped, unlockedAt",
      stabilityEvents: "id, eventType, createdAt",
      pathwayTransfers: "id, fromPathwayId, toPathwayId, createdAt",
      settings: "id, updatedAt",
      personalProfile: "id, updatedAt",
      adventureEvents: "id, localDate, kind, status, createdAt, threadId, [localDate+kind]",
      storyFlags: "id, key, updatedAt",
      storyActors: "id, name, updatedAt",
      sceneAssets: "id, eventId, createdAt",
      aiRequestLogs: "id, provider, model, status, createdAt",
      storyThreads: "id, eventId, status, createdAt, updatedAt, parentCheckpointId",
      storyTurns: "id, threadId, parentTurnId, createdAt",
      storyCheckpoints: "id, threadId, turnId, createdAt",
      worldStates: "id, threadId, updatedAt",
      storyItems: "id, threadId, status, updatedAt",
      storySummaries: "id, threadId, throughTurnId, createdAt",
      wheelCategories: "id, order, builtIn, updatedAt",
      wheelOptions: "id, categoryId, order, enabled, pool, [categoryId+order]",
      fateProfiles: "id, status, spunAt",
      wheelSpins: "id, fateProfileId, categoryId, createdAt",
    });
    this.version(6).stores({
      profile: "id, updatedAt",
      attributes: "id, key, order",
      sequenceState: "id, pathwayId, sequence, updatedAt",
      quests: "id, status, type, difficulty, dueAt, createdAt, updatedAt, originEventId",
      completions: "id, questId, completedAt, revokedAt",
      xpEvents: "id, kind, sourceId, createdAt, reversesEventId",
      habits: "id, active, createdAt, updatedAt",
      habitLogs: "id, habitId, localDate, status, [habitId+localDate], createdAt",
      realityRequirements: "id, pathwayId, sequence, kind, [pathwayId+sequence], completed",
      achievements: "id, unlockedAt",
      items: "id, rarity, equipped, unlockedAt",
      stabilityEvents: "id, eventType, createdAt",
      pathwayTransfers: "id, fromPathwayId, toPathwayId, createdAt",
      settings: "id, updatedAt",
      personalProfile: "id, updatedAt",
      adventureEvents: "id, localDate, kind, status, createdAt, threadId, [localDate+kind]",
      storyFlags: "id, key, updatedAt",
      storyActors: "id, name, updatedAt",
      sceneAssets: "id, eventId, createdAt",
      aiRequestLogs: "id, provider, model, status, createdAt",
      storyThreads: "id, eventId, status, createdAt, updatedAt, parentCheckpointId",
      storyTurns: "id, threadId, parentTurnId, createdAt",
      storyCheckpoints: "id, threadId, turnId, createdAt",
      worldStates: "id, threadId, updatedAt",
      storyItems: "id, threadId, status, updatedAt",
      storySummaries: "id, threadId, throughTurnId, createdAt",
      wheelCategories: "id, order, builtIn, updatedAt",
      wheelOptions: "id, categoryId, order, enabled, pool, [categoryId+order]",
      fateProfiles: "id, status, spunAt",
      wheelSpins: "id, fateProfileId, categoryId, createdAt",
      characterBackgrounds: "id, status, fateProfileId, createdAt",
    });
    this.version(7).stores({
      profile: "id, updatedAt",
      attributes: "id, key, order",
      sequenceState: "id, pathwayId, sequence, updatedAt",
      quests: "id, status, type, difficulty, dueAt, createdAt, updatedAt, originEventId",
      completions: "id, questId, completedAt, revokedAt",
      xpEvents: "id, kind, sourceId, createdAt, reversesEventId",
      habits: "id, active, createdAt, updatedAt",
      habitLogs: "id, habitId, localDate, status, [habitId+localDate], createdAt",
      realityRequirements: "id, pathwayId, sequence, kind, [pathwayId+sequence], completed",
      achievements: "id, unlockedAt",
      items: "id, rarity, equipped, unlockedAt",
      stabilityEvents: "id, eventType, createdAt",
      pathwayTransfers: "id, fromPathwayId, toPathwayId, createdAt",
      settings: "id, updatedAt",
      personalProfile: "id, updatedAt",
      adventureEvents: "id, localDate, kind, status, createdAt, threadId, [localDate+kind]",
      storyFlags: "id, key, updatedAt",
      storyActors: "id, name, updatedAt",
      sceneAssets: "id, eventId, createdAt",
      aiRequestLogs: "id, provider, model, status, createdAt",
      storyThreads: "id, eventId, status, createdAt, updatedAt, parentCheckpointId",
      storyTurns: "id, threadId, parentTurnId, createdAt",
      storyCheckpoints: "id, threadId, turnId, createdAt",
      worldStates: "id, threadId, updatedAt",
      storyItems: "id, threadId, status, updatedAt",
      storySummaries: "id, threadId, throughTurnId, createdAt",
      wheelCategories: "id, order, builtIn, updatedAt",
      wheelOptions: "id, categoryId, order, enabled, pool, [categoryId+order]",
      fateProfiles: "id, status, spunAt",
      wheelSpins: "id, fateProfileId, categoryId, createdAt",
      characterBackgrounds: "id, status, fateProfileId, createdAt",
      skills: "id, pathwayId, sequence, status, manual, updatedAt",
      skillEvents: "id, skillId, kind, sourceId, createdAt",
    });
    this.version(8).stores({
      profile: "id, updatedAt",
      attributes: "id, key, order",
      sequenceState: "id, pathwayId, sequence, updatedAt",
      quests: "id, status, type, difficulty, dueAt, createdAt, updatedAt, originEventId",
      completions: "id, questId, completedAt, revokedAt",
      xpEvents: "id, kind, sourceId, createdAt, reversesEventId",
      habits: "id, active, createdAt, updatedAt",
      habitLogs: "id, habitId, localDate, status, [habitId+localDate], createdAt",
      realityRequirements: "id, pathwayId, sequence, kind, [pathwayId+sequence], completed",
      achievements: "id, unlockedAt",
      items: "id, rarity, equipped, unlockedAt",
      stabilityEvents: "id, eventType, createdAt",
      pathwayTransfers: "id, fromPathwayId, toPathwayId, createdAt",
      settings: "id, updatedAt",
      personalProfile: "id, updatedAt",
      adventureEvents: "id, localDate, kind, status, createdAt, threadId, [localDate+kind]",
      storyFlags: "id, key, updatedAt",
      storyActors: "id, name, updatedAt",
      sceneAssets: "id, eventId, createdAt",
      aiRequestLogs: "id, provider, model, status, createdAt",
      storyThreads: "id, eventId, status, createdAt, updatedAt, parentCheckpointId",
      storyTurns: "id, threadId, parentTurnId, createdAt",
      storyCheckpoints: "id, threadId, turnId, createdAt",
      worldStates: "id, threadId, updatedAt",
      storyItems: "id, threadId, status, updatedAt",
      storySummaries: "id, threadId, throughTurnId, createdAt",
      wheelCategories: "id, order, builtIn, updatedAt",
      wheelOptions: "id, categoryId, order, enabled, pool, [categoryId+order]",
      fateProfiles: "id, status, spunAt",
      wheelSpins: "id, fateProfileId, categoryId, createdAt",
      characterBackgrounds: "id, status, fateProfileId, createdAt",
      skills: "id, pathwayId, sequence, status, manual, updatedAt",
      skillEvents: "id, skillId, kind, sourceId, createdAt",
      formulas: "id, pathwayId, sequence",
    });
  }
}

export const db = new SequenceDatabase();

export async function ensureSeed() {
  const existing = await db.profile.get("me");
  const existingPersonal = await db.personalProfile.get("me");
  if (existing && existingPersonal) return;
  const now = new Date().toISOString();
  // 显示名走 ATTRIBUTE_DISPLAY（贴合诡秘之主）；内部 key 仍是原值，任务与模板不受影响。
  const attributes: Attribute[] = [
    ["intellect", "#b7c8a1"],
    ["body", "#c8866a"],
    ["focus", "#8fa8c8"],
    ["social", "#c9a66b"],
    ["creativity", "#aa8fc8"],
    ["execution", "#7fa58f"],
    ["will", "#b78a7a"],
    ["life", "#8caaaa"],
  ].map(([key, color], order) => ({
    id: key,
    key,
    name: ATTRIBUTE_DISPLAY[key]?.name ?? key,
    description: ATTRIBUTE_DISPLAY[key]?.description ?? "",
    color,
    xp: 0,
    order,
    createdAt: now,
    updatedAt: now,
  }));
  const profile: UserProfile = { id: "me", name: "调查员", title: "尚未选择途径", totalSpirituality: 0, createdAt: now, updatedAt: now };
  const sequenceState: SequenceState = { id: "active", pathwayId: null, sequence: 9, digestion: 0, stage: "formula", createdAt: now, updatedAt: now };
  const personalProfile: PersonalProfile = {
    id: "me", summary: "", interests: [], preferredDomains: [], avoidedTasks: [], goals: [], constraints: [],
    weekdayMinutes: 45, weekendMinutes: 90, preferredTime: "flexible", energyPattern: "variable",
    environment: ["home"], equipment: [], socialPreference: "solo", difficultyPreference: 3, consentVersion: 0, updatedAt: now,
  };
  if (existing) {
    await db.personalProfile.put(personalProfile);
    return;
  }
  const settings: Settings = {
    id: "app", timezone: "Asia/Shanghai", weekStartsOn: 1,
    digestionBase: 100, digestionLinear: 50, digestionQuadratic: 10,
    theme: "dark", animations: true, chapterLength: "long", allowNonCanonGeo: true,
    status: { san: 60, energy: 60, focus: 60, motivation: 60 }, updatedAt: now,
  };
  const seedQuests: Quest[] = [
    ["阅读 30 分钟", "安静阅读一本与长期目标相关的书。", "daily", 2, 30, 1],
    ["完成一次深蹲训练", "记录组数、次数和身体感受。", "side", 3, 40, 0.5],
    ["整理明日计划", "写下最重要的三件事并安排时间。", "daily", 1, 15, 0.5],
  ].map(([title, description, type, difficulty, estimatedMinutes, actingFit], index) => ({
    id: uid(), title: String(title), description: String(description), status: "today", type: type as Quest["type"],
    difficulty: difficulty as Quest["difficulty"], priority: (index === 0 ? 3 : 2) as Quest["priority"], estimatedMinutes: Number(estimatedMinutes),
    dueAt: null, xpOverride: null, actingFit: actingFit as Quest["actingFit"], attributeIds: [index === 0 ? "intellect" : index === 1 ? "body" : "life"],
    tags: ["初始任务"], notes: "", createdAt: now, updatedAt: now, completedAt: null,
  }));
  const achievements: Achievement[] = [
    { id: "first-step", name: "第一步", description: "完成第一个现实任务。", unlockedAt: null, rule: "完成任意任务 1 次" },
    { id: "path-chosen", name: "途径已定", description: "选择一条非凡途径。", unlockedAt: null, rule: "选择途径" },
    { id: "sequence-8", name: "序列晋升", description: "首次晋升到下一序列。", unlockedAt: null, rule: "完成一次晋升" },
  ];
  const items: Item[] = [
    { id: "brass-journal", name: "黄铜日记本", description: "记录行动与扮演历史的初始非凡物品。", rarity: "common", equipped: true, unlockedAt: now },
    { id: "grey-fog-lantern", name: "灰雾提灯", description: "低稳定度时提醒你建立锚点。", rarity: "rare", equipped: false, unlockedAt: null },
  ];
  await db.transaction("rw", [db.profile, db.attributes, db.sequenceState, db.settings, db.quests, db.achievements, db.items, db.personalProfile], async () => {
    await db.profile.put(profile);
    await db.attributes.bulkPut(attributes);
    await db.sequenceState.put(sequenceState);
    await db.settings.put(settings);
    await db.quests.bulkPut(seedQuests);
    await db.achievements.bulkPut(achievements);
    await db.items.bulkPut(items);
    await db.personalProfile.put(personalProfile);
  });
}

export function buildBackup(snapshot: Omit<BackupSnapshotV7, "schemaVersion" | "exportedAt">): BackupSnapshotV7 {
  return { schemaVersion: 7, exportedAt: new Date().toISOString(), ...snapshot };
}








/**
 * Installs/refreshes the built-in Fate Wheel presets.
 *
 * Built-in categories and options are re-synced to the current preset definition so a
 * content upgrade reaches existing databases; stale built-ins are pruned, and anything
 * the user created themselves is left untouched.
 */
export async function ensureWheelSeed() {
  await syncWheelPresets();
}

/** Restores built-in categories and options to their preset definition without deleting user content. */
export async function restoreWheelPresets() {
  await syncWheelPresets();
}

async function syncWheelPresets() {
  const now = new Date().toISOString();
  const categoryRows = WHEEL_CATEGORY_PRESETS.map((preset) => presetCategoryRow(preset, now));
  const optionRows = WHEEL_OPTION_PRESETS.map((preset) => presetOptionRow(preset, now));
  const presetCategoryIds = new Set(categoryRows.map((row) => row.id));
  const presetOptionIds = new Set(optionRows.map((row) => row.id));

  await db.transaction("rw", [db.wheelCategories, db.wheelOptions], async () => {
    const existingCategories = await db.wheelCategories.toArray();
    const existingOptions = await db.wheelOptions.toArray();

    // Prune only built-in rows that the current preset set no longer defines.
    const staleCategoryIds = existingCategories.filter((row) => row.builtIn && !presetCategoryIds.has(row.id)).map((row) => row.id);
    for (const id of staleCategoryIds) {
      await db.wheelOptions.where("categoryId").equals(id).delete();
      await db.wheelCategories.delete(id);
    }
    const staleOptionIds = existingOptions
      .filter((row) => row.builtIn && !presetOptionIds.has(row.id) && !staleCategoryIds.includes(row.categoryId))
      .map((row) => row.id);
    if (staleOptionIds.length > 0) await db.wheelOptions.bulkDelete(staleOptionIds);

    await db.wheelCategories.bulkPut(categoryRows);
    await db.wheelOptions.bulkPut(optionRows);
  });
}






