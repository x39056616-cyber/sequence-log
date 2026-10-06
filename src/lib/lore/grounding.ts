import { LORE_EVIDENCE } from "@/lib/lore/evidence";
import { getSequenceAbility } from "@/lib/lore/abilities";
import { getAuthorFormula } from "@/lib/lore/author-content";
import { AUTHOR_CONTENT } from "@/lib/lore/author-content";
import { WORLD } from "@/lib/lore/author-content";
import entities from "@/lib/lore/entities.generated.json";
import { getPathway, getSequence } from "@/lib/lore/pathways";
import type { SequenceRank } from "@/lib/types";

interface FateAttributeLike {
  categoryId: string;
  optionLabel: string;
}

const ENTITIES = entities as unknown as {
  figures: Array<{ name: string; citations: Array<{ chapter: string; line: number; quote: string }> }>;
  factions: Array<{ name: string; citations: Array<{ chapter: string; line: number; quote: string }> }>;
  places: Array<{ name: string; citations: Array<{ chapter: string; line: number; quote: string }> }>;
  items: Array<{ name: string; citations: Array<{ chapter: string; line: number; quote: string }> }>;
  codenames: Array<{ name: string; citations: Array<{ chapter: string; line: number; quote: string }> }>;
};

function cite(chapter: string, line: number) {
  return chapter ? `${chapter} · 行 ${line}` : `行 ${line}`;
}

function firstCitation(list: Array<{ name: string; citations: Array<{ chapter: string; line: number; quote: string }> }>, name: string) {
  return list.find((entry) => entry.name === name)?.citations?.[0];
}

/**
 * 从本地核验索引里，为这一次生成抽取「原著依据包」。
 * 只包含短引文与章节行号，不包含全文——既能让 AI 不跑偏，也不触发全文分发问题。
 */
export function buildLoreGrounding(input: {
  pathwayId: string | null;
  sequence: number;
  fateAttributes?: FateAttributeLike[];
}): string[] {
  const lines: string[] = [];
  const pathway = getPathway(input.pathwayId);
  const sequence = getSequence(input.pathwayId, input.sequence as SequenceRank);

  if (pathway && sequence) {
    lines.push(`主角途径：${pathway.name}途径（对应塔罗：${pathway.tarot}），当前序列 ${input.sequence}「${sequence.name}」。`);
  }

  // 1) 该序列的能力证据
  const ability = getSequenceAbility(input.pathwayId, input.sequence);
  if (ability?.evidence?.length) {
    for (const item of ability.evidence.slice(0, 2)) {
      lines.push(`能力原文（${cite(item.chapter ?? "", item.line)}）：“${item.quote.slice(0, 180)}”`);
    }
  }

  // 2) 作者补充设定里的能力/配方
  const authorAbility = AUTHOR_CONTENT.abilities.find((entry) => entry.pathwayId === input.pathwayId && entry.sequence === input.sequence);
  if (authorAbility?.text) {
    lines.push(`作者补充设定·能力（${authorAbility.sequenceName}）：${authorAbility.text.replace(/\n+/g, " ").slice(0, 300)}`);
  }
  const formula = getAuthorFormula(input.pathwayId, input.sequence);
  if (formula && (formula.main || formula.auxiliary)) {
    lines.push(`作者补充设定·魔药配方：主材料 ${formula.main || "未披露"}；辅助材料 ${formula.auxiliary || "未披露"}。`);
  }

  // 3) 从全文证据索引里补该序列的兜底引文
  const evidence = LORE_EVIDENCE.sequences[`${input.pathwayId}-${input.sequence}`];
  for (const item of (evidence?.evidence ?? []).slice(0, 2)) {
    const entry = `原文证据（${cite(item.chapter, item.line)}）：“${item.quote.slice(0, 160)}”`;
    if (!lines.includes(entry)) lines.push(entry);
  }

  // 4) 命运各条目的原著依据
  for (const attribute of input.fateAttributes ?? []) {
    const label = attribute.optionLabel;
    if (attribute.categoryId === "era") {
      const era = WORLD.eras.find((item) => item.name === label);
      if (era?.citation?.quote) lines.push(`年代依据（${cite(era.citation.chapter ?? "", era.citation.line)}）：“${era.citation.quote.slice(0, 140)}”`);
    } else if (attribute.categoryId === "region") {
      const region = WORLD.regions.find((item) => item.name === label);
      if (region?.citation?.quote) lines.push(`大地点依据（${cite(region.citation.chapter ?? "", region.citation.line)}）：“${region.citation.quote.slice(0, 140)}”`);
    } else if (attribute.categoryId === "locality") {
      const locality = WORLD.localities.find((item) => item.name === label);
      if (locality?.citation?.quote) lines.push(`小地点依据（${cite(locality.citation.chapter ?? "", locality.citation.line)}）：“${locality.citation.quote.slice(0, 140)}”`);
    } else if (attribute.categoryId === "faction") {
      const hit = firstCitation(ENTITIES.factions, label);
      if (hit) lines.push(`阵营依据（${cite(hit.chapter, hit.line)}）：“${hit.quote.slice(0, 140)}”`);
    } else if (attribute.categoryId === "encounter") {
      const hit = firstCitation(ENTITIES.figures, label);
      if (hit) lines.push(`遭遇人物依据（${cite(hit.chapter, hit.line)}）：“${hit.quote.slice(0, 140)}”`);
    } else if (attribute.categoryId === "relic") {
      const hit = firstCitation(ENTITIES.items, label);
      if (hit) lines.push(`随身物依据（${cite(hit.chapter, hit.line)}）：“${hit.quote.slice(0, 140)}”`);
    } else if (attribute.categoryId === "codename") {
      const hit = firstCitation(ENTITIES.codenames, label);
      if (hit) lines.push(`代号依据（${cite(hit.chapter, hit.line)}）：“${hit.quote.slice(0, 140)}”`);
    }
  }

  return lines.slice(0, 16);
}

