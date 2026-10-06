import type { PotionStage, RealityRequirement, SequenceRank } from "@/lib/types";
import { uid } from "@/lib/utils";

export const ORDERED_SEQUENCES: SequenceRank[] = [9, 8, 7, 6, 5, 4, 3, 2, 1, 0];

export function nextSequence(sequence: SequenceRank): SequenceRank | null {
  const index = ORDERED_SEQUENCES.indexOf(sequence);
  return index >= 0 && index < ORDERED_SEQUENCES.length - 1 ? ORDERED_SEQUENCES[index + 1] : null;
}

export function previousSequence(sequence: SequenceRank): SequenceRank | null {
  const index = ORDERED_SEQUENCES.indexOf(sequence);
  return index > 0 ? ORDERED_SEQUENCES[index - 1] : null;
}

export function requiresRitual(targetSequence: SequenceRank) {
  return targetSequence <= 5;
}

export const STAGE_LABELS: Record<PotionStage, string> = {
  formula: "取得配方",
  materials: "收集现实材料",
  acting: "服食并扮演",
  ritual: "完成晋升仪式",
  ready: "可以晋升",
};

export function initialRealityRequirements(pathwayId: string, sequence: SequenceRank) {
  const now = new Date().toISOString();
  const base: Array<[RealityRequirement["kind"], string, string]> = [
    ["material", "制定现实材料清单", "把原作材料转译成安全、可执行的书籍、课程、工具或练习资源。"],
    ["acting", "写下本序列的扮演守则", "根据原作档案与自身目标，总结三条可观察、不伤害自己或他人的现实守则。"],
    ["anchor", "建立稳定锚点", "选择一个作息、关系或日常仪式，在低稳定度时帮助你恢复。"],
  ];
  const items = base.map(([kind, title, description]) => ({
    id: uid(),
    pathwayId,
    sequence,
    kind,
    title,
    description,
    completed: false,
    createdAt: now,
    updatedAt: now,
  }));
  if (requiresRitual(nextSequence(sequence) ?? sequence)) {
    items.push({
      id: uid(),
      pathwayId,
      sequence,
      kind: "ritual",
      title: "设计安全晋升仪式",
      description: "只使用合法、安全、可复现的现实行动，完成后手动确认。",
      completed: false,
      createdAt: now,
      updatedAt: now,
    });
  }
  return items;
}






