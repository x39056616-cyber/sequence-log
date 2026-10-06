import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ label: z.string().min(1).max(80), threadId: z.string().min(1), turnId: z.string().nullable() });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "无效的存档点" }, { status: 400 });
  return NextResponse.json({ accepted: true, label: parsed.data.label.trim(), createdAt: new Date().toISOString() });
}
