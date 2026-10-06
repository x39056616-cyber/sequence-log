import { NextResponse } from "next/server";
import { guardAIRequest } from "@/lib/ai/access-guard";
import { z } from "zod";
import { streamTurnNarrative, adjudicateTurn } from "@/lib/ai/provider";
import { localAdjudication } from "@/lib/adventure/local-narrative";
import { applyTurnOperations } from "@/lib/adventure/state";
import { resolveRequestAIConfig } from "@/lib/ai/server-config";
import { searchNovel, termsFromContext } from "@/lib/lore/novel-search";
import { pickStyleAnchors } from "@/lib/lore/style-lexicon";
import type { AIContext } from "@/lib/adventure/privacy";
import type { StoryActor, StoryFlag, StoryItem, TurnOperation, WorldState } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const inputSchema = z.object({
  context: z.record(z.string(), z.unknown()),
  userInput: z.string().max(1200),
  mode: z.enum(["auto", "action", "dialogue", "observe", "thought"]),
  worldState: z.record(z.string(), z.unknown()),
  flags: z.array(z.record(z.string(), z.unknown())),
  actors: z.array(z.record(z.string(), z.unknown())),
  items: z.array(z.record(z.string(), z.unknown())),
  recentTurns: z.array(z.record(z.string(), z.unknown())),
  summary: z.string().max(6000),
  previousResponseId: z.string().nullable().optional(),
  sequenceName: z.string(),
  pathwayName: z.string(),
  goal: z.string().optional(),
  phase: z.enum(["opening", "turn"]).optional(),
  chapterLength: z.enum(["brief", "standard", "long"]).optional(),
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
  if (!parsed.success) return NextResponse.json({ error: "无效的叙事输入" }, { status: 400 });
  const input = parsed.data;
  const phase = input.phase ?? "turn";
  if (phase === "turn" && input.userInput.trim().length === 0) {
    return NextResponse.json({ error: "请输入行动再推进。" }, { status: 400 });
  }

  const worldState = input.worldState as unknown as WorldState;
  const flags = input.flags as unknown as StoryFlag[];
  const actors = input.actors as unknown as StoryActor[];
  const items = input.items as unknown as StoryItem[];
  const context = input.context as unknown as AIContext;
  const aiConfig = await resolveRequestAIConfig(request);
  // 检索原文段落，让每一轮叙事都有原著依据。
  const lorePassages = await searchNovel(termsFromContext(context as unknown as Record<string, unknown>), { limit: 8, maxChars: 600 }).catch(() => []);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      const startedAt = Date.now();
      send("meta", { startedAt, phase });
      let chapterText = "";
      let responseId: string | null = input.previousResponseId ?? null;

      const narrativeInput = {
        context,
        userInput: phase === "opening" ? "（开篇：请依据人物档案与命运写下第一章）" : input.userInput,
        mode: input.mode,
        worldState: input.worldState,
        recentTurns: input.recentTurns as Array<{ input: string; text: string }>,
        summary: input.summary,
        previousResponseId: input.previousResponseId,
        phase,
        chapterLength: input.chapterLength,
        lorePassages,
        styleAnchors: pickStyleAnchors(JSON.stringify(input.context)),
      };

      // Failure policy: retry exactly once, then report honestly. Never substitute template prose.
      let narrativeError: string | null = null;
      for (let attempt = 0; attempt < 2 && chapterText.trim().length === 0; attempt += 1) {
        try {
          for await (const chunk of streamTurnNarrative(narrativeInput, aiConfig)) {
            if (chunk.type === "delta") { chapterText += chunk.delta; send("delta", { delta: chunk.delta }); }
            if (chunk.type === "done") responseId = chunk.responseId ?? responseId;
          }
          narrativeError = null;
        } catch (error) {
          narrativeError = error instanceof Error ? error.message : String(error);
        }
      }
      if (chapterText.trim().length === 0) {
        send("error", {
          message: narrativeError ?? "正文生成失败",
          hint: aiConfig.configured ? "模型没有返回内容，可以点「重试」再试一次。" : "尚未配置 AI：请到「幕后控制台 → AI 接口与模型强度」填入 API Key。",
          retryable: true,
        });
        controller.close();
        return;
      }

      const snapshot = { worldState, flags, actors, items };
      let adjudication = await adjudicateTurn({ ...narrativeInput, chapterText }, aiConfig);
      if (!adjudication) adjudication = localAdjudication(input.userInput || "开篇", snapshot);
      const operations = adjudication.operations as TurnOperation[];
      const applied = applyTurnOperations(snapshot, operations);
      send("state", { worldState: applied.worldState, flags: applied.flags, actors: applied.actors, items: applied.items, taskProposals: applied.taskProposals, operations, suggestedChoices: adjudication.suggestedChoices, summaryDelta: adjudication.summaryDelta });
      send("done", { responseId, elapsedMs: Date.now() - startedAt, provider: aiConfig.configured ? aiConfig.provider : "local", model: aiConfig.configured ? aiConfig.narrativeModel : "local-narrative" });
      controller.close();
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
}





