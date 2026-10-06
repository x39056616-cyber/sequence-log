import { describe, expect, it } from "vitest";
import { AI_PROVIDER_PRESETS, defaultAIConfig, getProviderPreset, resolveAIConfig } from "@/lib/ai/config";

describe("AI provider presets", () => {
  it("defines unique providers with https base URLs and non-empty model lists", () => {
    const ids = AI_PROVIDER_PRESETS.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const preset of AI_PROVIDER_PRESETS) {
      expect(preset.models.length).toBeGreaterThan(0);
      expect(preset.baseUrl).toMatch(/^https?:\/\//);
      const modelIds = preset.models.map((model) => model.id);
      expect(new Set(modelIds).size).toBe(modelIds.length);
      for (const model of preset.models) {
        expect(["fast", "balanced", "deep"]).toContain(model.tier);
        expect(model.label.length).toBeGreaterThan(0);
      }
    }
  });

  it("exposes the requested DeepSeek V4 tiers and Qwen 3.8", () => {
    const deepseek = getProviderPreset("deepseek");
    expect(deepseek?.models.some((model) => model.id === "deepseek-v4-flash" && model.tier === "fast")).toBe(true);
    expect(deepseek?.models.some((model) => model.id === "deepseek-v4-pro" && model.tier === "deep")).toBe(true);
    const qwen = getProviderPreset("qwen");
    expect(qwen?.models.some((model) => model.id === "qwen3.8" && model.tier === "deep")).toBe(true);
  });

  it("resolves provider base URL from the whitelist, never from client input", () => {
    const resolved = resolveAIConfig({ ...defaultAIConfig(), provider: "qwen", apiKey: "sk-test", model: "qwen3.8" });
    expect(resolved.baseUrl).toBe("https://dashscope.aliyuncs.com/compatible-mode/v1");
    expect(resolved.protocol).toBe("chat-completions");
    expect(resolved.model).toBe("qwen3.8");
    expect(resolved.configured).toBe(true);
  });

  it("uses the client-supplied base URL only for the compatible gateway slot", () => {
    const compatible = resolveAIConfig({ ...defaultAIConfig(), provider: "compatible", customBaseUrl: "http://127.0.0.1:11434/v1", customModel: "llama3" });
    expect(compatible.baseUrl).toBe("http://127.0.0.1:11434/v1");
    expect(compatible.model).toBe("llama3");
    const tampered = resolveAIConfig({ ...defaultAIConfig(), provider: "deepseek", customBaseUrl: "https://evil.example.com/v1", apiKey: "sk-x" });
    expect(tampered.baseUrl).toBe("https://api.deepseek.com/v1");
  });

  it("treats an empty key on a hosted provider as not configured", () => {
    const resolved = resolveAIConfig({ ...defaultAIConfig(), provider: "deepseek", apiKey: "" });
    expect(resolved.configured).toBe(false);
  });
});
