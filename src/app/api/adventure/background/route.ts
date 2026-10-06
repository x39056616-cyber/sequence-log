import { NextResponse } from "next/server";
import { guardAIRequest } from "@/lib/ai/access-guard";
import { z } from "zod";
import { generateCharacterBackground } from "@/lib/ai/provider";
import { resolveRequestAIConfig } from "@/lib/ai/server-config";
import { searchNovel, termsFromBackground } from "@/lib/lore/novel-search";
import { pickStyleAnchors } from "@/lib/lore/style-lexicon";
import { buildLorePack, formatLorePack } from "@/lib/lore/lore-pack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const inputSchema = z.object({
  fateSummary: z.string().max(400),
  fateAttributes: z.array(z.object({
    category: z.string().max(60),
    value: z.string().max(120),
    sourceNote: z.string().max(160),
  })).max(12),
  pathwayName: z.string().max(40),
  sequenceName: z.string().max(40),
  sequenceRank: z.number().int().min(0).max(9),
  realitySummary: z.string().max(600),
  existingFields: z.record(z.string(), z.string().max(400)).optional().default({}),
  loreGrounding: z.array(z.string().max(400)).max(20).optional().default([]),
});

export async function POST(request: Request) {
  const denied = guardAIRequest(request);
  if (denied) return denied;
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }
  const parsed = inputSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "无效的人物背景请求" }, { status: 400 });

  const status = await resolveRequestAIConfig(request);
  if (!status.configured) {
    return NextResponse.json({ error: "尚未配置 AI：请到「幕后控制台 → AI 接口与模型强度」填入 API Key 后再生成人物背景。" }, { status: 503 });
  }

  const started = Date.now();
  // 先从全文检索真实段落，作为生成依据（避免自由发挥导致与原著冲突）。
  const lorePassages = await searchNovel(termsFromBackground({
    pathwayName: parsed.data.pathwayName,
    sequenceName: parsed.data.sequenceName,
    fateAttributes: parsed.data.fateAttributes,
  }), { limit: 12, maxChars: 700 }).catch(() => []);
  try {
    const draft = await generateCharacterBackground({
      fateSummary: parsed.data.fateSummary,
      fateAttributes: parsed.data.fateAttributes,
      pathwayName: parsed.data.pathwayName,
      sequenceName: parsed.data.sequenceName,
      sequenceRank: parsed.data.sequenceRank,
      realitySummary: parsed.data.realitySummary,
      existingFields: parsed.data.existingFields ?? {},
      loreGrounding: parsed.data.loreGrounding ?? [],
      styleAnchors: pickStyleAnchors(JSON.stringify(parsed.data.fateAttributes) + parsed.data.sequenceName),
      lorePassages,
      // 把抽到的命运条目检索成原文档段，作为写作硬依据
      lorePack: formatLorePack(buildLorePack(parsed.data.fateAttributes)),
    }, status);
    return NextResponse.json({
      fields: draft.fields,
      backgroundText: draft.backgroundText,
      provider: status.provider,
      model: status.narrativeModel,
      elapsedMs: Date.now() - started,
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "人物背景生成失败",
      retryable: true,
      elapsedMs: Date.now() - started,
    }, { status: 502 });
  }
}






