import { NextResponse } from "next/server";
import { guardAIRequest } from "@/lib/ai/access-guard";
import { z } from "zod";
import { resolveRequestAIConfig } from "@/lib/ai/server-config";
import { styleRulesForPrompt } from "@/lib/lore/style-lexicon";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  sentence: z.string().min(4).max(400),
  reason: z.string().max(200).optional().default(""),
});

/**
 * 只重写「出戏清单」里命中的那一句——单句调用，成本极低，且只在你点击时发生。
 */
export async function POST(request: Request) {
  const denied = guardAIRequest(request);
  if (denied) return denied;
  let payload: unknown;
  try { payload = await request.json(); } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "无效的句子" }, { status: 400 });

  const config = await resolveRequestAIConfig(request);
  if (!config.configured) return NextResponse.json({ error: "尚未配置 API Key" }, { status: 503 });

  const endpoint = config.baseUrl.replace(/\/$/, "") + (config.protocol === "responses" ? "/responses" : "/chat/completions");
  const system = [
    "你是《诡秘之主》文风校对。只重写给出的一句话，保持原意与信息量。",
    "硬约束：", styleRulesForPrompt(),
    `问题说明：${parsed.data.reason || "读起来不像原著"}`,
  ].join("\n");
  const body = config.protocol === "responses"
    ? { model: config.narrativeModel, input: [{ role: "system", content: system }, { role: "user", content: parsed.data.sentence }] }
    : { model: config.narrativeModel, messages: [{ role: "system", content: system }, { role: "user", content: parsed.data.sentence }], max_tokens: 400 };

  try {
    const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + config.apiKey }, body: JSON.stringify(body) });
    if (!response.ok) return NextResponse.json({ error: "重写失败：" + response.status }, { status: 502 });
    const data = await response.json() as Record<string, unknown>;
    const text = config.protocol === "responses"
      ? (data.output_text as string | undefined) ?? ""
      : (((data.choices as Array<{ message?: { content?: string } }> | undefined)?.[0]?.message?.content) ?? "");
    return NextResponse.json({ sentence: String(text).trim().replace(/^["“]|["”]$/g, "") });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "重写失败" }, { status: 502 });
  }
}
