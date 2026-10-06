import entities from "@/lib/lore/entities.generated.json";
import { WORLD } from "@/lib/lore/author-content";
import geoExtra from "@/lib/lore/geo-extra.json";
import type { WheelCategory, WheelCitation, WheelOption, WheelPool, WheelSourceKind } from "@/lib/types";

interface EntityRecord {
  name: string;
  citations: WheelCitation[];
}

const ENTITIES = entities as unknown as {
  schemaVersion: number;
  figures: EntityRecord[];
  factions: EntityRecord[];
  places: EntityRecord[];
  events: EntityRecord[];
  items: EntityRecord[];
  codenames: EntityRecord[];
};

export interface WheelCategoryPreset {
  id: string;
  label: string;
  description: string;
  order: number;
  gate: boolean;
  taskAffinityAllowed: boolean;
  sourceKind: WheelSourceKind;
  sourceNote: string;
}

export interface WheelOptionPreset {
  id: string;
  categoryId: string;
  label: string;
  description: string;
  order: number;
  pool: WheelPool;
  unlocks: Array<Exclude<WheelPool, "default">>;
  taskAffinity: boolean;
  parentId?: string;
  eraIds?: string[];
  weight?: number;
  nonCanon?: boolean;
  sourceKind: WheelSourceKind;
  sourceNote: string;
  citations: WheelCitation[];
}

/**
 * 抽取顺序：身份类型（闸门）→ 年代 → 大地点 → 小地点 → 阵营 → 遭遇 → 异常事件 → 随身物 → 代号。
 * 代号依赖阵营，因此排在阵营之后。
 */
export const WHEEL_CATEGORY_PRESETS: WheelCategoryPreset[] = [
  { id: "identity", label: "身份类型", description: "你在世界中的存在方式。抽到非人身份会解锁其他类别的特殊池。", order: 0, gate: true, taskAffinityAllowed: false, sourceKind: "video-preset", sourceNote: "转盘二创预设（参考《诡秘转盘》01/13 集开场扇区）" },
  { id: "era", label: "年代", description: "故事发生在哪个纪元。第五纪是原著主线年代；更早的纪元属于历史/文献线。", order: 1, gate: false, taskAffinityAllowed: false, sourceKind: "canon-reference", sourceNote: "原著纪元（本地全文核验）" },
  { id: "continent", label: "大陆", description: "故事发生在哪块大陆。", order: 2, gate: false, taskAffinityAllowed: false, sourceKind: "canon-reference", sourceNote: "原著大陆（本地全文核验）" },
  { id: "region", label: "国家与帝国", description: "国家或大区域，按纪元过滤：第四纪只出第四纪帝国，第五纪只出当代诸国。", order: 2, gate: false, taskAffinityAllowed: false, sourceKind: "canon-reference", sourceNote: "原著国家与区域（本地全文核验）" },
  { id: "locality", label: "小地点", description: "具体城市与地标，受大地点约束——不会出现「因蒂斯共和国的贝克兰德」。", order: 3, gate: false, taskAffinityAllowed: true, sourceKind: "canon-reference", sourceNote: "原著城市与地标（本地全文核验）" },
  { id: "faction", label: "阵营与教会", description: "你被卷入或被接纳的组织。仅影响叙事与人物关系。", order: 4, gate: false, taskAffinityAllowed: false, sourceKind: "canon-reference", sourceNote: "原作组织（本地全文核验，附章节行号）" },
  { id: "encounter", label: "开局遭遇", description: "开局可能与谁产生交集。仅决定叙事中的相遇，不改变你的途径与序列。", order: 5, gate: false, taskAffinityAllowed: false, sourceKind: "canon-figure", sourceNote: "原作人物（本地全文核验，附章节行号）" },
  { id: "event", label: "异常事件", description: "本章的非凡异象。直接取自原作术语，由 AI 展开成具体情境。", order: 6, gate: false, taskAffinityAllowed: false, sourceKind: "canon-reference", sourceNote: "原作术语（本地全文核验，附章节行号）" },
  { id: "relic", label: "随身物与封印物", description: "你身上带着的东西。会写进人物档案的「随身物」，并成为剧情线索。", order: 7, gate: false, taskAffinityAllowed: false, sourceKind: "canon-item", sourceNote: "原作物品（本地全文核验，附章节行号）" },
  { id: "codename", label: "代号", description: "按你抽到的阵营生成：塔罗会出塔罗代号，教会出该教会的职阶称谓。", order: 8, gate: false, taskAffinityAllowed: false, sourceKind: "canon-tarot", sourceNote: "原著职阶与代号（本地全文核验）" },
];

