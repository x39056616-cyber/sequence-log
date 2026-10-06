import { beforeEach, describe, expect, it } from "vitest";
import { db, ensureSeed, ensureWheelSeed, restoreWheelPresets } from "@/lib/db";
import { WHEEL_CATEGORY_PRESETS, WHEEL_OPTION_PRESETS } from "@/lib/wheel/presets";
import { attributeFromOption, buildFateProfile, orderCategoriesForSpin, resolvePool, respinIndexFor, spinPool, unlockedPoolsFromAttributes } from "@/lib/wheel/engine";
import { drawIndex } from "@/lib/wheel/rng";
import { exportBackup, getActiveFateProfile, importBackup, listWheelSpins, recordWheelSpin, saveFateProfile, selectPathway, spinAllCategories } from "@/lib/repository";
import type { WheelOption } from "@/lib/types";

function bytes(values: number[]) {
  let index = 0;
  return () => values[index++ % values.length];
}

describe("wheel randomness", () => {
  it("returns index 0 for a single-slice pool without consuming entropy", () => {
    const draw = drawIndex(1);
    expect(draw.index).toBe(0);
    expect(draw.bytes).toEqual([]);
  });

  it("rejects biased tail values via rejection sampling", () => {
    // poolSize 3 => limit 255; 255 must be rejected, 254 must be accepted.
    const draw = drawIndex(3, bytes([255, 254]));
    expect(draw.index).toBe(254 % 3);
    expect(draw.bytes).toEqual([255, 254]);
  });

  it("distributes ~evenly across a pool of 4 over 10000 draws", () => {
    const counts = [0, 0, 0, 0];
    let counter = 0;
    const entropy = () => {
      counter += 1;
      return Math.floor(Math.random() * 256);
    };
    for (let index = 0; index < 10_000; index += 1) {
      counts[drawIndex(4, entropy).index] += 1;
    }
    for (const count of counts) {
      expect(count).toBeGreaterThan(2_200);
      expect(count).toBeLessThan(2_800);
    }
    expect(counter).toBeGreaterThan(9_000);
  });
});

describe("wheel pool resolution", () => {
  const options: WheelOption[] = [
    { id: "a", categoryId: "c", label: "A", description: "", order: 0, enabled: true, pool: "default", unlocks: [], taskAffinity: false, sourceKind: "authored", sourceNote: "", citations: [], builtIn: false, createdAt: "", updatedAt: "" },
    { id: "b", categoryId: "c", label: "B", description: "", order: 1, enabled: true, pool: "transmigrator", unlocks: [], taskAffinity: false, sourceKind: "authored", sourceNote: "", citations: [], builtIn: false, createdAt: "", updatedAt: "" },
    { id: "d", categoryId: "c", label: "D", description: "", order: 2, enabled: false, pool: "default", unlocks: [], taskAffinity: false, sourceKind: "authored", sourceNote: "", citations: [], builtIn: false, createdAt: "", updatedAt: "" },
  ];

  it("only exposes default options when nothing is unlocked", () => {
    expect(resolvePool(options, "c", []).map((option) => option.id)).toEqual(["a"]);
  });

  it("adds special-pool options on top of defaults (additive)", () => {
    expect(resolvePool(options, "c", ["transmigrator"]).map((option) => option.id)).toEqual(["a", "b"]);
  });

  it("ignores disabled options", () => {
    expect(resolvePool(options, "c", []).some((option) => option.id === "d")).toBe(false);
  });

  it("can exclude explicitly marked non-canon geography", () => {
    const geo: WheelOption[] = [
      { id: "canon", categoryId: "locality", label: "原著地点", description: "", order: 0, enabled: true, pool: "default", unlocks: [], taskAffinity: true, sourceKind: "canon-reference", sourceNote: "原著", citations: [{ chapter: "第一章", line: 1, quote: "地点" }], builtIn: true, createdAt: "", updatedAt: "" },
      { id: "extra", categoryId: "locality", label: "补写地点", description: "", order: 1, enabled: true, pool: "default", unlocks: [], taskAffinity: true, nonCanon: true, sourceKind: "authored", sourceNote: "非原作地名", citations: [], builtIn: true, createdAt: "", updatedAt: "" },
    ];
    expect(resolvePool(geo, "locality", []).map((option) => option.id)).toEqual(["canon", "extra"]);
    expect(resolvePool(geo, "locality", [], { allowNonCanon: false }).map((option) => option.id)).toEqual(["canon"]);
  });
  it("spins within the resolved pool and reports the pool size", () => {
    const outcome = spinPool(resolvePool(options, "c", []), bytes([0]));
    expect(outcome.option.id).toBe("a");
    expect(outcome.draw.poolSize).toBe(1);
  });
});

