import { NextResponse } from "next/server";
import { z } from "zod";
import { publicAIConfig, readStoredConfig, writeStoredConfig } from "@/lib/ai/server-config";
import { getProviderPreset } from "@/lib/ai/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Whitelist validation: provider must exist in presets, so baseUrl is never client-controlled
// except through the explicit "compatible" gateway slot.
const inputSchema = z.object({
  provider: z.string(),
  apiKey: z.string().max(400).optional(),
  model: z.string().max(200).optional(),
  narrativeModel: z.string().max(200).optional(),
  adjudicatorModel: z.string().max(200).optional(),
  imageModel: z.string().max(200).optional(),
  customBaseUrl: z.string().max(400).optional(),
  customModel: z.string().max(200).optional(),
  useThinking: z.boolean().optional(),
});

export async function GET() {
  return NextResponse.json(await publicAIConfig());
}

export async function PUT(request: Request) {
  const parsed = inputSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "配置格式无效" }, { status: 400 });
  const preset = getProviderPreset(parsed.data.provider);
  if (!preset) return NextResponse.json({ error: "未知的 AI 供应商" }, { status: 400 });

  const existing = await readStoredConfig();
  const apiKey = typeof parsed.data.apiKey === "string" && parsed.data.apiKey.trim().length > 0
    ? parsed.data.apiKey.trim()
    : existing?.apiKey ?? "";

  if (parsed.data.customBaseUrl) {
    try {
      const url = new URL(parsed.data.customBaseUrl);
      const isLocal = url.hostname === "127.0.0.1" || url.hostname === "localhost";
      if (url.protocol !== "https:" && !isLocal) {
        return NextResponse.json({ error: "自定义网关必须使用 https（本机地址除外）" }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: "自定义网关地址不是合法 URL" }, { status: 400 });
    }
  }

  const saved = await writeStoredConfig({
    provider: preset.id,
    apiKey,
    model: parsed.data.model ?? existing?.model ?? "",
    narrativeModel: parsed.data.narrativeModel ?? parsed.data.model ?? existing?.narrativeModel ?? "",
    adjudicatorModel: parsed.data.adjudicatorModel ?? parsed.data.model ?? existing?.adjudicatorModel ?? "",
    imageModel: parsed.data.imageModel ?? existing?.imageModel ?? "",
    customBaseUrl: parsed.data.customBaseUrl ?? existing?.customBaseUrl ?? "",
    customModel: parsed.data.customModel ?? existing?.customModel ?? "",
    useThinking: parsed.data.useThinking ?? existing?.useThinking ?? false,
  });

  const pub = await publicAIConfig();
  return NextResponse.json({ ...pub, savedAt: saved.updatedAt });
}
