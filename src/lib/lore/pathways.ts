import type { LoreSource, PathwayDefinition, SequenceDefinition, SequenceRank } from "@/lib/types";

const RETRIEVED_AT = "2026-10-03";
const INDEX_SOURCE: LoreSource = {
  title: "诡秘之主 Wiki：非凡途径",
  url: "https://lordofthemysteries.fandom.com/zh/wiki/%E9%9D%9E%E5%87%A1%E9%80%94%E5%BE%84",
  retrievedAt: RETRIEVED_AT,
};
const EN_SOURCE: LoreSource = {
  title: "Lord of the Mysteries Wiki: Pathways",
  url: "https://lordofthemysteries.fandom.com/wiki/Pathways",
  retrievedAt: RETRIEVED_AT,
};
const MOE_SOURCE: LoreSource = {
  title: "萌娘百科：非凡途径",
  url: "https://zh.moegirl.org.cn/%E9%9D%9E%E5%87%A1%E9%80%94%E5%BE%84",
  retrievedAt: RETRIEVED_AT,
};
const SOURCES = [INDEX_SOURCE, EN_SOURCE, MOE_SOURCE];

interface PathwaySeed {
  id: string;
  name: string;
  sequence0: string;
  tarot: string;
  sefirah: string;
  adjacentIds: string[];
  symbol: string;
  names: [string, string, string, string, string, string, string, string, string, string];
}

