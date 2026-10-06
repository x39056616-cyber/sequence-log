import { NextResponse } from "next/server";
import { publicAIConfig } from "@/lib/ai/server-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { status } = await publicAIConfig();
  return NextResponse.json({
    textConfigured: status.configured,
    imageConfigured: Boolean(status.configured && status.imageModel),
    provider: status.provider,
    protocol: status.protocol,
    baseUrl: status.baseUrl,
    model: status.model,
    narrativeModel: status.narrativeModel,
    adjudicatorModel: status.adjudicatorModel,
    imageModel: status.imageModel,
  });
}