/**
 * 纪元归属：原著里这些组织/人物/物品明确出现在哪些年代。
 * 默认只出现在第五纪（原著主线年代）——第一至第四纪不会出现当代教会与组织。
 */
const MODERN_ERA = ["第五纪"];
const ERA_BY_FACTION: Record<string, string[]> = {
  // 第四纪就已存在的古老家族/帝国机构
  安提哥努斯家族: ["第四纪", "第五纪"],
  亚伯拉罕家族: ["第四纪", "第五纪"],
  // 其余当代组织（教会、学会、公司等）都只在第五纪出现
};
const ERA_BY_FIGURE: Record<string, string[]> = {
  阿蒙: ["第四纪", "第五纪"],
  安提哥努斯: ["第四纪", "第五纪"],
  罗塞尔: ["第五纪"],
  亚当: ["第四纪", "第五纪"],
};
const ERA_BY_RELIC: Record<string, string[]> = {
  魔药: ["第四纪", "第五纪"],
  日记: ["第五纪"],
};
const IDENTITY_OPTIONS: WheelOptionPreset[] = [
  { id: "identity-local", categoryId: "identity", label: "本地人", description: "你原本就属于这个世界，没有穿越或异常来源。", order: 0, pool: "default", unlocks: [], taskAffinity: false, sourceKind: "video-preset", sourceNote: "转盘二创预设", citations: [] },
  { id: "identity-transmigrator", categoryId: "identity", label: "穿书者（进入特殊池）", description: "你带着前世的记忆进入这个世界，解锁穿书者专属选项。", order: 1, pool: "default", unlocks: ["transmigrator"], taskAffinity: false, sourceKind: "video-preset", sourceNote: "转盘二创预设", citations: [] },
  { id: "identity-old-one", categoryId: "identity", label: "旧日眷属（非人特殊）", description: "你与旧日支配者存在血脉或契约关系，解锁非人视角选项。", order: 2, pool: "default", unlocks: ["oldOne"], taskAffinity: false, sourceKind: "video-preset", sourceNote: "转盘二创预设", citations: [] },
  { id: "identity-special-kin", categoryId: "identity", label: "特殊眷属（非人特殊）", description: "你的存在介于人类与神话生物之间，解锁特殊眷属选项。", order: 3, pool: "default", unlocks: ["special"], taskAffinity: false, sourceKind: "video-preset", sourceNote: "转盘二创预设", citations: [] },
];

/** 年代：第五纪权重 4、其余各 1 → 第五纪约占 50%。 */
const ERA_WEIGHTS: Record<string, number> = { 第一纪: 1, 第二纪: 1, 第三纪: 1, 第四纪: 1, 第五纪: 4 };
const ERA_NOTES: Record<string, string> = {
  第一纪: "远古纪元，属于历史/文献线。",
  第二纪: "古神与巨人时代，属于历史/文献线。",
  第三纪: "属于历史/文献线。",
  第四纪: "四皇之战前后的帝国时代，属于历史/文献线。",
  第五纪: "原著主线年代（约 1340–1370 年）。",
};
const ERA_OPTIONS: WheelOptionPreset[] = WORLD.eras.map((era, index) => ({
  id: "era-" + index,
  categoryId: "era",
  label: era.name,
  description: ERA_NOTES[era.name] ?? "原著纪元。",
  order: index,
  pool: "default" as WheelPool,
  unlocks: [],
  taskAffinity: false,
  weight: ERA_WEIGHTS[era.name] ?? 1,
  sourceKind: "canon-reference" as WheelSourceKind,
  sourceNote: "原著纪元（本地全文核验）",
  citations: era.citation?.quote ? [{ chapter: era.citation.chapter ?? "", line: era.citation.line, quote: era.citation.quote }] : [],
}));

