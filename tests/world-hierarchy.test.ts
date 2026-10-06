import { beforeEach, describe, expect, it } from "vitest";
import { db, ensureSeed, ensureWheelSeed } from "@/lib/db";
import { selectPathway, ensureAuthorFormulas, listFormulas, unlockCurrentSequenceSkill, listSkills } from "@/lib/repository";
import { FACTION_CODENAMES, WHEEL_CATEGORY_PRESETS, WHEEL_OPTION_PRESETS } from "@/lib/wheel/presets";
import { resolvePool, spinPool } from "@/lib/wheel/engine";
import { AUTHOR_CONTENT, WORLD } from "@/lib/lore/author-content";
import type { WheelOption } from "@/lib/types";

const REAL_WORLD_PLACE_BLACKLIST = ["巴黎", "伦敦", "纽约", "东京", "莫斯科"];

/** 预设缺少 enabled（由 presetOptionRow 补上），测试里补一份可直接用于池解析的选项。 */
const OPTIONS = WHEEL_OPTION_PRESETS.map((preset) => ({ ...preset, enabled: true })) as unknown as WheelOption[];

describe("年代 → 大地点 → 小地点 层级", () => {
  it("covers five eras and filters regions by era", () => {
    expect(WORLD.eras.map((era) => era.name)).toEqual(["第一纪", "第二纪", "第三纪", "第四纪", "第五纪"]);
    const fourth = resolvePool(OPTIONS, "region", [], { era: "第四纪" }).map((o) => o.label);
    const fifth = resolvePool(OPTIONS, "region", [], { era: "第五纪" }).map((o) => o.label);
    expect(fourth).toContain("所罗门帝国");
    expect(fourth).not.toContain("鲁恩王国");
    expect(fifth).toContain("鲁恩王国");
    expect(fifth).not.toContain("所罗门帝国");
  });

  it("keeps localities inside their parent region", () => {
    const options = OPTIONS;
    const luton = resolvePool(options, "locality", [], { parent: "鲁恩王国" }).map((o) => o.label);
    const intis = resolvePool(options, "locality", [], { parent: "因蒂斯共和国" }).map((o) => o.label);
    expect(luton).toContain("贝克兰德");
    expect(luton).not.toContain("特里尔");
    expect(intis).toContain("特里尔");
    expect(intis).not.toContain("贝克兰德");
  });

  it("falls back to a landmark for early eras without cities", () => {
    const options = OPTIONS;
    for (const region of WORLD.regions.filter((r) => r.eras.some((era) => ["第一纪", "第二纪", "第三纪"].includes(era)))) {
      const pool = resolvePool(options, "locality", [], { parent: region.name });
      expect(pool.length, region.name).toBeGreaterThan(0);
    }
  });

  it("weights 第五纪 at about half of all draws", () => {
    const eraPool = resolvePool(OPTIONS, "era", []);
    const counts = new Map<string, number>();
    for (let index = 0; index < 4000; index += 1) {
      const label = spinPool(eraPool).option.label;
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    const fifth = counts.get("第五纪") ?? 0;
    expect(fifth / 4000).toBeGreaterThan(0.42);
    expect(fifth / 4000).toBeLessThan(0.58);
  });

  it("never uses a real-world place name", () => {
    const labels = WHEEL_OPTION_PRESETS.filter((p) => p.categoryId === "locality" || p.categoryId === "region").map((p) => p.label);
    for (const name of REAL_WORLD_PLACE_BLACKLIST) {
      expect(labels.includes(name), name).toBe(false);
    }
  });
});

describe("代号按阵营生成", () => {
  it("only offers titles belonging to the drawn faction", () => {
    const options = OPTIONS;
    const storm = resolvePool(options, "codename", [], { parent: "风暴教会" }).map((o) => o.label);
    const tarot = resolvePool(options, "codename", [], { parent: "塔罗会" }).map((o) => o.label);
    expect(storm).toContain("代罚者");
    expect(storm).not.toContain("愚者");
    expect(tarot).toContain("愚者");
    expect(tarot).not.toContain("代罚者");
  });

  it("keeps the tarot club pool free of codenames that could not be verified", () => {
    expect(FACTION_CODENAMES["塔罗会"]).not.toContain("恋人");
    expect(FACTION_CODENAMES["塔罗会"]).not.toContain("女祭司");
    expect(FACTION_CODENAMES["塔罗会"]).not.toContain("战车");
  });
});

describe("作者补充设定", () => {
  it("covers 20 pathways of abilities with no invented names", () => {
    expect(AUTHOR_CONTENT.coverage.pathways).toBeGreaterThanOrEqual(19);
    expect(AUTHOR_CONTENT.abilities.length).toBeGreaterThan(180);
    for (const ability of AUTHOR_CONTENT.abilities) {
      expect(ability.text.trim().length, ability.pathwayId + "-" + ability.sequence).toBeGreaterThan(0);
      expect(ability.sequenceName.trim().length).toBeGreaterThan(0);
    }
  });

  it("stores the author's formulas and labels their source", async () => {
    db.close(); await db.delete(); await db.open();
    await ensureSeed(); await selectPathway("black-emperor");
    const count = await ensureAuthorFormulas();
    expect(count).toBeGreaterThan(0);
    const rows = await listFormulas("black-emperor");
    expect(rows.length).toBe(10);
    expect(rows[0].sourceKind).toBe("author");
  });

  it("marks a skill as author-provided when the author published its ability", async () => {
    db.close(); await db.delete(); await db.open();
    await ensureSeed(); await selectPathway("black-emperor");
    const skills = await listSkills();
    expect(skills[0].status).toBe("author");
    expect(skills[0].authorText.length).toBeGreaterThan(20);
  });

  it("does not claim author content for pathways the author never published", async () => {
    db.close(); await db.delete(); await db.open();
    await ensureSeed(); await selectPathway("fool");
    await unlockCurrentSequenceSkill();
    const skill = (await listSkills())[0];
    expect(skill.pathwayId).toBe("fool");
    expect(skill.authorText).toBe("");
  });
});

describe("转盘类别结构", () => {
  beforeEach(async () => {
    db.close(); await db.delete(); await db.open();
    await ensureSeed(); await selectPathway("fool"); await ensureWheelSeed();
  });

  it("exposes the nine categories in draw order", () => {
    expect(WHEEL_CATEGORY_PRESETS.map((p) => p.id)).toEqual(["identity", "era", "continent", "region", "locality", "faction", "encounter", "event", "relic", "codename"]);
  });

  it("has no leftover 'location' category in the database after syncing", async () => {
    expect(await db.wheelCategories.get("location")).toBeUndefined();
    expect(await db.wheelCategories.get("era")).toBeTruthy();
    expect(await db.wheelCategories.get("locality")).toBeTruthy();
  });
});


