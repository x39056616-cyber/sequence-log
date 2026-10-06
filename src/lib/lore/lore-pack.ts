import entities from "@/lib/lore/entities.generated.json";
import world from "@/lib/lore/world.generated.json";

export interface LorePassage {
  category: string;
  value: string;
  chapter: string;
  line: number;
  quote: string;
}

interface Citation {
  chapter?: string;
  line?: number;
  quote?: string;
}

const ENTITY_INDEX = new Map<string, Citation[]>();
for (const group of ["figures", "factions", "places", "events", "items", "codenames"] as const) {
  const rows = (entities as unknown as Record<string, Array<{ name: string; citations?: Citation[] }>>)[group] ?? [];
  for (const row of rows) ENTITY_INDEX.set(row.name, row.citations ?? []);
}

const WORLD_INDEX = new Map<string, Citation[]>();
for (const era of (world as unknown as { eras: Array<{ name: string; citation?: Citation }> }).eras ?? []) {
  if (era.citation) WORLD_INDEX.set(era.name, [era.citation]);
}
for (const region of (world as unknown as { regions: Array<{ name: string; citation?: Citation }> }).regions ?? []) {
  if (region.citation) WORLD_INDEX.set(region.name, [region.citation]);
}
for (const locality of (world as unknown as { localities: Array<{ name: string; citation?: Citation }> }).localities ?? []) {
  if (locality.citation) WORLD_INDEX.set(locality.name, [locality.citation]);
}

function lookUp(value: string): Citation[] {
  const direct = ENTITY_INDEX.get(value) ?? WORLD_INDEX.get(value);
  if (direct && direct.length > 0) return direct;
  // 兼容「穿书者（进入特殊池）」这类带括号后缀的选项名
  const stripped = value.replace(/（[^）]*）|\([^)]*\)/g, "").trim();
  if (stripped !== value) return ENTITY_INDEX.get(stripped) ?? WORLD_INDEX.get(stripped) ?? [];
  return [];
}

/**
 * 把抽到的命运条目映射成「原作依据」：每条给出处章节/行号 + 原文短引文。
 * 这段内容会被注入提示词，要求模型只依据它来写，不得改写原作设定。
 */
export function buildLorePack(attributes: Array<{ category: string; value: string }>, limitPerAttribute = 2): LorePassage[] {
  const out: LorePassage[] = [];
  const seen = new Set<string>();
  for (const attribute of attributes) {
    const citations = lookUp(attribute.value).slice(0, limitPerAttribute);
    for (const citation of citations) {
      const quote = (citation.quote ?? "").trim();
      if (!quote || quote.length < 6) continue;
      const key = attribute.value + "|" + quote.slice(0, 40);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        category: attribute.category,
        value: attribute.value,
        chapter: citation.chapter ?? "",
        line: citation.line ?? 0,
        quote: quote.slice(0, 220),
      });
    }
  }
  return out.slice(0, 16);
}

export function formatLorePack(pack: LorePassage[]): string {
  if (pack.length === 0) return "（本次没有检索到对应的原作依据，请保持克制，不要新增具体设定。）";
  return pack
    .map((item) => `- 【${item.category}：${item.value}】${item.chapter ? item.chapter + " " : ""}${item.line ? "第" + item.line + "行：" : ""}“${item.quote}”`)
    .join("\n");
}
