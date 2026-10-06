import { promises as fs } from "node:fs";
import path from "node:path";

interface Paragraph { chapter: string; text: string; score: number }

let cache: { chapters: Array<{ title: string; paras: string[] }> } | null = null;

async function loadIndex() {
  if (cache) return cache;
  const file = path.join(process.cwd(), "public", "lore", "novel-index.json");
  const raw = await fs.readFile(file, "utf8");
  cache = JSON.parse(raw) as { chapters: Array<{ title: string; paras: string[] }> };
  return cache;
}

/** 去掉「（进入特殊池）」这类转盘标注，只保留可在原文中检索的词。 */
function cleanTerm(term: string) {
  return term.replace(/[（(][^）)]*[）)]/g, "").replace(/[「」“”"]/g, "").trim();
}

/**
 * 在原文里检索与本次生成最相关的段落。
 * 评分 = 命中的不同关键词数 × 权重 + 关键词出现次数；稀有词权重更高。
 */
export async function searchNovel(terms: string[], options: { limit?: number; maxChars?: number } = {}): Promise<Paragraph[]> {
  const limit = options.limit ?? 10;
  const maxChars = options.maxChars ?? 700;
  const keywords = [...new Set(terms.map(cleanTerm).filter((term) => term.length >= 2))].slice(0, 12);
  if (keywords.length === 0) return [];

  const index = await loadIndex().catch(() => null);
  if (!index) return [];

  const hits: Paragraph[] = [];
  for (const chapter of index.chapters) {
    for (const para of chapter.paras) {
      if (para.length < 40) continue;
      let distinct = 0;
      let occurrences = 0;
      for (const keyword of keywords) {
        const count = para.split(keyword).length - 1;
        if (count > 0) {
          distinct += 1;
          occurrences += count;
        }
      }
      if (distinct === 0) continue;
      // 多关键词命中优先；单个关键词要求至少出现一次且有足够信息量
      const score = distinct * 100 + occurrences * 10 + Math.min(para.length, 400) / 100;
      hits.push({ chapter: chapter.title, text: para.slice(0, maxChars), score });
    }
  }

  hits.sort((a, b) => b.score - a.score);
  const picked: Paragraph[] = [];
  const seen = new Set<string>();
  for (const hit of hits) {
    const key = hit.text.slice(0, 60);
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(hit);
    if (picked.length >= limit) break;
  }
  return picked;
}

/** 从背景生成请求里推导检索词。 */
export function termsFromBackground(input: {
  pathwayName?: string;
  sequenceName?: string;
  fateAttributes?: Array<{ category: string; value: string }>;
}): string[] {
  const terms: string[] = [];
  if (input.sequenceName) terms.push(input.sequenceName);
  if (input.pathwayName) terms.push(input.pathwayName);
  for (const attribute of input.fateAttributes ?? []) {
    const category = attribute.category;
    if (category === "身份类型") continue; // 转盘自造概念，原文里没有
    if (category === "异常事件") continue; // 术语已在结构化依据里给过
    terms.push(attribute.value);
  }
  return terms;
}

/** 从多轮叙事的上下文里推导检索词。 */
export function termsFromContext(context: Record<string, unknown>): string[] {
  const terms: string[] = [];
  const state = context.state as { sequenceName?: string; pathway?: string } | undefined;
  if (state?.sequenceName) terms.push(state.sequenceName);
  if (state?.pathway) terms.push(state.pathway);
  const fate = context.fate as { attributes?: Array<{ category: string; value: string }> } | null | undefined;
  for (const attribute of fate?.attributes ?? []) terms.push(attribute.value);
  const worldState = context.worldState as undefined;
  void worldState;
  return terms;
}
