import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { guardAIRequest } from "@/lib/ai/access-guard";
import { z } from "zod";
import { resolveRequestAIConfig } from "@/lib/ai/server-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ prompt: z.string().min(10).max(800) });

export async function POST(request: Request) {
  const denied = guardAIRequest(request);
  if (denied) return denied;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "无效的图像提示词" }, { status: 400 });
  const status = await resolveRequestAIConfig(request);
  if (!status.imageModel || (!status.apiKey && status.provider !== "compatible")) return NextResponse.json({ error: "未配置图像模型", fallback: true }, { status: 503 });
  try {
    const response = await fetch(status.baseUrl.replace(/\/$/, "") + "/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + status.apiKey },
      body: JSON.stringify({ model: status.imageModel, prompt: parsed.data.prompt, size: "1024x1024", quality: "medium", response_format: "b64_json" }),
    });
    if (!response.ok) throw new Error("image provider " + response.status);
    const payload = await response.json() as { data?: Array<{ b64_json?: string }> };
    const base64 = payload.data?.[0]?.b64_json;
    if (!base64) throw new Error("no image data");
    return NextResponse.json({ dataUrl: "data:image/png;base64," + base64, promptHash: createHash("sha256").update(parsed.data.prompt).digest("hex") });
  } catch {
    return NextResponse.json({ error: "图像生成失败", fallback: true }, { status: 503 });
  }
}


