import rawAbilities from "@/lib/lore/author-content.generated.json";
import rawWorld from "@/lib/lore/world.generated.json";
import rawSupplement from "@/lib/lore/author-supplement.json";
import type { Formula } from "@/lib/types";

export interface AuthorAbility {
  pathwayId: string;
  fileName: string;
  sequence: number;
  sequenceName: string;
  text: string;
}

export interface WorldRegion {
  name: string;
  eras: string[];
  citation: { chapter?: string; line: number; quote: string };
}

export interface WorldLocality {
  name: string;
  parent: string;
  citation: { chapter?: string; line: number; quote: string };
}

interface AuthorFile {
  schemaVersion: number;
  source: { title: string; fileName: string; kind: string };
  coverage: { pathways: number; abilities: number; formulas: number };
  pathways: string[];
  abilities: AuthorAbility[];
  formulas: Array<{
    pathwayId: string; fileName: string; sequence: number; sequenceName: string;
    main: string; aux: string; potionLook: string; traitLook: string; mythicForm: string;
  }>;
}

interface WorldFile {
  schemaVersion: number;
  coverage: { eras: number; regions: number; localities: number };
  eras: Array<{ name: string; citation: { chapter?: string; line: number; quote: string } }>;
  regions: WorldRegion[];
  localities: WorldLocality[];
  unverified: Record<string, string[]>;
}

const GENERATED = rawAbilities as unknown as AuthorFile;
/** 手工补录（如用户提供的审判者配方）与自动解析结果合并；同名条目以补录为准。 */
const SUPPLEMENT = rawSupplement as unknown as { formulas: AuthorFile["formulas"] };
const MERGED_FORMULAS = [
  ...(SUPPLEMENT.formulas ?? []),
  ...GENERATED.formulas.filter((formula) => !(SUPPLEMENT.formulas ?? []).some((extra) => extra.pathwayId === formula.pathwayId && extra.sequence === formula.sequence)),
];

export const AUTHOR_CONTENT: AuthorFile = {
  ...GENERATED,
  formulas: MERGED_FORMULAS,
  coverage: { ...GENERATED.coverage, formulas: MERGED_FORMULAS.length },
  pathways: [...new Set([...GENERATED.pathways, ...MERGED_FORMULAS.map((formula) => formula.pathwayId)])],
};
export const WORLD = rawWorld as unknown as WorldFile;

const ABILITY_INDEX = new Map<string, AuthorAbility>(
  AUTHOR_CONTENT.abilities.map((entry) => [entry.pathwayId + "-" + entry.sequence, entry]),
);

export function getAuthorAbility(pathwayId: string | null | undefined, sequence: number | null | undefined): AuthorAbility | null {
  if (!pathwayId || sequence === null || sequence === undefined) return null;
  return ABILITY_INDEX.get(pathwayId + "-" + sequence) ?? null;
}

/** 作者发布的配方（静态读取，不依赖数据库，保证界面一定能看到）。 */
export function getAuthorFormula(pathwayId: string | null | undefined, sequence: number | null | undefined): Formula | null {
  if (!pathwayId || sequence === null || sequence === undefined) return null;
  const hit = AUTHOR_CONTENT.formulas.find((formula) => formula.pathwayId === pathwayId && formula.sequence === sequence);
  if (!hit) return null;
  return {
    id: hit.pathwayId + "-" + hit.sequence,
    pathwayId: hit.pathwayId,
    sequence: hit.sequence,
    sequenceName: hit.sequenceName,
    main: hit.main,
    auxiliary: hit.aux,
    potionLook: hit.potionLook,
    traitLook: hit.traitLook,
    mythicForm: hit.mythicForm,
    sourceKind: "author" as const,
  };
}

/** 有作者配方的途径 id 列表（用于界面提示与默认选中）。 */
export function pathwaysWithFormulas(): string[] {
  return [...new Set(AUTHOR_CONTENT.formulas.map((formula) => formula.pathwayId))];
}

export function listFormulas(pathwayId: string): Formula[] {
  return AUTHOR_CONTENT.formulas
    .filter((formula) => formula.pathwayId === pathwayId)
    .map((formula) => ({
      id: formula.pathwayId + "-" + formula.sequence,
      pathwayId: formula.pathwayId,
      sequence: formula.sequence,
      sequenceName: formula.sequenceName,
      main: formula.main,
      auxiliary: formula.aux,
      potionLook: formula.potionLook,
      traitLook: formula.traitLook,
      mythicForm: formula.mythicForm,
      sourceKind: "author" as const,
    }))
    .sort((a, b) => b.sequence - a.sequence);
}

export function regionsForEra(eraName: string): WorldRegion[] {
  return WORLD.regions.filter((region) => region.eras.includes(eraName));
}

export function localitiesForRegion(regionName: string): WorldLocality[] {
  return WORLD.localities.filter((locality) => locality.parent === regionName);
}

/** 早期纪元没有具体城市时，落回该纪元的标志性地点。 */
export function landmarkForRegion(regionName: string): WorldLocality[] {
  return [{ name: regionName, parent: regionName, citation: { line: 0, quote: "" } }];
}