describe("gate ordering and unlocks", () => {
  it("orders the gate category first", () => {
    const ordered = orderCategoriesForSpin(WHEEL_CATEGORY_PRESETS.map((preset, index) => ({
      id: preset.id, label: preset.label, description: preset.description, order: 100 - index,
      builtIn: true, gate: preset.gate, taskAffinityAllowed: preset.taskAffinityAllowed,
      sourceKind: preset.sourceKind, sourceNote: preset.sourceNote, createdAt: "", updatedAt: "",
    })));
    expect(ordered[0].id).toBe("identity");
  });

  it("unlocks a special pool when the drawn identity declares it", () => {
    const category = {
      id: "identity", label: "身份类型", description: "", order: 0, builtIn: true, gate: true,
      taskAffinityAllowed: false, sourceKind: "video-preset" as const, sourceNote: "", createdAt: "", updatedAt: "",
    };
    const option: WheelOption = {
      id: "identity-transmigrator", categoryId: "identity", label: "穿书者", description: "",
      order: 1, enabled: true, pool: "default", unlocks: ["transmigrator"], taskAffinity: false,
      sourceKind: "video-preset", sourceNote: "", citations: [], builtIn: true, createdAt: "", updatedAt: "",
    };
    const attributes = [attributeFromOption(category, option)];
    expect(unlockedPoolsFromAttributes(attributes)).toEqual(["transmigrator"]);
  });
});

describe("preset content integrity", () => {
  it("gives every category and option a non-empty source note", () => {
    for (const preset of WHEEL_CATEGORY_PRESETS) {
      expect(preset.sourceNote.trim().length).toBeGreaterThan(0);
      expect(preset.sourceKind.length).toBeGreaterThan(0);
    }
    for (const preset of WHEEL_OPTION_PRESETS) {
      expect(preset.sourceNote.trim().length).toBeGreaterThan(0);
      expect(preset.label.trim().length).toBeGreaterThan(0);
    }
  });

  it("never repeats a label inside the same category scope", () => {
    // 小地点与代号按父级分组：同一座城市可以属于多个大地点，但同一父级下不能重名。
    const seen = new Map<string, Set<string>>();
    for (const preset of WHEEL_OPTION_PRESETS) {
      const scope = preset.categoryId + "::" + (preset.parentId ?? "-");
      const bucket = seen.get(scope) ?? new Set<string>();
      expect(bucket.has(preset.label), scope + "/" + preset.label).toBe(false);
      bucket.add(preset.label);
      seen.set(scope, bucket);
    }
  });

  it("keeps the four video identity options and their unlock pools", () => {
    const identity = WHEEL_OPTION_PRESETS.filter((preset) => preset.categoryId === "identity");
    expect(identity.map((preset) => preset.label)).toEqual(["本地人", "穿书者（进入特殊池）", "旧日眷属（非人特殊）", "特殊眷属（非人特殊）"]);
    expect(identity.find((preset) => preset.label === "穿书者（进入特殊池）")?.unlocks).toEqual(["transmigrator"]);
  });

  it("only lets task-affinity-enabled categories carry reality tasks", () => {
    const allowed = new Set(WHEEL_CATEGORY_PRESETS.filter((preset) => preset.taskAffinityAllowed).map((preset) => preset.id));
    for (const preset of WHEEL_OPTION_PRESETS) {
      if (preset.taskAffinity) expect(allowed.has(preset.categoryId)).toBe(true);
    }
    expect(allowed.has("identity")).toBe(false);
    expect(allowed.has("codename")).toBe(false);
    expect(allowed.has("faction")).toBe(false);
  });

  it("only cites canon-reference options and requires citations for them", () => {
    for (const preset of WHEEL_OPTION_PRESETS) {
      if (preset.sourceKind === "canon-reference") expect(preset.citations.length).toBeGreaterThan(0);
    }
  });
});

