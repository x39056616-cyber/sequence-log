import raw from "@/lib/lore/abilities.generated.json";
import type { WheelCitation } from "@/lib/types";

export type AbilityStatus = "author" | "canon" | "undisclosed";
export type AbilitySourceKind = "author" | "novel" | "undisclosed";

export interface SequenceAbility {
  pathwayId: string;
  pathwayName: string;
  sequence: number;
  sequenceName: string;
  skillName: string;
  status: AbilityStatus;
  sourceKind: AbilitySourceKind;
  authorText: string;
  evidence: Array<{ chapter: string; line: number; quote: string }>;
}

interface AbilitiesFile {
  schemaVersion: number;
  generatedAt: string;
  note: string;
  coverage: {
    sequences: number;
    withAbilityEvidence: number;
    withAuthorAbility: number;
    withNovelEvidence: number;
    undisclosed: number;
  };
  abilities: SequenceAbility[];
}

export const ABILITIES = raw as unknown as AbilitiesFile;
export const ABILITY_COVERAGE = ABILITIES.coverage;

const INDEX = new Map<string, SequenceAbility>(
  ABILITIES.abilities.map((entry) => [entry.pathwayId + "-" + entry.sequence, entry]),
);

export function getSequenceAbility(pathwayId: string | null | undefined, sequence: number | null | undefined): SequenceAbility | null {
  if (!pathwayId || sequence === null || sequence === undefined) return null;
  return INDEX.get(pathwayId + "-" + sequence) ?? null;
}

export function abilityCitations(ability: SequenceAbility | null): WheelCitation[] {
  if (!ability) return [];
  return ability.evidence.map((item) => ({ chapter: item.chapter, line: item.line, quote: item.quote }));
}