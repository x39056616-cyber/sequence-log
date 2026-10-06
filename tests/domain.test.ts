import { describe, expect, it } from "vitest";
import { PATHWAYS, SEQUENCES, getPathway, getSequence, sequenceSearch } from "@/lib/lore/pathways";
import { calculateBaseDigestion, calculateDigestion, calculateDigestionCap, calculateStatusAverage, calculateStatusMultiplier, statusBand } from "@/lib/domain/digestion";
import { nextSequence, previousSequence, requiresRitual } from "@/lib/domain/sequence";
import type { Quest, Settings } from "@/lib/types";

const settings: Settings = {
  id: "app", timezone: "Asia/Shanghai", weekStartsOn: 1, digestionBase: 100, digestionLinear: 50, digestionQuadratic: 10,
  theme: "dark", animations: true, chapterLength: "long", status: { san: 60, energy: 60, focus: 60, motivation: 60 }, updatedAt: "2026-10-03T00:00:00.000Z",
};
const quest: Quest = {
  id: "q", title: "测试任务", description: "", status: "today", type: "main", difficulty: 3, priority: 3,
  estimatedMinutes: 60, dueAt: null, xpOverride: null, actingFit: 1, attributeIds: ["intellect"], tags: [], notes: "",
  createdAt: "2026-10-03T00:00:00.000Z", updatedAt: "2026-10-03T00:00:00.000Z", completedAt: null,
};
describe("lore integrity", () => {
  it("contains 22 pathways and 220 unique sequences", () => { expect(PATHWAYS).toHaveLength(22); expect(SEQUENCES).toHaveLength(220); expect(new Set(SEQUENCES.map((item) => item.id)).size).toBe(220); });
  it("orders every pathway from 9 to 0", () => { for (const pathway of PATHWAYS) expect(pathway.sequences.map((item) => item.sequence)).toEqual([9,8,7,6,5,4,3,2,1,0]); });
  it("keeps adjacent pathways reciprocal", () => { for (const pathway of PATHWAYS) for (const id of pathway.adjacentIds) expect(getPathway(id)?.adjacentIds).toContain(pathway.id); });
  it("searches by pathway and sequence", () => { expect(sequenceSearch("占卜家").some((item) => item.sequence === 9)).toBe(true); expect(getSequence("fool", 0)?.name).toBe("愚者"); });
});
describe("digestion formulas", () => {
  it("calculates base difficulty and time multiplier", () => { expect(calculateBaseDigestion(quest)).toBe(78); expect(calculateBaseDigestion({ ...quest, xpOverride: 77 })).toBe(77); });
  it("maps status linearly with 60 neutral", () => { expect(calculateStatusMultiplier(60)).toBe(1); expect(calculateStatusMultiplier(0)).toBe(.5); expect(calculateStatusMultiplier(100)).toBe(1.5); });
  it("calculates full breakdown and clamps", () => { const result = calculateDigestion(quest, "good", settings); expect(result.quality).toBe(1.5); expect(result.awarded).toBe(117); expect(result.minimum).toBe(20); expect(result.maximum).toBe(234); });
  it("does not advance unrelated tasks", () => { expect(calculateDigestion({ ...quest, actingFit: 0 }, "excellent", settings).awarded).toBe(0); });
  it("uses configurable sequence caps", () => { expect(calculateDigestionCap(9, settings)).toBe(100); expect(calculateDigestionCap(8, settings)).toBe(160); expect(calculateDigestionCap(0, settings)).toBe(1360); });
  it("derives status band", () => { expect(statusBand(70).key).toBe("stable"); expect(statusBand(20).key).toBe("danger"); expect(statusBand(10).key).toBe("unstable"); expect(calculateStatusAverage({ san: 0, energy: 60, focus: 60, motivation: 60 })).toBe(45); });
});
describe("sequence state", () => {
  it("moves from 9 toward 0", () => { expect(nextSequence(9)).toBe(8); expect(nextSequence(1)).toBe(0); expect(nextSequence(0)).toBeNull(); expect(previousSequence(9)).toBeNull(); expect(previousSequence(0)).toBe(1); });
  it("requires rituals for sequence 5 and above", () => { expect(requiresRitual(6)).toBe(false); expect(requiresRitual(5)).toBe(true); expect(requiresRitual(0)).toBe(true); });
});