const SEEDS: PathwaySeed[] = [
  { id: "fool", name: "愚者", sequence0: "愚者", tarot: "愚者 0", sefirah: "源堡", adjacentIds: ["door", "error"], symbol: "eye-thread", names: ["占卜家", "小丑", "魔术师", "无面人", "秘偶大师", "诡法师", "古代学者", "奇迹师", "诡秘侍者", "愚者"] },
  { id: "door", name: "门", sequence0: "门", tarot: "魔术师 I", sefirah: "源堡", adjacentIds: ["fool", "error"], symbol: "door-star", names: ["学徒", "戏法大师", "占星人", "记录官", "旅行家", "秘法师", "漫游者", "旅法师", "星之匙", "门"] },
  { id: "error", name: "错误", sequence0: "错误", tarot: "世界 XXI", sefirah: "源堡", adjacentIds: ["fool", "door"], symbol: "monocle-worm", names: ["偷盗者", "诈骗师", "解密学者", "盗火人", "窃梦家", "寄生者", "欺瞒导师", "命运木马", "时之虫", "错误"] },
  { id: "visionary", name: "空想家", sequence0: "空想家", tarot: "正义 XI", sefirah: "混沌海", adjacentIds: ["sun", "tyrant", "white-tower", "hanged-man"], symbol: "mind-thread", names: ["观众", "读心者", "心理医生", "催眠师", "梦境行者", "操纵师", "织梦人", "洞察者", "作家", "空想家"] },
  { id: "sun", name: "太阳", sequence0: "太阳", tarot: "太阳 XIX", sefirah: "混沌海", adjacentIds: ["visionary", "tyrant", "white-tower", "hanged-man"], symbol: "black-sun", names: ["歌颂者", "祈光人", "太阳神官", "公证人", "光之祭司", "无暗者", "正义导师", "逐光者", "纯白天使", "太阳"] },
  { id: "tyrant", name: "暴君", sequence0: "暴君", tarot: "教皇 V", sefirah: "混沌海", adjacentIds: ["visionary", "sun", "white-tower", "hanged-man"], symbol: "wave-crown", names: ["水手", "暴怒之民", "航海家", "风眷者", "海洋歌者", "灾难主祭", "海王", "天灾", "雷神", "暴君"] },
  { id: "white-tower", name: "白塔", sequence0: "白塔", tarot: "高塔 XVI", sefirah: "混沌海", adjacentIds: ["visionary", "sun", "tyrant", "hanged-man"], symbol: "tower-eye", names: ["阅读者", "推理学员", "守知者", "博学者", "秘术导师", "预言家", "洞悉者", "智天使", "全知之眼", "白塔"] },
  { id: "hanged-man", name: "倒吊人", sequence0: "倒吊人", tarot: "倒吊人 XII", sefirah: "混沌海", adjacentIds: ["visionary", "sun", "tyrant", "white-tower"], symbol: "inverted-crown", names: ["秘祈人", "倾听者", "隐修士", "蔷薇主教", "牧羊人", "黑骑士", "三首圣堂", "秽语长老", "暗天使", "倒吊人"] },
  { id: "darkness", name: "黑暗", sequence0: "黑暗", tarot: "星星 XVII", sefirah: "永暗之河", adjacentIds: ["death", "twilight-giant"], symbol: "eclipse", names: ["不眠者", "午夜诗人", "梦魇", "安魂师", "灵巫", "守夜人", "恐惧主教", "隐秘之仆", "厄难骑士", "黑暗"] },
  { id: "death", name: "死神", sequence0: "死神", tarot: "死神 XIII", sefirah: "永暗之河", adjacentIds: ["darkness", "twilight-giant"], symbol: "pale-serpent", names: ["收尸人", "掘墓人", "通灵者", "死灵导师", "看门人", "不死者", "摆渡人", "死亡执政官", "苍白皇帝", "死神"] },
  { id: "twilight-giant", name: "黄昏巨人", sequence0: "黄昏巨人", tarot: "力量 VIII", sefirah: "永暗之河", adjacentIds: ["darkness", "death"], symbol: "twilight-sword", names: ["战士", "格斗家", "武器大师", "黎明骑士", "守护者", "猎魔者", "银骑士", "荣耀者", "神明之手", "黄昏巨人"] },
  { id: "demoness", name: "原初魔女", sequence0: "原初魔女", tarot: "恋人 VI", sefirah: "灾祸之城", adjacentIds: ["red-priest"], symbol: "mirror-flame", names: ["刺客", "教唆者", "女巫", "欢愉", "痛苦", "绝望", "不老", "灾难", "末日", "原初魔女"] },
  { id: "red-priest", name: "红祭司", sequence0: "红祭司", tarot: "战车 VII", sefirah: "灾祸之城", adjacentIds: ["demoness"], symbol: "red-spear", names: ["猎人", "挑衅者", "纵火家", "阴谋家", "收割者", "铁血骑士", "战争主教", "天气术士", "征服者", "红祭司"] },
  { id: "hermit", name: "隐者", sequence0: "隐者", tarot: "隐者 IX", sefirah: "知识荒野", adjacentIds: ["paragon"], symbol: "lantern-key", names: ["窥秘人", "格斗学者", "巫师", "卷轴教授", "星象师", "神秘学家", "预言大师", "贤者", "知识皇帝", "隐者"] },
  { id: "paragon", name: "完美者", sequence0: "完美者", tarot: "女祭司 II", sefirah: "知识荒野", adjacentIds: ["hermit"], symbol: "gear-eye", names: ["通识者", "考古学家", "鉴定师", "机械专家", "天文学家", "炼金术士", "奥秘学者", "知识导师", "启蒙者", "完美者"] },
  { id: "wheel-of-fortune", name: "命运之轮", sequence0: "命运之轮", tarot: "命运之轮 X", sefirah: "光之钥", adjacentIds: [], symbol: "fortune-wheel", names: ["怪物", "机器", "幸运者", "灾祸教士", "赢家", "厄运法师", "混乱行者", "先知", "水银之蛇", "命运之轮"] },
  { id: "mother", name: "母亲", sequence0: "母亲", tarot: "皇后 III", sefirah: "母巢", adjacentIds: ["moon"], symbol: "earth-root", names: ["耕种者", "医师", "丰收祭司", "生物学家", "德鲁伊", "古代炼金师", "抬棺人", "荒芜主母", "自然行者", "母亲"] },
  { id: "moon", name: "月亮", sequence0: "月亮", tarot: "月亮 XVIII", sefirah: "母巢", adjacentIds: ["mother"], symbol: "red-moon", names: ["药师", "驯兽师", "吸血鬼", "魔药教授", "深红学者", "巫王", "召唤大师", "创生者", "美神", "月亮"] },
  { id: "abyss", name: "深渊", sequence0: "深渊", tarot: "恶魔 XV", sefirah: "暗影世界", adjacentIds: ["chained"], symbol: "abyss-maw", names: ["罪犯", "折翼天使", "连环杀手", "恶魔", "欲望使徒", "魔鬼", "呓语者", "鲜血大公", "污秽君王", "深渊"] },
  { id: "chained", name: "被缚者", sequence0: "被缚者", tarot: "节制 XIV", sefirah: "暗影世界", adjacentIds: ["abyss"], symbol: "chain-moon", names: ["囚犯", "疯子", "狼人", "活尸", "怨魂", "木偶", "沉默门徒", "古代邪物", "神孽", "被缚者"] },
  { id: "black-emperor", name: "黑皇帝", sequence0: "黑皇帝", tarot: "皇帝 IV", sefirah: "失序之国", adjacentIds: ["justiciar"], symbol: "black-crown", names: ["律师", "野蛮人", "贿赂者", "腐化男爵", "混乱导师", "堕落伯爵", "狂乱法师", "熵之公爵", "弑序亲王", "黑皇帝"] },
  { id: "justiciar", name: "审判者", sequence0: "审判者", tarot: "审判 XX", sefirah: "失序之国", adjacentIds: ["black-emperor"], symbol: "scales-blade", names: ["仲裁人", "治安官", "审讯者", "法官", "惩戒骑士", "律令法师", "混乱猎手", "平衡者", "秩序之手", "审判者"] },
];

