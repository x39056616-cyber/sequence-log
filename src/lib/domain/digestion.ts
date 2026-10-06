import type { ActingFit, Difficulty, Quality, Quest, QuestType, Settings } from "@/lib/types";
import { clamp } from "@/lib/utils";

export const DIFFICULTY_BASE: Record<Difficulty, number> = {
  1: 10,
  2: 25,
  3: 50,
  4: 100,
  5: 200,
};

export const TYPE_MULTIPLIER: Record<QuestType, number> = {
  main: 1.25,
  side: 1,
  daily: 0.75,
  weekly: 1.1,
  oneoff: 1,
  habit: 0.5,
  boss: 2,
};

export const QUALITY_MULTIPLIER: Record<Quality, number> = {
  missed: 0.5,
  done: 1,
  good: 1.5,
  excellent: 2,
};

export const ACTING_FIT_LABEL: Record<ActingFit, string> = {
  0: "无关",
  0.5: "间接",
  1: "契合",
  1.5: "高度契合",
};

export function calculateBaseDigestion(quest: Pick<Quest, "difficulty" | "type" | "estimatedMinutes" | "xpOverride">) {
  if (quest.xpOverride !== null && quest.xpOverride >= 0) return quest.xpOverride;
  const timeMultiplier = clamp(0.75 + quest.estimatedMinutes / 120, 0.75, 2);
  return Math.round(DIFFICULTY_BASE[quest.difficulty] * TYPE_MULTIPLIER[quest.type] * timeMultiplier);
}

export function calculateStatusAverage(status: Settings["status"]) {
  return Math.round((status.san + status.energy + status.focus + status.motivation) / 4);
}

export function calculateStatusMultiplier(average: number) {
  const safe = clamp(average, 0, 100);
  if (safe <= 60) return 0.5 + safe / 120;
  return 1 + (safe - 60) / 80;
}

export function calculateDigestionCap(sequence: number, settings: Pick<Settings, "digestionBase" | "digestionLinear" | "digestionQuadratic">) {
  const tier = 10 - sequence;
  const n = Math.max(0, tier - 1);
  return settings.digestionBase + settings.digestionLinear * n + settings.digestionQuadratic * n * n;
}

export interface DigestionBreakdown {
  base: number;
  quality: number;
  statusAverage: number;
  statusMultiplier: number;
  actingFit: ActingFit;
  computed: number;
  awarded: number;
  minimum: number;
  maximum: number;
}

export function calculateDigestion(
  quest: Quest,
  quality: Quality,
  settings: Settings,
  manualAdjustment = 0,
  manualFinal: number | null = null,
): DigestionBreakdown {
  const base = calculateBaseDigestion(quest);
  const statusAverage = calculateStatusAverage(settings.status);
  const statusMultiplier = calculateStatusMultiplier(statusAverage);
  const computed = base * QUALITY_MULTIPLIER[quality] * statusMultiplier * quest.actingFit;
  const minimum = quest.actingFit === 0 ? 0 : Math.round(base * 0.25);
  const maximum = Math.round(base * 3);
  const raw = manualFinal ?? computed + manualAdjustment;
  const awarded = quest.actingFit === 0 ? 0 : clamp(Math.round(raw), minimum, maximum);
  return {
    base,
    quality: QUALITY_MULTIPLIER[quality],
    statusAverage,
    statusMultiplier,
    actingFit: quest.actingFit,
    computed: Math.round(computed),
    awarded,
    minimum,
    maximum,
  };
}

export function allocateAttributeXp(total: number, attributeIds: string[]) {
  if (!attributeIds.length || total <= 0) return {};
  const base = Math.floor(total / attributeIds.length);
  let remainder = total - base * attributeIds.length;
  return Object.fromEntries(attributeIds.map((id) => {
    const extra = remainder > 0 ? 1 : 0;
    remainder = Math.max(0, remainder - 1);
    return [id, base + extra];
  }));
}

export function statusBand(average: number) {
  if (average < 15) return { key: "unstable", label: "濒临失控", className: "danger" } as const;
  if (average < 30) return { key: "danger", label: "危险波动", className: "danger" } as const;
  if (average < 60) return { key: "watch", label: "需留意", className: "warning" } as const;
  return { key: "stable", label: "稳定", className: "success" } as const;
}
