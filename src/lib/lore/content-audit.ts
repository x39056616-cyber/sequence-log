import abilitiesRaw from "@/lib/lore/abilities.generated.json";
import entitiesRaw from "@/lib/lore/entities.generated.json";
import auditRaw from "@/lib/lore/lore-audit.generated.json";
import { AUTHOR_CONTENT } from "@/lib/lore/author-content";

type AuditStatus = "author" | "canon" | "undisclosed" | "verified" | "unverified";

interface AbilityRecord {
  pathwayId: string;
  pathwayName: string;
  sequence: number;
  sequenceName: string;
  skillName: string;
  status: "author" | "canon" | "undisclosed";
  sourceKind: "author" | "novel" | "undisclosed";
  authorText: string;
  evidence: Array<{ chapter: string; line: number; quote: string }>;
}

interface EntityRecord {
  name: string;
  citations: Array<{ chapter: string; line: number; quote: string }>;
}

interface EntitiesFile {
  coverage: Record<string, number>;
  figures: EntityRecord[];
  factions: EntityRecord[];
  places: EntityRecord[];
  events: EntityRecord[];
  items: EntityRecord[];
  unverified: Record<string, string[]>;
}

export interface ContentAuditRow {
  id: string;
  category: string;
  name: string;
  status: AuditStatus;
  source: string;
  citationCount: number;
  detail: string;
}

export interface ContentAuditSummary {
  sequences: number;
  withAbilityEvidence: number;
  authorAbilities: number;
  novelAbilities: number;
  undisclosedAbilities: number;
  formulas: number;
  formulaPathways: number;
  entities: Record<string, number>;
  unverified: Record<string, number>;
}

export interface ContentAuditSnapshot {
  generatedAt: string;
  summary: ContentAuditSummary;
  rows: ContentAuditRow[];
  pending: ContentAuditRow[];
}

export interface PendingExportRow {
  category: string;
  pathwayId: string;
  sequence: string;
  name: string;
  missingField: string;
  status: string;
  sourceHint: string;
  reason: string;
}

function asAbilities() {
  return (abilitiesRaw as unknown as { abilities: AbilityRecord[] }).abilities;
}

function asEntities() {
  return entitiesRaw as unknown as EntitiesFile;
}

function sourceLabel(source: string) {
  if (source === "author") return "已核验资料";
  if (source === "novel") return "小说原文";
  if (source === "verified") return "全文核验";
  if (source === "unverified") return "未核验候选";
  return "待补充";
}

