import { NextResponse } from "next/server";
import { guardAIRequest } from "@/lib/ai/access-guard";
import { resolveRequestAIConfig } from "@/lib/ai/server-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = guardAIRequest(request);
  if (denied) return denied;
  const config = await resolveRequestAIConfig(request);
  if (!config.configured) {
    return NextResponse.json({ ok: false, error: "尚未配置 API Key" }, { status: 400 });
  }
  const isResponses = config.protocol === "responses";
  const endpoint = config.baseUrl.replace(/\/$/, "") + (isResponses ? "/responses" : "/chat/completions");
  const body: Record<string, unknown> = isResponses
    ? { model: config.model, input: [{ role: "user", content: "回复 OK 两个字母即可。" }] }
    : { model: config.model, messages: [{ role: "user", content: "回复 OK 两个字母即可。" }], max_tokens: 16 };
  if (config.provider === "qwen") body.enable_thinking = config.useThinking;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  const started = Date.now();
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + config.apiKey },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const elapsedMs = Date.now() - started;
    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json({ ok: false, error: `供应商返回 ${response.status}：${text.slice(0, 300)}`, elapsedMs }, { status: 200 });
    }
    const payload = await response.json() as Record<string, unknown>;
    const text = isResponses
      ? (payload.output_text as string | undefined) ?? ""
      : ((payload.choices as Array<{ message?: { content?: string } }> | undefined)?.[0]?.message?.content ?? "");
    return NextResponse.json({
      ok: true,
      elapsedMs,
      provider: config.providerLabel,
      model: config.model,
      protocol: config.protocol,
      sample: String(text).slice(0, 120),
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error), elapsedMs: Date.now() - started }, { status: 200 });
  } finally {
    clearTimeout(timer);
  }
}


