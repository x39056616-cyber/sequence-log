import rawEvidence from "@/lib/lore/evidence.generated.json";

export type LoreEvidenceKind = "formula" | "acting" | "ritual" | "ability" | "mention";
export interface LoreEvidenceItem {
  chapter: string;
  line: number;
  kind: LoreEvidenceKind;
  quote: string;
  source: string;
}
export interface LoreEvidenceRecord {
  pathwayId: string;
  pathwayName: string;
  sequence: number;
  name: string;
  evidence: LoreEvidenceItem[];
}
interface EvidenceFile {
  schemaVersion: 1;
  generatedAt: string;
  source: {
    title: string;
    author: string;
    fileName: string;
    sha256: string;
    characters: number;
    lines: number;
    chapters: number;
    note: string;
  };
  coverage: { sequences: number; withEvidence: number; evidenceItems: number };
  sequences: Record<string, LoreEvidenceRecord>;
}
export const LORE_EVIDENCE = rawEvidence as EvidenceFile;
export const LORE_EVIDENCE_LABEL: Record<LoreEvidenceKind, string> = {
  formula: "配方",
  acting: "扮演",
  ritual: "仪式",
  ability: "能力",
  mention: "提及",
};
export function getLoreEvidence(pathwayId: string, sequence: number) {
  return LORE_EVIDENCE.sequences[pathwayId + "-" + sequence] ?? null;
}
export function getLoreEvidenceCoverage(pathwayId: string) {
  const records = Object.values(LORE_EVIDENCE.sequences).filter((item) => item.pathwayId === pathwayId);
  return { total: records.length, withEvidence: records.filter((item) => item.evidence.length > 0).length };
}
