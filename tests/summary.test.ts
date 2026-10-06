import { describe, expect, it } from "vitest";
import { buildRollingSummary, shouldPersistSummary, SUMMARY_INTERVAL } from "@/lib/adventure/summary";

describe("rolling story summary", () => {
  it("persists only every six turns", () => {
    expect(SUMMARY_INTERVAL).toBe(6);
    expect(shouldPersistSummary(0)).toBe(false);
    expect(shouldPersistSummary(5)).toBe(false);
    expect(shouldPersistSummary(6)).toBe(true);
    expect(shouldPersistSummary(11)).toBe(false);
    expect(shouldPersistSummary(12)).toBe(true);
  });

  it("keeps the local fallback grounded in facts and open threads", () => {
    const summary = buildRollingSummary({
      previous: "主角抵达廷根市。",
      delta: "他在旧书店找到一封没有署名的信。",
      knownFacts: ["信纸来自贝克兰德", "店主的右手有烧伤"],
      openThreads: [{ title: "无名信件的寄件人", status: "open" }, { title: "已解决的委托", status: "resolved" }],
    });
    expect(summary).toContain("主角抵达廷根市");
    expect(summary).toContain("无名信件的寄件人");
    expect(summary).toContain("信纸来自贝克兰德");
    expect(summary).not.toContain("已解决的委托");
  });

  it("caps long summaries without losing the newest tail", () => {
    const summary = buildRollingSummary({ previous: "旧".repeat(500), delta: "新线索", maxChars: 20 });
    expect(summary.length).toBeLessThanOrEqual(20);
    expect(summary.endsWith("新线索") || summary.includes("新线索")).toBe(true);
  });
});