const CONTINENT_OF: Record<string, string> = {
  鲁恩王国: "北大陆", 因蒂斯共和国: "北大陆", 弗萨克帝国: "北大陆", 间海郡: "北大陆", 北大陆: "北大陆",
  南大陆: "南大陆", 罗思德群岛: "南大陆", 白银城: "南大陆", 神弃之地: "南大陆",
  所罗门帝国: "北大陆", 图铎帝国: "北大陆", 特伦索斯特帝国: "北大陆", 混沌海: "北大陆",
};

const CONTINENT_OPTIONS: WheelOptionPreset[] = [
  { id: "continent-north", categoryId: "continent", label: "北大陆", description: "鲁恩、因蒂斯、弗萨克等王国所在的北方大陆。", order: 0, pool: "default", unlocks: [], taskAffinity: false, eraIds: ["第四纪", "第五纪"], sourceKind: "canon-reference", sourceNote: "原著大陆（本地全文核验）", citations: (WORLD.regions.find((region) => region.name === "北大陆")?.citation ? [{ chapter: WORLD.regions.find((region) => region.name === "北大陆")!.citation.chapter ?? "", line: WORLD.regions.find((region) => region.name === "北大陆")!.citation.line, quote: WORLD.regions.find((region) => region.name === "北大陆")!.citation.quote }] : []) },
  { id: "continent-south", categoryId: "continent", label: "南大陆", description: "拜亚姆与罗思德群岛所在的南方大陆。", order: 1, pool: "default", unlocks: [], taskAffinity: false, eraIds: ["第四纪", "第五纪"], sourceKind: "canon-reference", sourceNote: "原著大陆（本地全文核验）", citations: (WORLD.regions.find((region) => region.name === "南大陆")?.citation ? [{ chapter: WORLD.regions.find((region) => region.name === "南大陆")!.citation.chapter ?? "", line: WORLD.regions.find((region) => region.name === "南大陆")!.citation.line, quote: WORLD.regions.find((region) => region.name === "南大陆")!.citation.quote }] : []) },
];

const REGION_OPTIONS: WheelOptionPreset[] = WORLD.regions.map((region, index) => ({
  id: "region-" + index,
  categoryId: "region",
  label: region.name,
  description: region.name + "。出现于 " + region.eras.join("、") + "。",
  order: index,
  pool: "default" as WheelPool,
  unlocks: [],
  taskAffinity: false,
  eraIds: region.eras,
  parentId: CONTINENT_OF[region.name],
  sourceKind: "canon-reference" as WheelSourceKind,
  sourceNote: "原著国家与区域（本地全文核验）",
  citations: region.citation?.quote ? [{ chapter: region.citation.chapter ?? "", line: region.citation.line, quote: region.citation.quote }] : [],
}));

/** 小地点：parentId = 大地点名；没有具体城市的区域落回该区域本身。 */
const LOCALITY_OPTIONS: WheelOptionPreset[] = (() => {
  const rows: WheelOptionPreset[] = [];
  WORLD.regions.forEach((region) => {
    const children = WORLD.localities.filter((locality) => locality.parent === region.name);
    // 没有已核验子城市的区域，回落到区域本身作为标志性地点，并继承该区域的引用。
    const pool = children.length > 0 ? children : [{ name: region.name, parent: region.name, citation: region.citation }];
    pool.forEach((locality, index) => {
      rows.push({
        id: `locality-${region.name}-${index}`,
        categoryId: "locality",
        label: locality.name,
        description: children.length > 0 ? `${locality.name}，位于${region.name}。` : `${region.name}的标志性地点。`,
        order: rows.length,
        pool: "default" as WheelPool,
        unlocks: [],
        taskAffinity: true,
        parentId: region.name,
        sourceKind: "canon-reference" as WheelSourceKind,
        sourceNote: "原著城市与地标（本地全文核验）",
        citations: locality.citation?.quote ? [{ chapter: locality.citation.chapter ?? "", line: locality.citation.line, quote: locality.citation.quote }] : [],
      });
    });
  });
  // 原著没写明的城市：AI 按维多利亚秘教风格补写，标注「非原作地名」。
  for (const extra of (geoExtra as { places: Array<{ name: string; parent: string }> }).places) {
    rows.push({
      id: `locality-extra-${extra.parent}-${extra.name}`,
      categoryId: "locality",
      label: extra.name,
      description: `${extra.name}，位于${extra.parent}。（非原作地名，AI 按风格补写）`,
      order: 500 + rows.length,
      pool: "default" as WheelPool,
      unlocks: [],
      taskAffinity: true,
      parentId: extra.parent,
      nonCanon: true,
      sourceKind: "authored" as WheelSourceKind,
      sourceNote: "AI 按原著风格补写（非原作地名）",
      citations: [],
    });
  }
  return rows;
})();

