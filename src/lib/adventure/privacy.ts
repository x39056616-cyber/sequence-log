import type { AdventureEvent, CharacterBackground, FateProfile, Habit, HabitLog, PersonalProfile, Quest, QuestCompletion, Skill, StoryActor, StoryFlag } from "@/lib/types";
import { getLoreEvidence } from "@/lib/lore/evidence";
import { getPathway, getSequence } from "@/lib/lore/pathways";
import { buildLoreGrounding } from "@/lib/lore/grounding";

export interface AIContext {
  generatedFor: string;
  personalSummary: string;
  goals: Array<{ title: string; horizon: string; priority: number }>;
  interests: string[];
  preferredDomains: string[];
  avoidedTasks: string[];
  constraints: Array<{ category: string; value: string }>;
  schedule: { weekdayMinutes: number; weekendMinutes: number; preferredTime: string; energyPattern: string };
  resources: { environment: string[]; equipment: string[]; socialPreference: string; difficultyPreference: number };
  state: { pathway: string; sequence: number; sequenceName: string; status: Record<string, number>; digestion: number; digestionCap: number };
  recentCompletions: Array<{ title: string; type: string; minutes: number; quality: string; completedAt: string }>;
  currentQuests: Array<{ title: string; type: string; status: string; minutes: number; tags: string[] }>;
  storyFlags: Array<{ key: string; value: number; label: string }>;
  recentEvents: Array<{ chapter: string; title: string; opening: string; chosenChoiceId: string | null }>;
  habits: Array<{ title: string; frequency: string; active: boolean }>;
  habitLogs: Array<{ status: string; localDate: string; note: string }>;
  loreEvidence: string[];
  skills: Array<{ name: string; level: string; proficiency: number }>;
  relationships: Array<{ name: string; role: string; faction: string; attitude: string; relationship: number; notes: string }>;
  fate: {
    summary: string;
    attributes: Array<{ category: string; value: string; pool: string; maySuggestRealityTask: boolean }>;
    note: string;
  } | null;
  background: {
    name: string; age: string; occupation: string; origin: string; appearance: string;
    personality: string; motive: string; secret: string; keepsake: string; weakness: string;
    text: string;
  } | null;
}

