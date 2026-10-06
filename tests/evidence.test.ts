import { describe, expect, it } from "vitest";
import { LORE_EVIDENCE, getLoreEvidence, getLoreEvidenceCoverage } from "@/lib/lore/evidence";

describe("local novel evidence index", () => {
  it("indexes all 220 sequences from the local source", () => {
    expect(Object.keys(LORE_EVIDENCE.sequences)).toHaveLength(220);
    expect(LORE_EVIDENCE.coverage.withEvidence).toBeGreaterThanOrEqual(200);
    expect(LORE_EVIDENCE.source.sha256).toHaveLength(64);
  });
  it("keeps evidence short and source-addressed", () => {
    for (const record of Object.values(LORE_EVIDENCE.sequences)) {
      for (const item of record.evidence) {
        expect(item.quote.length).toBeLessThanOrEqual(220);
        expect(item.line).toBeGreaterThan(0);
        expect(item.chapter.length).toBeGreaterThan(0);
      }
    }
  });
  it("returns evidence for a known Fool sequence", () => {
    expect(getLoreEvidence("fool", 9)?.name).toBe("占卜家");
    expect(getLoreEvidence("fool", 9)?.evidence.length).toBeGreaterThan(0);
    expect(getLoreEvidenceCoverage("fool")).toEqual({ total: 10, withEvidence: expect.any(Number) });
  });
});
