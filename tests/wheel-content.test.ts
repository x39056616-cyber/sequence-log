import { beforeEach, describe, expect, it } from "vitest";
import entities from "@/lib/lore/entities.generated.json";
import { WHEEL_CATEGORY_PRESETS, WHEEL_OPTION_PRESETS } from "@/lib/wheel/presets";
import { db, ensureSeed, ensureWheelSeed } from "@/lib/db";
import { selectPathway } from "@/lib/repository";

describe("wheel content is grounded in the novel", () => {
  it("covers all seven categories", () => {
    expect(WHEEL_CATEGORY_PRESETS.map((preset) => preset.id)).toEqual([
      "identity", "era", "continent", "region", "locality", "faction", "encounter", "event", "relic", "codename",
    ]);
  });

  it("offers a substantial number of options per category", () => {
    const counts = new Map<string, number>();
    for (const preset of WHEEL_OPTION_PRESETS) {
      counts.set(preset.categoryId, (counts.get(preset.categoryId) ?? 0) + 1);
    }
    expect(counts.get("identity")).toBe(4);
    expect(counts.get("encounter") ?? 0).toBeGreaterThanOrEqual(40);
    expect(counts.get("event") ?? 0).toBeGreaterThanOrEqual(40);
    expect(counts.get("faction") ?? 0).toBeGreaterThanOrEqual(40);
    expect(counts.get("era")).toBe(5);
    expect(counts.get("continent") ?? 0).toBeGreaterThanOrEqual(2);
    expect((counts.get("region") ?? 0) + (counts.get("locality") ?? 0)).toBeGreaterThanOrEqual(40);
    expect(counts.get("locality") ?? 0).toBeGreaterThanOrEqual(40);
    expect(counts.get("relic") ?? 0).toBeGreaterThanOrEqual(40);
    expect(counts.get("codename") ?? 0).toBeGreaterThanOrEqual(18);
  });

  it("keeps the five core verified entity pools at 40 or more with citations", () => {
    for (const key of ["figures", "factions", "places", "events", "items"] as const) {
      const rows = entities[key] as Array<{ name: string; citations: Array<{ chapter: string; line: number; quote: string }> }>;
      expect(rows.length, key).toBeGreaterThanOrEqual(40);
      for (const row of rows) {
        expect(row.citations.length, `${key}:${row.name}`).toBeGreaterThan(0);
        expect(row.citations[0].line, `${key}:${row.name}`).toBeGreaterThan(0);
        expect(row.citations[0].quote.length, `${key}:${row.name}`).toBeGreaterThan(6);
      }
    }
  });

  it("gives every novel-derived option at least one citation", () => {
    const novelDerived = WHEEL_OPTION_PRESETS.filter((preset) => preset.sourceKind.startsWith("canon-"));
    expect(novelDerived.length).toBeGreaterThan(80);
    for (const preset of novelDerived) {
      // 大陆与非原作补写地名没有单条引文，其余都要有。
      if (preset.categoryId === "continent" || preset.nonCanon) continue;
      expect(preset.citations.length, preset.label).toBeGreaterThan(0);
      expect(preset.citations[0].chapter.length, preset.label).toBeGreaterThan(0);
      expect(preset.citations[0].quote.length, preset.label).toBeGreaterThan(6);
    }
  });

  it("keeps the source index complete while allowing explicit unverified candidates", () => {
    const unverified = entities.unverified as Record<string, string[]>;
    expect(Object.keys(unverified).length).toBeGreaterThanOrEqual(6);
    expect(entities.source.chapters).toBeGreaterThan(1000);
  });

  it("never puts an unverified candidate on the wheel", () => {
    const unverified = entities.unverified as Record<string, string[]>;
    const labels = new Set(WHEEL_OPTION_PRESETS.map((preset) => preset.label));
    for (const key of ["figures", "factions", "places", "events", "items", "codenames"]) {
      for (const name of unverified[key] ?? []) {
        expect(labels.has(name), `${key}:${name} must not be offered`).toBe(false);
      }
    }
    // Codenames that did verify must all be present.
    expect(labels.has("倒吊人")).toBe(true);
    expect(labels.has("愚者")).toBe(true);
  });

  it("keeps the four video identity options as the only self-authored identity entries", () => {
    const identity = WHEEL_OPTION_PRESETS.filter((preset) => preset.categoryId === "identity");
    expect(identity.every((preset) => preset.sourceKind === "video-preset")).toBe(true);
    expect(identity.map((preset) => preset.label)).toEqual(["本地人", "穿书者（进入特殊池）", "旧日眷属（非人特殊）", "特殊眷属（非人特殊）"]);
  });

  it("still exposes special-pool options for unlocked identities", () => {
    const special = WHEEL_OPTION_PRESETS.filter((preset) => preset.pool !== "default");
    expect(special.length).toBeGreaterThanOrEqual(6);
    expect(special.some((preset) => preset.pool === "transmigrator")).toBe(true);
    expect(special.some((preset) => preset.pool === "oldOne")).toBe(true);
    expect(special.some((preset) => preset.pool === "special")).toBe(true);
  });
});

describe("wheel preset upgrade", () => {
  beforeEach(async () => {
    db.close(); await db.delete(); await db.open();
    await ensureSeed(); await selectPathway("fool");
  });

  it("replaces stale built-in options but keeps user-created ones", async () => {
    // Simulate an older database that still has the previous hand-written option set.
    await db.wheelCategories.put({ id: "event", label: "事件变故", description: "旧类别", order: 1, builtIn: true, gate: false, taskAffinityAllowed: true, sourceKind: "authored", sourceNote: "旧", createdAt: "", updatedAt: "" });
    await db.wheelOptions.put({ id: "event-accident", categoryId: "event", label: "意外事故", description: "旧扇区", order: 0, enabled: true, pool: "default", unlocks: [], taskAffinity: true, sourceKind: "authored", sourceNote: "旧", citations: [], builtIn: true, createdAt: "", updatedAt: "" });
    await db.wheelCategories.put({ id: "custom", label: "自建类别", description: "", order: 90, builtIn: false, gate: false, taskAffinityAllowed: false, sourceKind: "authored", sourceNote: "自建类别", createdAt: "", updatedAt: "" });
    await db.wheelOptions.put({ id: "custom-1", categoryId: "custom", label: "自建扇区", description: "", order: 0, enabled: true, pool: "default", unlocks: [], taskAffinity: false, sourceKind: "authored", sourceNote: "自建扇区", citations: [], builtIn: false, createdAt: "", updatedAt: "" });

    await ensureWheelSeed();

    expect(await db.wheelOptions.get("event-accident")).toBeUndefined();
    expect(await db.wheelOptions.get("custom-1")).toBeTruthy();
    expect(await db.wheelCategories.get("custom")).toBeTruthy();
    expect((await db.wheelCategories.get("event"))?.label).toBe("异常事件");
    expect(await db.wheelOptions.count()).toBe(WHEEL_OPTION_PRESETS.length + 1);
  });

  it("is idempotent", async () => {
    await ensureWheelSeed();
    const first = await db.wheelOptions.count();
    await ensureWheelSeed();
    expect(await db.wheelOptions.count()).toBe(first);
  });
});






