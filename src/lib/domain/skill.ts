import type { RelationshipAttitude, SkillLevel } from "@/lib/types";

// ---------------------------------------------------------------------------
// 属性显示名（只改显示名，内部 key 保持不变）
// ---------------------------------------------------------------------------

export const ATTRIBUTE_DISPLAY: Record<string, { name: string; description: string }> = {
  intellect: { name: "学识", description: "学习、推理与知识整合" },
  body: { name: "体质", description: "运动、体力与健康习惯" },
  focus: { name: "灵性", description: "深度专注与注意力" },
  social: { name: "魅力", description: "沟通、关系与协作" },
  creativity: { name: "灵感", description: "写作、设计与新想法" },
  execution: { name: "行动", description: "启动、完成与持续推进" },
  will: { name: "定力", description: "面对阻力与长期坚持" },
  life: { name: "事务", description: "财务、整理与日常责任" },
};

// ---------------------------------------------------------------------------
// 技能熟练度
// ---------------------------------------------------------------------------

export const SKILL_MAX_PROFICIENCY = 1000;

const LEVELS: Array<{ level: SkillLevel; min: number }> = [
  { level: "大师", min: 600 },
  { level: "精通", min: 300 },
  { level: "熟练", min: 100 },
  { level: "入门", min: 0 },
];

export function levelForProficiency(proficiency: number): SkillLevel {
  const value = Math.max(0, Math.min(SKILL_MAX_PROFICIENCY, proficiency));
  return LEVELS.find((entry) => value >= entry.min)?.level ?? "入门";
}

export function levelThreshold(level: SkillLevel): number {
  return LEVELS.find((entry) => entry.level === level)?.min ?? 0;
}

/**
 * Transparent growth rule: only acting-fit >= 1 quests train the current sequence skill.
 * gain = round(difficulty * 2 * qualityMultiplier)
 */
export function proficiencyGain(input: { difficulty: number; qualityMultiplier: number; actingFit: number }): number {
  if (input.actingFit < 1) return 0;
  const difficulty = Math.max(1, Math.min(5, Math.round(input.difficulty)));
  return Math.max(1, Math.round(difficulty * 2 * input.qualityMultiplier));
}

export const DECAY_GRACE_DAYS = 14;
export const DECAY_PERIOD_DAYS = 3;

/**
 * Never lets decay drop below the floor of `peak * 0.6`, and never below the
 * threshold of the level already reached. Levels therefore never regress.
 */
export function decayFloor(input: { peakProficiency: number; level: SkillLevel }): number {
  return Math.max(0, Math.floor(input.peakProficiency * 0.6), levelThreshold(input.level));
}

/**
 * Lazy, idempotent decay settlement. Only whole 3-day periods beyond the 14-day
 * grace are consumed; the anchor advances by exactly those periods, so calling
 * this repeatedly produces the same result.
 */
export function settleDecay(input: {
  proficiency: number;
  peakProficiency: number;
  level: SkillLevel;
  lastTrainedAt: string;
  decaySettledAt: string;
  now: Date;
}): { proficiency: number; decayed: number; settledAt: string } {
  const anchorIso = input.decaySettledAt || input.lastTrainedAt;
  const anchor = new Date(anchorIso).getTime();
  const nowMs = input.now.getTime();
  if (!Number.isFinite(anchor) || nowMs <= anchor) {
    return { proficiency: input.proficiency, decayed: 0, settledAt: anchorIso };
  }
  const graceMs = DECAY_GRACE_DAYS * 24 * 60 * 60 * 1000;
  const periodMs = DECAY_PERIOD_DAYS * 24 * 60 * 60 * 1000;
  const elapsed = nowMs - anchor - graceMs;
  if (elapsed < periodMs) return { proficiency: input.proficiency, decayed: 0, settledAt: anchorIso };

  const periods = Math.floor(elapsed / periodMs);
  const floor = decayFloor({ peakProficiency: input.peakProficiency, level: input.level });
  const target = Math.max(floor, input.proficiency - periods);
  const decayed = input.proficiency - target;
  const settledAt = new Date(anchor + periods * periodMs).toISOString();
  return { proficiency: target, decayed, settledAt };
}

// ---------------------------------------------------------------------------
// 人物关系
// ---------------------------------------------------------------------------

export function attitudeFor(relationship: number): RelationshipAttitude {
  if (relationship <= -40) return "敌对";
  if (relationship <= -10) return "警惕";
  if (relationship < 10) return "中立";
  if (relationship < 40) return "友好";
  return "信任";
}


export function clampRelationship(value: number): number {
  return Math.max(-100, Math.min(100, Math.round(value)));
}