export function buildContentAuditSnapshot(): ContentAuditSnapshot {
  const abilities = asAbilities();
  const entities = asEntities();
  const formulaPathways = new Set(AUTHOR_CONTENT.formulas.map((formula) => formula.pathwayId));
  const rows: ContentAuditRow[] = [];

  for (const ability of abilities) {
    rows.push({
      id: `ability-${ability.pathwayId}-${ability.sequence}`,
      category: "能力",
      name: `${ability.pathwayName} · 序列 ${ability.sequence}「${ability.sequenceName}」`,
      status: ability.status,
      source: sourceLabel(ability.sourceKind),
      citationCount: ability.evidence.length,
      detail: ability.status === "undisclosed" ? "作者资料与小说原文均未找到可核验描述" : ability.authorText.slice(0, 60) || ability.evidence[0]?.quote.slice(0, 60) || "",
    });
  }

  for (const formula of AUTHOR_CONTENT.formulas) {
    rows.push({
      id: `formula-${formula.pathwayId}-${formula.sequence}`,
      category: "配方",
      name: `${formula.pathwayId} · 序列 ${formula.sequence}「${formula.sequenceName}」`,
      status: "author",
      source: sourceLabel("author"),
      citationCount: 0,
      detail: formula.main.slice(0, 60),
    });
  }

  const entityGroups: Array<{ key: "figures" | "factions" | "places" | "events" | "items"; label: string }> = [
    { key: "figures", label: "人物" },
    { key: "factions", label: "组织" },
    { key: "places", label: "地点" },
    { key: "events", label: "异常事件" },
    { key: "items", label: "物品" },
  ];

  for (const group of entityGroups) {
    const records = entities[group.key] as EntityRecord[];
    for (const record of records) {
      rows.push({
        id: `${String(group.key)}-${record.name}`,
        category: group.label,
        name: record.name,
        status: "verified",
        source: sourceLabel("verified"),
        citationCount: record.citations.length,
        detail: record.citations[0]?.quote.slice(0, 60) ?? "",
      });
    }
    for (const name of entities.unverified[String(group.key)] ?? []) {
      rows.push({
        id: `${String(group.key)}-unverified-${name}`,
        category: group.label,
        name,
        status: "unverified",
        source: sourceLabel("unverified"),
        citationCount: 0,
        detail: "全文未找到可核验出现，不进入转盘",
      });
    }
  }

  const summary: ContentAuditSummary = {
    sequences: abilities.length,
    withAbilityEvidence: abilities.filter((item) => item.status !== "undisclosed").length,
    authorAbilities: abilities.filter((item) => item.status === "author").length,
    novelAbilities: abilities.filter((item) => item.status === "canon").length,
    undisclosedAbilities: abilities.filter((item) => item.status === "undisclosed").length,
    formulas: AUTHOR_CONTENT.formulas.length,
    formulaPathways: formulaPathways.size,
    entities: {
      figures: entities.figures.length,
      factions: entities.factions.length,
      places: entities.places.length,
      events: entities.events.length,
      items: entities.items.length,
    },
    unverified: {
      figures: entities.unverified.figures?.length ?? 0,
      factions: entities.unverified.factions?.length ?? 0,
      places: entities.unverified.places?.length ?? 0,
      events: entities.unverified.events?.length ?? 0,
      items: entities.unverified.items?.length ?? 0,
    },
  };

  const missingFormulas = (auditRaw as unknown as { formulas: { missingByPathway: Record<string, number[]> } }).formulas.missingByPathway;
  for (const [pathwayId, sequences] of Object.entries(missingFormulas)) {
    for (const sequence of sequences) {
      rows.push({
        id: `formula-missing-${pathwayId}-${sequence}`,
        category: "配方",
        name: `${pathwayId} · 序列 ${sequence}`,
        status: "undisclosed",
        source: sourceLabel("undisclosed"),
        citationCount: 0,
        detail: "作者资料与小说原文尚未核验该配方",
      });
    }
  }

  const pending = rows.filter((row) => row.status === "undisclosed" || row.status === "unverified");
  return {
    generatedAt: new Date().toISOString(),
    summary,
    rows,
    pending,
  };
}

export function toPendingExportRows(snapshot: ContentAuditSnapshot): PendingExportRow[] {
  return snapshot.pending.map((row) => {
    const abilityMatch = row.id.match(/^ability-(.+)-([0-9])$/);
    const formulaMatch = row.id.match(/^formula-(?:missing-)?(.+)-([0-9])$/);
    const match = abilityMatch ?? formulaMatch;
    return {
      category: row.category,
      pathwayId: match?.[1] ?? "",
      sequence: match?.[2] ?? "",
      name: row.name,
      missingField: row.category === "能力" ? "ability" : row.category === "配方" ? "formula" : "citation",
      status: row.status,
      sourceHint: row.source,
      reason: row.detail,
    };
  });
}

function csvCell(value: string | number) {
  const text = String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function pendingRowsToCsv(rows: PendingExportRow[]) {
  const header = ["category", "pathwayId", "sequence", "name", "missingField", "status", "sourceHint", "reason"];
  return [header.join(","), ...rows.map((row) => header.map((key) => csvCell(row[key as keyof PendingExportRow])).join(","))].join("\n");
}