import { describe, expect, it } from "vitest";
import { WHEEL_OPTION_PRESETS } from "@/lib/wheel/presets";
import { resolvePool } from "@/lib/wheel/engine";
import type { WheelOption } from "@/lib/types";

const OPTIONS = WHEEL_OPTION_PRESETS.map((preset) => ({ ...preset, enabled: true })) as unknown as WheelOption[];
const labels = (categoryId: string, era: string, parent?: string) =>
  resolvePool(OPTIONS, categoryId, [], { era, parent: parent ?? null }).map((option) => option.label);

describe("纪元过滤（防止第一纪蹦出现代教会）", () => {
  it("第一纪不会出现黑夜教会等当代组织", () => {
    const factions = labels("faction", "第一纪");
    expect(factions).toHaveLength(0);
    expect(factions).not.toContain("黑夜教会");
  });

  it("第五纪才会出现当代教会与塔罗会", () => {
    const factions = labels("faction", "第五纪");
    expect(factions).toContain("黑夜教会");
    expect(factions).toContain("风暴教会");
    expect(factions.length).toBeGreaterThan(10);
  });

  it("第一纪没有遭遇人物与代号", () => {
    expect(labels("encounter", "第一纪")).toHaveLength(0);
    expect(labels("codename", "第一纪")).toHaveLength(0);
    expect(labels("codename", "第五纪").length).toBeGreaterThan(10);
  });

  it("第四纪只出第四纪的古老家族，不出当代教会", () => {
    const fourth = labels("faction", "第四纪");
    expect(fourth).toContain("安提哥努斯家族");
    expect(fourth).not.toContain("黑夜教会");
  });

  it("第一纪的大地点只能是该纪元的标志区域", () => {
    const regions = labels("region", "第一纪");
    expect(regions).toContain("混沌海");
    expect(regions).not.toContain("鲁恩王国");
  });

  it("小地点始终跟随大地点", () => {
    expect(labels("locality", "第五纪", "因蒂斯共和国")).not.toContain("贝克兰德");
    expect(labels("locality", "第五纪", "鲁恩王国")).toContain("贝克兰德");
  });
});