const PRIVATE_PATTERNS: Array<[RegExp, string]> = [
  [/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[邮箱已移除]"],
  [/(?:\+?86[- ]?)?1[3-9]\d{9}/g, "[手机号已移除]"],
  [/(?:身份证|证件号|银行卡|信用卡)[：:\s]*[A-Za-z0-9-]{6,}/g, "[敏感号码已移除]"],
  [/(?:住在|地址|上海市|北京市|广州市|深圳市|杭州市|成都市|重庆市)[^，。；\n]{0,40}/g, "[精确位置已移除]"],
  [/https?:\/\/\S+/g, "[链接已移除]"],
];

export function sanitizeText(value: string, limit = 240) {
  let text = value.replace(/\s+/g, " ").trim();
  for (const [pattern, replacement] of PRIVATE_PATTERNS) text = text.replace(pattern, replacement);
  return text.slice(0, limit);
}

export function buildAIContext(input: {
  localDate: string;
  profile: PersonalProfile;
  quests: Quest[];
  completions: QuestCompletion[];
  flags: StoryFlag[];
  events: AdventureEvent[];
  habits: Habit[];
  habitLogs: HabitLog[];
  pathwayId: string | null;
  sequence: number;
  digestion: number;
  digestionCap: number;
  status: Record<string, number>;
  fate?: FateProfile | null;
  background?: CharacterBackground | null;
  skills?: Skill[];
  relationships?: StoryActor[];
}): AIContext {
  const pathway = getPathway(input.pathwayId);
  const sequence = getSequence(input.pathwayId, input.sequence as never);
  const evidence = input.pathwayId ? getLoreEvidence(input.pathwayId, input.sequence) : null;
  const constraints = input.profile.constraints.flatMap((item) => {
    if (item.sharing === "local") return [];
    return [{ category: item.category, value: sanitizeText(item.sharing === "summary" ? item.summary : item.detail, 180) }];
  });
  return {
    generatedFor: input.localDate,
    personalSummary: sanitizeText(input.profile.summary, 320),
    goals: input.profile.goals.filter((goal) => goal.active).slice(0, 12).map((goal) => ({ title: sanitizeText(goal.title, 80), horizon: goal.horizon, priority: goal.priority })),
    interests: input.profile.interests.slice(0, 20).map((item) => sanitizeText(item, 40)),
    preferredDomains: input.profile.preferredDomains.slice(0, 12),
    avoidedTasks: input.profile.avoidedTasks.slice(0, 12).map((item) => sanitizeText(item, 40)),
    constraints,
    schedule: { weekdayMinutes: input.profile.weekdayMinutes, weekendMinutes: input.profile.weekendMinutes, preferredTime: input.profile.preferredTime, energyPattern: input.profile.energyPattern },
    resources: { environment: input.profile.environment.slice(0, 8), equipment: input.profile.equipment.slice(0, 16).map((item) => sanitizeText(item, 40)), socialPreference: input.profile.socialPreference, difficultyPreference: input.profile.difficultyPreference },
    state: { pathway: pathway?.name ?? "未选择", sequence: input.sequence, sequenceName: sequence?.name ?? "未知", status: input.status, digestion: input.digestion, digestionCap: input.digestionCap },
    recentCompletions: input.completions.filter((item) => !item.revokedAt).slice(-30).map((item) => ({ title: sanitizeText(item.questTitle, 80), type: "unknown", minutes: item.actualMinutes, quality: item.quality, completedAt: item.completedAt })),
    currentQuests: input.quests.filter((quest) => quest.status !== "completed").slice(0, 40).map((quest) => ({ title: sanitizeText(quest.title, 80), type: quest.type, status: quest.status, minutes: quest.estimatedMinutes, tags: quest.tags.slice(0, 8).map((tag) => sanitizeText(tag, 24)) })),
    habits: input.habits.map((habit) => ({ title: sanitizeText(habit.title, 80), frequency: habit.frequency, active: habit.active })),
    habitLogs: input.habitLogs.slice(-90).map((log) => ({ status: log.status, localDate: log.localDate, note: sanitizeText(log.note, 120) })),
    storyFlags: input.flags.map((flag) => ({ key: flag.key, value: flag.value, label: sanitizeText(flag.label, 40) })),
    recentEvents: input.events.slice(-12).map((event) => ({ chapter: sanitizeText(event.chapter, 50), title: sanitizeText(event.title, 80), opening: sanitizeText(event.opening, 180), chosenChoiceId: event.chosenChoiceId })),
    // 叙事同样以原著依据包为事实基础（短引文 + 章节行号），而不是自由发挥。
    loreEvidence: (() => {
      const grounding = buildLoreGrounding({
        pathwayId: input.pathwayId,
        sequence: input.sequence,
        fateAttributes: (input.fate?.attributes ?? []).map((attribute) => ({ categoryId: attribute.categoryId, optionLabel: attribute.optionLabel })),
      });
      if (grounding.length > 0) return grounding.map((line) => sanitizeText(line, 300));
      return evidence?.evidence.slice(0, 3).map((item) => sanitizeText(item.quote, 120)) ?? [];
    })(),
    skills: (input.skills ?? []).slice(0, 12).map((skill) => ({ name: sanitizeText(skill.name, 40), level: skill.level, proficiency: skill.proficiency })),
    relationships: (input.relationships ?? []).slice(0, 12).map((actor) => ({
      name: sanitizeText(actor.name, 40),
      role: sanitizeText(actor.role, 60),
      faction: sanitizeText(actor.faction ?? "", 40),
      attitude: actor.attitude ?? "",
      relationship: actor.relationship,
      notes: sanitizeText(actor.notes, 160),
    })),
    background: input.background && input.background.status === "active" ? {
      name: sanitizeText(input.background.fields.name, 24),
      age: sanitizeText(input.background.fields.age, 24),
      occupation: sanitizeText(input.background.fields.occupation, 40),
      origin: sanitizeText(input.background.fields.origin, 60),
      appearance: sanitizeText(input.background.fields.appearance, 200),
      personality: sanitizeText(input.background.fields.personality, 200),
      motive: sanitizeText(input.background.fields.motive, 200),
      secret: sanitizeText(input.background.fields.secret, 200),
      keepsake: sanitizeText(input.background.fields.keepsake, 80),
      weakness: sanitizeText(input.background.fields.weakness, 200),
      text: sanitizeText(input.background.backgroundText, 1600),
    } : null,
    fate: input.fate && input.fate.status === "active" ? {
      summary: sanitizeText(input.fate.attributes.map((attribute) => attribute.categoryLabel + "：" + attribute.optionLabel).join("｜"), 240),
      attributes: input.fate.attributes.map((attribute) => ({
        category: sanitizeText(attribute.categoryLabel, 40),
        value: sanitizeText(attribute.optionLabel, 60),
        pool: attribute.pool,
        maySuggestRealityTask: attribute.taskAffinity,
      })),
      note: sanitizeText(input.fate.note, 160),
    } : null,
  };
}

export async function contextHash(value: unknown) {
  const text = JSON.stringify(value);
  if (typeof globalThis.crypto?.subtle?.digest === "function") {
    const bytes = new TextEncoder().encode(text);
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0").repeat(8);
}


export function detectSensitiveInput(value: string) {
  return PRIVATE_PATTERNS.some(([pattern]) => { pattern.lastIndex = 0; return pattern.test(value); });
}