function fromEntities(
  categoryId: string,
  records: EntityRecord[],
  sourceKind: WheelSourceKind,
  sourceNote: string,
  describe: (name: string) => string,
  taskAffinity = false,
): WheelOptionPreset[] {
  return records.map((record, index) => ({
    id: categoryId + "-" + index,
    categoryId,
    label: record.name,
    description: describe(record.name),
    order: index,
    pool: "default" as WheelPool,
    unlocks: [],
    taskAffinity,
    sourceKind,
    sourceNote,
    citations: record.citations.map((item) => ({ chapter: item.chapter, line: item.line, quote: item.quote })),
  }));
}

const ENCOUNTER_OPTIONS = fromEntities("encounter", ENTITIES.figures, "canon-figure", "原作人物（本地全文核验）", (name) => "开局可能与" + name + "产生交集。相遇方式由叙事决定，不改变你的途径与序列。")
  .map((option) => ({ ...option, eraIds: ERA_BY_FIGURE[option.label] ?? MODERN_ERA }));
const ANOMALY_OPTIONS = fromEntities("event", ENTITIES.events, "canon-reference", "原作术语（本地全文核验）", (name) => "以「" + name + "」为核心的非凡异象，会由叙事展开成具体的本章情境。");
const FACTION_OPTIONS = fromEntities("faction", ENTITIES.factions, "canon-reference", "原作组织（本地全文核验）", (name) => name + "。相关记录可在亵渎石板中核验。")
  .map((option) => ({ ...option, eraIds: ERA_BY_FACTION[option.label] ?? MODERN_ERA }));
const RELIC_OPTIONS = fromEntities("relic", ENTITIES.items, "canon-item", "原作物品（本地全文核验）", (name) => "与「" + name + "」相关的随身之物，会成为人物档案里的线索。")
  .map((option) => ({ ...option, eraIds: ERA_BY_RELIC[option.label] ?? MODERN_ERA }));

/** 各阵营的原著职阶称谓（均已全文核验）；没有核验到的阵营回落到阵营名本身。 */
export const FACTION_CODENAMES: Record<string, string[]> = {
  风暴教会: ["代罚者", "惩戒骑士", "风暴主教"],
  黑夜教会: ["红手套", "值夜者", "大主教"],
  黑夜女神教会: ["红手套", "值夜者"],
  蒸汽与机械之神教会: ["机械之心"],
  大地母神教会: ["丰收祭司", "大主教"],
  知识与智慧之神教会: ["学者"],
  永恒烈阳教会: ["太阳圣者"],
  // 只保留在「代号/塔罗会」语境里核验通过的塔罗代号（恋人/女祭司/战车未能核验，故不提供）
  塔罗会: ["愚者", "倒吊人", "正义", "太阳", "魔术师", "世界", "月亮", "隐者", "审判", "死神", "皇后", "皇帝", "教皇", "力量", "命运之轮", "塔", "恶魔", "星星", "节制"],
  玫瑰学派: ["恩赐", "玫瑰学派成员"],
  生命学派: ["生命学派成员"],
  值夜者: ["值夜者"],
  机械之心: ["机械之心成员", "专员"],
  心理炼金会: ["心理炼金会成员"],
  极光会: ["极光会成员"],
  黑荆棘安保公司: ["专员"],
  鲁恩王国: ["议员"],
  安提哥努斯家族: ["家族成员"],
  亚伯拉罕家族: ["家族成员"],
};

