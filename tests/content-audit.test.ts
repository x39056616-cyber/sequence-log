import { describe, expect, it } from "vitest";
import audit from "@/lib/lore/lore-audit.generated.json";
import { buildContentAuditSnapshot, pendingRowsToCsv, toPendingExportRows } from "@/lib/lore/content-audit";

const snapshot = buildContentAuditSnapshot();
const generated = audit as unknown as {
  summary: { sequences: number; withAbilityEvidence: number; undisclosed: number; formulaTotal: number };
  formulas: { missingByPathway: Record<string, number[]> };
};

describe("content audit", () => {
  it("matches the generated audit summary", () => {
    expect(snapshot.summary.sequences).toBe(generated.summary.sequences);
    expect(snapshot.summary.withAbilityEvidence).toBe(generated.summary.withAbilityEvidence);
    expect(snapshot.summary.undisclosedAbilities).toBe(generated.summary.undisclosed);
    expect(snapshot.summary.formulas).toBe(generated.summary.formulaTotal);
  });

  it("keeps every pending row explicitly pending and exportable", () => {
    expect(snapshot.pending.length).toBeGreaterThan(0);
    for (const row of snapshot.pending) {
      expect(["undisclosed", "unverified"]).toContain(row.status);
      expect(row.detail.length).toBeGreaterThan(0);
    }
    const exportRows = toPendingExportRows(snapshot);
    expect(exportRows).toHaveLength(snapshot.pending.length);
    const csv = pendingRowsToCsv(exportRows);
    const lines = csv.split("\n").filter(Boolean);
    expect(lines[0]).toBe("category,pathwayId,sequence,name,missingField,status,sourceHint,reason");
    expect(lines).toHaveLength(snapshot.pending.length + 1);
  });

  it("does not hide missing formulas in the audit", () => {
    const missing = new Set(Object.entries(generated.formulas.missingByPathway).flatMap(([pathwayId, ranks]) => ranks.map((rank) => `${pathwayId}-${rank}`)));
    const reported = new Set(snapshot.pending.filter((row) => row.category === "配方").map((row) => row.id.replace(/^formula-missing-/, "")));
    expect(reported).toEqual(missing);
  });
});