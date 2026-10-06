import { afterEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { publicAIConfig, readStoredConfig, writeStoredConfig } from "@/lib/ai/server-config";

const CONFIG_PATH = path.join(process.cwd(), ".sequence-ai.json");
const FAKE_KEY = "sk-test-1234567890abcdef";

afterEach(async () => {
  await fs.rm(CONFIG_PATH, { force: true });
});

describe("AI server config security", () => {
  it("round-trips a stored key on the server", async () => {
    await writeStoredConfig({ provider: "deepseek", apiKey: FAKE_KEY, model: "deepseek-v4-pro" });
    const stored = await readStoredConfig();
    expect(stored?.apiKey).toBe(FAKE_KEY);
    expect(stored?.model).toBe("deepseek-v4-pro");
  });

  it("never exposes the raw key through the public payload", async () => {
    await writeStoredConfig({ provider: "deepseek", apiKey: FAKE_KEY, model: "deepseek-v4-flash" });
    const pub = await publicAIConfig();
    const serialized = JSON.stringify(pub);
    expect(serialized).not.toContain(FAKE_KEY);
    expect(pub.hasApiKey).toBe(true);
    expect(pub.keyMasked).toContain("…");
    expect(pub.keyMasked).not.toBe(FAKE_KEY);
    expect((pub.selection as Record<string, unknown>).apiKey).toBeUndefined();
    expect(pub.status.provider).toBe("deepseek");
    expect(pub.status.source).toBe("runtime");
  });

  it("falls back to the environment when no runtime config is stored", async () => {
    const previousKey = process.env.AI_API_KEY;
    const previousModel = process.env.AI_MODEL;
    process.env.AI_API_KEY = FAKE_KEY;
    process.env.AI_MODEL = "deepseek-chat";
    try {
      const pub = await publicAIConfig();
      expect(pub.status.source).toBe("env");
      expect(JSON.stringify(pub)).not.toContain(FAKE_KEY);
    } finally {
      if (previousKey === undefined) delete process.env.AI_API_KEY; else process.env.AI_API_KEY = previousKey;
      if (previousModel === undefined) delete process.env.AI_MODEL; else process.env.AI_MODEL = previousModel;
    }
  });
});
