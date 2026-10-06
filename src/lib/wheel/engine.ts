import type { FateAttribute, FateProfile, WheelCategory, WheelOption, WheelPool, WheelSpin } from "@/lib/types";
import { bytesToHex, drawIndex, spinSeed, type RandomDraw } from "@/lib/wheel/rng";

export type SpecialPool = Exclude<WheelPool, "default">;

/**
 * Pool resolution is strictly additive: the default pool always stays available,
 * and drawing an identity that unlocks a special pool adds that pool's options.
 */
/** 抽取上下文：纪元过滤大地点，父级约束小地点与代号。 */
export interface PoolContext {
  era?: string | null;
  parent?: string | null;
  allowNonCanon?: boolean;
}

export function resolvePool(
  options: WheelOption[],
  categoryId: string,
  unlockedPools: SpecialPool[],
  context: PoolContext = {},
): WheelOption[] {
  const unlocked = new Set<SpecialPool>(unlockedPools);
  let pool = options
    .filter((option) => option.categoryId === categoryId && option.enabled)
    .filter((option) => option.pool === "default" || unlocked.has(option.pool as SpecialPool));

  // 非原作地名默认允许；关闭后只保留能回到原文的候选。
  if (context.allowNonCanon === false) {
    pool = pool.filter((option) => !option.nonCanon);
  }
  // 大地点按纪元过滤：第四纪帝国不会出现在第五纪。
  if (context.era) {
    pool = pool.filter((option) => !option.eraIds || option.eraIds.length === 0 || option.eraIds.includes(context.era as string));
  }
  // 小地点/代号必须匹配父级；父级未定或没有子项时回退到全部候选，避免空池卡死。
  if (context.parent) {
    const scoped = pool.filter((option) => option.parentId === context.parent);
    if (scoped.length > 0) pool = scoped;
  }

  return pool.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, "zh-CN"));
}

/** The gate category (身份类型) is always spun first so it can open special pools. */
export function orderCategoriesForSpin(categories: WheelCategory[]): WheelCategory[] {
  return [...categories].sort((a, b) => {
    if (a.gate !== b.gate) return a.gate ? -1 : 1;
    return a.order - b.order;
  });
}

export function unlockedPoolsFromAttributes(attributes: FateAttribute[]): SpecialPool[] {
  const pools = new Set<SpecialPool>();
  for (const attribute of attributes) {
    for (const pool of attribute.unlocks) pools.add(pool);
  }
  return [...pools];
}

export function attributeFromOption(category: WheelCategory, option: WheelOption): FateAttribute {
  return {
    categoryId: category.id,
    categoryLabel: category.label,
    optionId: option.id,
    optionLabel: option.label,
    optionDescription: option.description,
    pool: option.pool,
    unlocks: option.unlocks,
    taskAffinity: category.taskAffinityAllowed && option.taskAffinity,
    sourceKind: option.sourceKind,
    sourceNote: option.sourceNote,
  };
}

export interface SpinOutcome {
  option: WheelOption;
  pool: WheelOption[];
  draw: RandomDraw;
}

export function spinPool(pool: WheelOption[], entropy?: () => number): SpinOutcome {
  if (pool.length === 0) throw new Error("该类别当前没有可用扇区");
  const weights = pool.map((option) => Math.max(1, Math.round(option.weight ?? 1)));
  const total = weights.reduce((sum, value) => sum + value, 0);
  // 全部权重为 1 时退化为等概率，保持既有行为与测试不变。
  if (weights.every((value) => value === 1)) {
    const draw = drawIndex(pool.length, entropy);
    return { option: pool[draw.index], pool, draw };
  }
  // 权重抽取（用于「第五纪优先」这类规则）：先抽权重区间，再定位到具体扇区。
  const draw = drawIndex(total, entropy);
  let cursor = draw.index;
  for (let index = 0; index < pool.length; index += 1) {
    if (cursor < weights[index]) return { option: pool[index], pool, draw: { ...draw, index } };
    cursor -= weights[index];
  }
  return { option: pool[pool.length - 1], pool, draw };
}

export function makeSpinRecord(input: {
  id: string;
  fateProfileId: string | null;
  category: WheelCategory;
  outcome: SpinOutcome;
  isRespin: boolean;
  respinIndex: number;
  createdAt: string;
}): WheelSpin {
  const seed = spinSeed(input.category.id, input.outcome.draw.bytes, input.createdAt);
  return {
    id: input.id,
    fateProfileId: input.fateProfileId,
    categoryId: input.category.id,
    categoryLabel: input.category.label,
    optionId: input.outcome.option.id,
    optionLabel: input.outcome.option.label,
    pool: input.outcome.option.pool,
    poolSnapshot: input.outcome.pool.map((option) => option.id),
    poolSize: input.outcome.pool.length,
    rngBytes: bytesToHex(input.outcome.draw.bytes) || seed,
    isRespin: input.isRespin,
    respinIndex: input.respinIndex,
    createdAt: input.createdAt,
  };
}

export function respinIndexFor(spins: WheelSpin[], categoryId: string): number {
  return spins.filter((spin) => spin.categoryId === categoryId).length;
}

export function buildFateProfile(input: {
  id: string;
  name?: string;
  attributes: FateAttribute[];
  unlockedPools: SpecialPool[];
  note: string;
  spunAt: string;
}): FateProfile {
  const seed = input.attributes.map((attribute) => attribute.optionId).join("·");
  return {
    id: input.id,
    name: input.name?.trim().slice(0, 40) ?? "",
    status: "active",
    attributes: input.attributes,
    unlockedPools: input.unlockedPools,
    seed,
    note: input.note,
    spunAt: input.spunAt,
    supersededAt: null,
  };
}

export function fateSummary(profile: FateProfile | null | undefined): string {
  if (!profile || profile.attributes.length === 0) return "";
  return profile.attributes.map((attribute) => attribute.categoryLabel + "：" + attribute.optionLabel).join("｜");
}

/** Attributes that may spawn a real-world task proposal, and only these. */
export function taskAffinityAttributes(profile: FateProfile | null | undefined): FateAttribute[] {
  if (!profile) return [];
  return profile.attributes.filter((attribute) => attribute.taskAffinity);
}

export function describeUnlock(option: WheelOption): string {
  if (option.unlocks.length === 0) return "";
  const labels: Record<SpecialPool, string> = {
    transmigrator: "穿书者池",
    oldOne: "非人池",
    special: "特殊眷属池",
  };
  return option.unlocks.map((pool) => labels[pool]).join("、") + "已解锁";
}