const FOOL_ACTING: Record<string, string[]> = {
  "占卜家": ["保持对未知的敬畏，不用神秘解释替代现实验证。", "观察、记录、推演，再据此采取行动。"],
  "小丑": ["在压力中保持身体控制和适度幽默，但不否认真实情绪。"],
  "魔术师": ["提前准备，反复演练，让关键行动看起来从容可靠。"],
  "无面人": ["理解不同角色的责任，同时不迷失自己的长期原则。"],
  "秘偶大师": ["用计划和工具组织行动，不操纵或伤害他人。"],
  "诡法师": ["把复杂目标设计成有节奏、有复盘的一次演出。"],
  "古代学者": ["积累长期知识，让过去的记录服务当下判断。"],
  "奇迹师": ["把长期愿望拆成可执行行动，成为自己生活中的破局者。"],
  "诡秘侍者": ["守护自己的隐秘、边界和已经建立的知识体系。"],
  "愚者": ["不夸耀全知，允许未知存在，同时承担自己的选择。"],
};

function buildSequences(seed: PathwaySeed): SequenceDefinition[] {
  const ranks: SequenceRank[] = [9, 8, 7, 6, 5, 4, 3, 2, 1, 0];
  return seed.names.map((name, index) => {
    const sequence = ranks[index];
    const acting = seed.id === "fool" ? FOOL_ACTING[name] ?? [] : [];
    return {
      id: seed.id + "-" + sequence,
      pathwayId: seed.id,
      pathwayName: seed.name,
      sequence,
      name,
      abilities: [name + "的原作能力条目与权柄摘要。", "详细设定正在按来源逐条核验。"],
      mainIngredients: seed.id === "fool" && name === "占卜家" ? ["拉瓦章鱼血液 10 毫升", "星水晶 50 克"] : [],
      auxiliaryIngredients: seed.id === "fool" && name === "占卜家" ? ["纯水 100 毫升", "夜香草汁液 13 滴", "金薄荷叶 7 片", "毒堇汁 3 滴", "龙血草粉末 9 克"] : [],
      actingPrinciples: acting,
      advancementRitual: sequence <= 5 ? "原作存在晋升仪式；现实版本请用安全、合法、可复现的锚定仪式替代。" : null,
      loreStatus: acting.length ? "partial" : "indexed",
      sources: SOURCES,
    };
  });
}

export const PATHWAYS: PathwayDefinition[] = SEEDS.map((seed) => ({
  id: seed.id,
  name: seed.name,
  sequence0: seed.sequence0,
  tarot: seed.tarot,
  sefirah: seed.sefirah,
  adjacentIds: seed.adjacentIds,
  symbol: seed.symbol,
  source: INDEX_SOURCE,
  sequences: buildSequences(seed),
}));

export const SEQUENCES = PATHWAYS.flatMap((pathway) => pathway.sequences);

export function getPathway(pathwayId: string | null | undefined) {
  return PATHWAYS.find((pathway) => pathway.id === pathwayId) ?? null;
}

export function getSequence(pathwayId: string | null | undefined, sequence: SequenceRank) {
  return SEQUENCES.find((item) => item.pathwayId === pathwayId && item.sequence === sequence) ?? null;
}

export function sequenceSearch(query: string) {
  const keyword = query.trim().toLowerCase();
  if (!keyword) return SEQUENCES;
  return SEQUENCES.filter((item) => [item.pathwayName, item.name, String(item.sequence)].some((value) => value.toLowerCase().includes(keyword)));
}

