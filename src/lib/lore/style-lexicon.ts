import raw from "@/lib/lore/style-anchors.generated.json";

export interface StyleAnchor {
  chapter: string;
  para: number;
  scene: string;
  label: string;
  text: string;
}

interface AnchorFile {
  total: number;
  coverage: Record<string, number>;
  anchors: StyleAnchor[];
}

export const STYLE_ANCHORS = raw as unknown as AnchorFile;

/** 关键词 → 场景，用于按当前情境挑选最贴合的风格范例。 */
const SCENE_KEYWORDS: Record<string, string[]> = {
  divination: ["占卜", "仪式", "灵性", "直觉", "灵界"],
  sealed: ["封印物", "失控", "编号", "污染"],
  tarot: ["塔罗会", "代号", "聚会", "先生"],
  daily: ["便士", "苏勒", "房租", "面包", "日常"],
  cost: ["代价", "失控", "危险", "污染"],
  institution: ["教会", "值夜者", "任务", "调查"],
  "divination-failure": ["占卜", "失败", "反噬", "代价", "失控"],
  "tarot-secret": ["塔罗会", "密谈", "交易", "情报", "代号"],
  "church-interrogation": ["教会", "审讯", "审判", "调查", "询问"],
  "poor-quarter": ["贫民", "面包", "便士", "房租", "工人"],
  "characteristic-transfer": ["非凡特性", "转移", "交换", "魔药", "失控"],
  "ritual-preparation": ["仪式", "材料", "蜡烛", "精油", "符咒"],
};

/**
 * 按当前情境挑 4–6 段风格范例（few-shot）：优先命中关键词的场景，不足时用其它场景补齐。
 */
export function pickStyleAnchors(contextText: string, limit = 5): StyleAnchor[] {
  const scored = STYLE_ANCHORS.anchors.map((anchor) => {
    const keywords = SCENE_KEYWORDS[anchor.scene] ?? [];
    const score = keywords.reduce((sum, keyword) => sum + (contextText.includes(keyword) ? 1 : 0), 0);
    return { anchor, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const picked: StyleAnchor[] = [];
  const seenScenes = new Set<string>();
  for (const { anchor } of scored) {
    if (picked.length >= limit) break;
    // 先保证场景多样，再补足数量
    if (seenScenes.has(anchor.scene) && picked.length < Math.min(4, limit)) continue;
    picked.push(anchor);
    seenScenes.add(anchor.scene);
  }
  return picked;
}

export const STYLE_LEXICON = {
  terms: ["序列", "途径", "魔药", "扮演", "消化", "失控", "封印物", "灰雾", "灵性", "占卜", "仪式", "非凡者", "灵界", "污染", "隐秘", "代价"],
  appellations: ["先生", "女士", "小姐", "阁下", "大人", "神父", "牧师"],
  organizations: ["值夜者", "代罚者", "机械之心", "军情九处", "警察厅", "塔罗会", "密修会", "心理炼金会", "教会"],
  objects: ["镑", "苏勒", "便士", "马车", "煤气灯", "手杖", "左轮", "面包", "啤酒"],
  banned: ["首先", "其次", "再者", "总之", "综上", "值得一提的是", "不难看出", "由此可见", "不禁", "宛如", "仿佛", "油然而生", "心中一凛", "与此同时", "值得一提的是"],
  modernBanned: ["手机", "互联网", "电脑", "网络", "微信", "视频", "加班", "地铁", "飞机", "汽车", "酒店", "咖啡", "系统提示", "任务面板", "精神力", "精神值", "美元", "人民币", "欧元", "日元", "块钱", "老板", "经理", "大佬"],
} as const;

/** 供提示词使用：把词表压成一段可读的规则。 */
export function styleRulesForPrompt(): string {
  return [
    `术语必须使用：${STYLE_LEXICON.terms.join("、")}。`,
    `称谓必须使用：${STYLE_LEXICON.appellations.join("、")}；指神性存在必须用「祂」，凡人用「他」。`,
    `机构只能写：${STYLE_LEXICON.organizations.join("、")}。`,
    `器物与货币只能写：${STYLE_LEXICON.objects.join("、")}。`,
    "封印物出现时必须带编号，格式形如 0-08、1-42、2-049。",
    `禁止出现：${STYLE_LEXICON.banned.join("、")}。`,
    `禁止现代词：${STYLE_LEXICON.modernBanned.join("、")}。`,
  ].join("\n");
}