const CODENAME_OPTIONS: WheelOptionPreset[] = (() => {
  const rows: WheelOptionPreset[] = [];
  for (const faction of ENTITIES.factions) {
    const titles = FACTION_CODENAMES[faction.name] ?? [faction.name];
    titles.forEach((title, index) => {
      rows.push({
        id: `codename-${faction.name}-${index}`,
        categoryId: "codename",
        label: title,
        description: `${title}——${faction.name}的称谓。`,
        order: rows.length,
        pool: "default" as WheelPool,
        unlocks: [],
        taskAffinity: false,
        parentId: faction.name,
        eraIds: MODERN_ERA,
        sourceKind: "canon-tarot" as WheelSourceKind,
        sourceNote: "原著职阶与代号（本地全文核验）",
        citations: faction.citations.map((item) => ({ chapter: item.chapter, line: item.line, quote: item.quote })),
      });
    });
  }
  return rows;
})();

const SPECIAL_POOL_OPTIONS: WheelOptionPreset[] = [
  { id: "encounter-transmigrator-0", categoryId: "encounter", label: "另一位穿书者（穿书者）", description: "开局遇到的不是本世界的人，而是另一个带着前世记忆的存在。", order: 200, pool: "transmigrator", unlocks: [], taskAffinity: false, sourceKind: "authored", sourceNote: "自制叙事装置（穿书者专属）", citations: [] },
  { id: "event-canon-node", categoryId: "event", label: "原著剧情节点（穿书者）", description: "你的行动正好撞上一个原作中的关键节点，历史可能因此改写。", order: 200, pool: "transmigrator", unlocks: [], taskAffinity: false, sourceKind: "authored", sourceNote: "自制叙事装置（穿书者专属）", citations: [] },
  { id: "event-memory-drift", categoryId: "event", label: "记忆错位（穿书者）", description: "前世记忆与本世界认知互相干扰，你短暂分不清自己是谁。", order: 201, pool: "transmigrator", unlocks: [], taskAffinity: false, sourceKind: "authored", sourceNote: "自制叙事装置（穿书者专属）", citations: [] },
  { id: "event-instinct", categoryId: "event", label: "非人本能（非人）", description: "某种非人的直觉先于理智做出反应。", order: 202, pool: "oldOne", unlocks: [], taskAffinity: false, sourceKind: "authored", sourceNote: "自制叙事装置（非人专属）", citations: [] },
  { id: "event-myth-bloom", categoryId: "event", label: "神话形态松脱（非人）", description: "你的神话生物形态出现松脱迹象。", order: 203, pool: "oldOne", unlocks: [], taskAffinity: false, sourceKind: "authored", sourceNote: "自制叙事装置（非人专属）", citations: [] },
  { id: "locality-between-gap", categoryId: "locality", label: "两界间隙（特殊眷属）", description: "不在任何地图上的地点，只有特殊眷属能抵达。", order: 300, pool: "special", unlocks: [], taskAffinity: false, sourceKind: "authored", sourceNote: "自制叙事装置（特殊眷属专属）", citations: [] },
];

export const WHEEL_OPTION_PRESETS: WheelOptionPreset[] = [
  ...IDENTITY_OPTIONS,
  ...ERA_OPTIONS,
  ...CONTINENT_OPTIONS,
  ...REGION_OPTIONS,
  ...LOCALITY_OPTIONS,
  ...FACTION_OPTIONS,
  ...ENCOUNTER_OPTIONS,
  ...ANOMALY_OPTIONS,
  ...RELIC_OPTIONS,
  ...CODENAME_OPTIONS,
  ...SPECIAL_POOL_OPTIONS,
];

export function presetCategoryRow(preset: WheelCategoryPreset, now: string): WheelCategory {
  return {
    id: preset.id, label: preset.label, description: preset.description, order: preset.order, builtIn: true,
    gate: preset.gate, taskAffinityAllowed: preset.taskAffinityAllowed, sourceKind: preset.sourceKind,
    sourceNote: preset.sourceNote, createdAt: now, updatedAt: now,
  };
}

export function presetOptionRow(preset: WheelOptionPreset, now: string): WheelOption {
  return {
    id: preset.id, categoryId: preset.categoryId, label: preset.label, description: preset.description,
    order: preset.order, enabled: true, pool: preset.pool, unlocks: preset.unlocks, taskAffinity: preset.taskAffinity,
    parentId: preset.parentId, eraIds: preset.eraIds, weight: preset.weight, nonCanon: preset.nonCanon,
    sourceKind: preset.sourceKind, sourceNote: preset.sourceNote, citations: preset.citations,
    builtIn: true, createdAt: now, updatedAt: now,
  };
}

export const WHEEL_PRESET_VERSION = 3;