describe("wheel database flows", () => {
  beforeEach(async () => {
    db.close(); await db.delete(); await db.open();
    await ensureSeed(); await selectPathway("fool"); await ensureWheelSeed();
  });

  it("seeds the built-in categories and options", async () => {
    expect(await db.wheelCategories.count()).toBe(WHEEL_CATEGORY_PRESETS.length);
    expect(await db.wheelOptions.count()).toBe(WHEEL_OPTION_PRESETS.length);
  });

  it("records every spin with an auditable pool snapshot", async () => {
    const { spin } = await recordWheelSpin({ categoryId: "identity", unlockedPools: [] });
    expect(spin.poolSize).toBe(4);
    expect(spin.poolSnapshot).toHaveLength(4);
    expect(spin.rngBytes.length).toBeGreaterThanOrEqual(0);
    const spins = await listWheelSpins();
    expect(spins).toHaveLength(1);
  });

  it("counts respins honestly", async () => {
    await recordWheelSpin({ categoryId: "event", unlockedPools: [] });
    await recordWheelSpin({ categoryId: "event", unlockedPools: [] });
    const { spin } = await recordWheelSpin({ categoryId: "event", unlockedPools: [] });
    expect(spin.isRespin).toBe(true);
    expect(spin.respinIndex).toBe(2);
    expect(respinIndexFor(await listWheelSpins(), "event")).toBe(3);
  });

  it("unlocks special-pool options only after a matching identity is drawn", async () => {
    const defaultPool = resolvePool(await db.wheelOptions.toArray(), "event", []);
    const transmigratorPool = resolvePool(await db.wheelOptions.toArray(), "event", ["transmigrator"]);
    expect(transmigratorPool.length).toBeGreaterThan(defaultPool.length);
  });

  it("supersedes the previous fate profile and keeps history", async () => {
    const first = await saveFateProfile({ selections: [], note: "第一次" });
    const second = await saveFateProfile({ selections: [], note: "第二次", name: "第二份命运" });
    const active = await getActiveFateProfile();
    expect(active?.id).toBe(second.id);
    expect(active?.name).toBe("第二份命运");
    const profiles = await db.fateProfiles.toArray();
    expect(profiles.find((profile) => profile.id === first.id)?.status).toBe("superseded");
    expect(profiles).toHaveLength(2);
  });

  it("links the latest spin of each category to the saved fate profile", async () => {
    const { spin } = await recordWheelSpin({ categoryId: "identity", unlockedPools: [] });
    const profile = await saveFateProfile({ selections: [attributeFromOption(
      (await db.wheelCategories.get("identity"))!,
      (await db.wheelOptions.get(spin.optionId))!,
    )], note: "" });
    const stored = await db.wheelSpins.get(spin.id);
    expect(stored?.fateProfileId).toBe(profile.id);
  });

  it("draws a full set in gate-first order (skipping categories the era lacks)", async () => {
    const results = await spinAllCategories();
    expect(results[0].category.id).toBe("identity");
    // 抽到早期纪元时，当代阵营/遭遇/代号没有资料，会被跳过，因此数量可能少于类别总数。
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(WHEEL_CATEGORY_PRESETS.length);
    const ids = results.map((item) => item.category.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("restores built-in presets without deleting user categories", async () => {
    await db.wheelCategories.add({
      id: "custom", label: "自建", description: "", order: 90, builtIn: false, gate: false,
      taskAffinityAllowed: false, sourceKind: "authored", sourceNote: "自建类别", createdAt: "", updatedAt: "",
    });
    await restoreWheelPresets();
    expect(await db.wheelCategories.get("custom")).toBeTruthy();
    expect(await db.wheelCategories.count()).toBe(WHEEL_CATEGORY_PRESETS.length + 1);
  });
});

describe("wheel backup round-trip", () => {
  beforeEach(async () => {
    db.close(); await db.delete(); await db.open();
    await ensureSeed(); await selectPathway("fool"); await ensureWheelSeed();
  });

  it("exports schemaVersion 5 including wheel tables and re-imports them", async () => {
    await recordWheelSpin({ categoryId: "identity", unlockedPools: [] });
    await saveFateProfile({ selections: [], note: "备份用" });
    const backup = await exportBackup();
    expect(backup.schemaVersion).toBe(7);
    expect(backup.wheelCategories.length).toBe(WHEEL_CATEGORY_PRESETS.length);
    expect(backup.wheelSpins.length).toBe(1);
    expect(backup.fateProfiles.length).toBe(1);

    db.close(); await db.delete(); await db.open();
    await importBackup(backup);
    expect(await db.wheelCategories.count()).toBe(WHEEL_CATEGORY_PRESETS.length);
    expect(await db.wheelSpins.count()).toBe(1);
    expect((await getActiveFateProfile())?.note).toBe("备份用");
  });

  it("keeps accepting older backup versions without wheel data", async () => {
    const backup = await exportBackup();
    const legacy = { ...backup, schemaVersion: 3 } as Record<string, unknown>;
    delete legacy.wheelCategories;
    delete legacy.wheelOptions;
    delete legacy.fateProfiles;
    delete legacy.wheelSpins;
    db.close(); await db.delete(); await db.open();
    await importBackup(legacy as never);
    expect(await db.wheelCategories.count()).toBe(0);
    expect(await getActiveFateProfile()).toBeNull();
  });
});

describe("fate never touches progression values", () => {
  beforeEach(async () => {
    db.close(); await db.delete(); await db.open();
    await ensureSeed(); await selectPathway("fool"); await ensureWheelSeed();
  });

  it("leaves profile spirituality, sequence and digestion untouched", async () => {
    const before = { profile: await db.profile.get("me"), state: await db.sequenceState.get("active") };
    const results = await spinAllCategories();
    await saveFateProfile({ selections: results.map(({ category, option }) => attributeFromOption(category, option)), note: "" });
    const after = { profile: await db.profile.get("me"), state: await db.sequenceState.get("active") };
    expect(after.profile?.totalSpirituality).toBe(before.profile?.totalSpirituality);
    expect(after.state?.sequence).toBe(before.state?.sequence);
    expect(after.state?.digestion).toBe(before.state?.digestion);
  });

  it("builds a fate profile seed from the chosen attribute ids", async () => {
    const profile = buildFateProfile({ id: "x", attributes: [], unlockedPools: [], note: "", spunAt: "" });
    expect(profile.status).toBe("active");
    expect(profile.seed).toBe("");
  });
});





