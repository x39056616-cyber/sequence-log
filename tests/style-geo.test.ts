import { describe, expect, it } from "vitest";
import { STYLE_ANCHORS, pickStyleAnchors, styleRulesForPrompt, STYLE_LEXICON } from "@/lib/lore/style-lexicon";
import { checkProse } from "@/lib/domain/prose-check";
import { WHEEL_OPTION_PRESETS } from "@/lib/wheel/presets";
import { resolvePool } from "@/lib/wheel/engine";
import type { WheelOption } from "@/lib/types";

const OPTIONS = WHEEL_OPTION_PRESETS.map((preset) => ({ ...preset, enabled: true })) as unknown as WheelOption[];
const labels = (categoryId: string, era?: string, parent?: string) =>
  resolvePool(OPTIONS, categoryId, [], { era: era ?? null, parent: parent ?? null }).map((option) => option.label);

describe("风格锚定包", () => {
  it("覆盖十二类场景且每类至少 4 段", () => {
    const scenes = [
      "divination", "sealed", "tarot", "daily", "cost", "institution",
      "divination-failure", "tarot-secret", "church-interrogation", "poor-quarter", "characteristic-transfer", "ritual-preparation",
    ];
    for (const scene of scenes) expect(STYLE_ANCHORS.coverage[scene] ?? 0, scene).toBeGreaterThanOrEqual(4);
    expect(STYLE_ANCHORS.total).toBeGreaterThanOrEqual(60);
  });

  it("每段范例都有章节出处", () => {
    for (const anchor of STYLE_ANCHORS.anchors) {
      expect(anchor.chapter.length, anchor.scene).toBeGreaterThan(0);
      expect(anchor.text.length).toBeGreaterThan(80);
    }
  });

  it("按情境挑选且不超过 6 段", () => {
    const picked = pickStyleAnchors("占卜 封印物 塔罗会 便士 失控 值夜者", 6);
    expect(picked.length).toBeGreaterThan(0);
    expect(picked.length).toBeLessThanOrEqual(6);
  });
});

describe("硬词表", () => {
  it("四类词表都非空且提示词包含关键项", () => {
    expect(STYLE_LEXICON.terms.length).toBeGreaterThan(10);
    expect(STYLE_LEXICON.appellations.length).toBeGreaterThan(5);
    expect(STYLE_LEXICON.organizations.length).toBeGreaterThan(5);
    expect(STYLE_LEXICON.objects.length).toBeGreaterThan(5);
    const rules = styleRulesForPrompt();
    expect(rules).toContain("祂");
    expect(rules).toContain("封印物");
    expect(rules).toContain("便士");
  });
});

describe("本地出戏校验器", () => {
  it("命中 AI 腔用词", () => {
    const issues = checkProse("他走进房间。值得一提的是，桌上有一盏煤气灯。");
    expect(issues.some((issue) => issue.kind === "ai-tone")).toBe(true);
  });

  it("命中现代词", () => {
    const issues = checkProse("他掏出手机看了一眼，又放回口袋。");
    expect(issues.some((issue) => issue.kind === "modern")).toBe(true);
  });

  it("封印物没有编号会报出来", () => {
    const issues = checkProse("那件封印物被锁在铅匣里，谁也不敢打开。");
    expect(issues.some((issue) => issue.kind === "sealed-number")).toBe(true);
  });

  it("带编号的封印物不再报警", () => {
    const issues = checkProse("那件封印物 2-049 被锁在铅匣里，谁也不敢打开。");
    expect(issues.some((issue) => issue.kind === "sealed-number")).toBe(false);
  });

  it("神性语境缺「祂」会报出来", () => {
    const issues = checkProse("真神注视着他，他却不敢抬头。");
    expect(issues.some((issue) => issue.kind === "divine-pronoun")).toBe(true);
  });

  it("封印物编号格式错误会报出来", () => {
    const issues = checkProse("那件封印物 2-4 被锁在铅匣里。");
    expect(issues.some((issue) => issue.kind === "sealed-format")).toBe(true);
  });

  it("同一人物称谓漂移会报出来", () => {
    const issues = checkProse("邓恩先生走了进来。片刻后，邓恩阁下摘下帽子。");
    expect(issues.some((issue) => issue.kind === "appellation-drift")).toBe(true);
  });

  it("货币混用会报出来", () => {
    const issues = checkProse("这盏煤气灯要 3 镑，折算成人民币大约是二十七元。");
    expect(issues.some((issue) => issue.kind === "currency-mix")).toBe(true);
  });

  it("灵性与精神力混用会报出来", () => {
    const issues = checkProse("他消耗精神力维持灵性视觉，额头很快渗出汗珠。");
    expect(issues.some((issue) => issue.kind === "terminology-mix")).toBe(true);
  });

  it("干净的句子不产生问题", () => {
    const issues = checkProse("他点起煤气灯。手杖靠在门边。");
    expect(issues.filter((issue) => issue.kind === "modern" || issue.kind === "ai-tone")).toHaveLength(0);
  });
});

describe("三级地理", () => {
  it("大陆只有原著两块", () => {
    expect(labels("continent")).toEqual(expect.arrayContaining(["北大陆", "南大陆"]));
  });

  it("国家跟随大陆，不会出现跨洲错配", () => {
    const north = labels("region", "第五纪", "北大陆");
    expect(north).toContain("鲁恩王国");
    expect(north).not.toContain("罗思德群岛");
  });

  it("城市跟随国家，且补充地名已标注非原作", () => {
    const ruen = labels("locality", "第五纪", "鲁恩王国");
    expect(ruen).toContain("贝克兰德");
    const extra = WHEEL_OPTION_PRESETS.find((preset) => preset.categoryId === "locality" && preset.nonCanon);
    expect(extra, "应存在非原作地名").toBeTruthy();
    expect(extra?.sourceNote).toContain("非原作地名");
  });

  it("每个第五纪国家的城市数不少于 3（原著 + 补写）", () => {
    for (const country of ["鲁恩王国", "因蒂斯共和国", "弗萨克帝国"]) {
      expect(labels("locality", "第五纪", country).length, country).toBeGreaterThanOrEqual(3);
    }
  });
});
