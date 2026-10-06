import { expect, test } from "vitest";
import { db, ensureSeed } from "@/lib/db";
import { selectPathway } from "@/lib/repository";
test("confirm pathway writes state without throwing", async () => {
  db.close(); await db.delete(); await db.open(); await ensureSeed();
  await selectPathway("fool");
  const state = await db.sequenceState.get("active");
  expect(state?.pathwayId).toBe("fool");
  expect(state?.sequence).toBe(9);
  const reqs = await db.realityRequirements.where("pathwayId").equals("fool").toArray();
  expect(reqs.length).toBeGreaterThan(0);
  const ach = await db.achievements.get("path-chosen");
  expect(ach?.unlockedAt).toBeTruthy();
});
