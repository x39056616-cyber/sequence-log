import { db } from "@/lib/db";
import { buildAIContext, contextHash } from "@/lib/adventure/privacy";
import { clientAIConfigHeader } from "@/lib/ai/client-config";
import { buildLoreGrounding } from "@/lib/lore/grounding";
import { getPathway, getSequence } from "@/lib/lore/pathways";
import { planAdventure } from "@/lib/adventure/planner";
import { calculateDigestionCap } from "@/lib/domain/digestion";
import { localDay } from "@/lib/domain/time";
import { buildRollingSummary, shouldPersistSummary } from "@/lib/adventure/summary";
import { branchFromCheckpoint, commitStoryTurn, createStoryCheckpoint, getActiveCharacterBackground, getActiveFateProfile, getStoryContext, recordAIRequest, saveAdventureEvent, saveSceneAsset, saveStorySummary } from "@/lib/repository";
import type { AdventureEvent, BackgroundFields, Quest, QuestCompletion, SceneAsset, StoryActor, StoryFlag, StoryInputMode, StoryItem, StoryThread, StoryTurn, TaskProposal, TurnOperation, WorldState } from "@/lib/types";
import { uid } from "@/lib/utils";

export interface AdventureStatus {
  textConfigured: boolean;
  imageConfigured: boolean;
  provider: string;
  protocol: string;
  baseUrl: string;
  model: string;
  narrativeModel: string;
  adjudicatorModel: string;
  imageModel: string;
}

export async function getAdventureStatus(): Promise<AdventureStatus> {
  try {
    const response = await fetch("/api/adventure/status", { cache: "no-store" });
    if (!response.ok) throw new Error("status failed");
    return await response.json() as AdventureStatus;
  } catch {
    return { textConfigured: false, imageConfigured: false, provider: "local", protocol: "local", baseUrl: "", model: "local-planner", narrativeModel: "local-narrative", adjudicatorModel: "local-adjudicator", imageModel: "" };
  }
}

export async function generateScene(event: AdventureEvent) {
  if (!event.proposals.length) return null;
  try {
    const response = await fetch("/api/adventure/image", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...clientAIConfigHeader() },
      body: JSON.stringify({ prompt: `Vertical visual novel background, Victorian occult investigation, grey fog, brass, black ink, no text, no people in foreground. Scene mood: ${event.sceneMood}. Event: ${event.title}.` }),
    });
    if (!response.ok) return null;
    const payload = await response.json() as { dataUrl: string; promptHash: string };
    const asset: SceneAsset = { id: uid(), eventId: event.id, mimeType: "image/png", dataUrl: payload.dataUrl, promptHash: payload.promptHash, createdAt: new Date().toISOString() };
    await saveSceneAsset(asset);
    return asset;
  } catch {
    return null;
  }
}

interface TurnStatePayload {
  worldState: WorldState;
  flags: StoryFlag[];
  actors: StoryActor[];
  items: StoryItem[];
  taskProposals: TaskProposal[];
  operations: TurnOperation[];
  suggestedChoices: Array<{ id: string; label: string; description: string }>;
  summaryDelta: string;
}

export interface StoryTurnResult {
  turn: StoryTurn;
  thread: StoryThread;
  worldState: WorldState;
  flags: StoryFlag[];
  actors: StoryActor[];
  items: StoryItem[];
  taskProposals: TaskProposal[];
  suggestedChoices: Array<{ id: string; label: string; description: string }>;
}
export async function generateAdventure(kind: "daily" | "manual") {
  const [profile, state, settings, quests, completions, attributes, flags, events, fate, background] = await Promise.all([
    db.personalProfile.get("me"), db.sequenceState.get("active"), db.settings.get("app"), db.quests.toArray(), db.completions.toArray(), db.attributes.toArray(), db.storyFlags.toArray(), db.adventureEvents.orderBy("createdAt").reverse().toArray(), getActiveFateProfile(), getActiveCharacterBackground(),
  ]);
  if (!profile || !state || !settings) throw new Error("核心资料尚未初始化");
  const date = localDay(new Date(), settings.timezone);
  if (kind === "daily") {
    const existing = await db.adventureEvents.where("[localDate+kind]").equals([date, "daily"]).first();
    if (existing) return { event: existing, reused: true };
  } else {
    const manualCount = events.filter((event) => event.localDate === date && event.kind === "manual").length;
    if (manualCount >= 2) throw new Error("今天已经完成两次主动探查");
  }
  // The skeleton is always local: the long-form chapter itself is produced by the opening turn.
  const draft = planAdventure({ localDate: date, kind, profile, quests, completions, attributes, settings, pathwayId: state.pathwayId, sequence: state.sequence, flags, fate });
  const saved = await saveAdventureEvent({ ...draft, backgroundId: background?.id ?? null });
  await recordAIRequest({
    id: uid(), provider: "local", protocol: "local-planner", model: "local-planner", endpoint: "local-planner",
    contextHash: await contextHash({ localDate: date, kind, pathwayId: state.pathwayId, sequence: state.sequence, fate: fate?.id ?? null }),
    contextPreview: "本地骨架：标题、选项与现实任务提案。正文由开篇回合生成。",
    status: "fallback", error: "", createdAt: new Date().toISOString(),
  });
  return { event: saved, reused: false };
}

export interface BackgroundDraftResult {
  fields: BackgroundFields;
  backgroundText: string;
  provider: string;
  model: string;
}

/** Generates the character background from the active fate. Retries once server-side. */
export async function generateBackgroundDraft(): Promise<BackgroundDraftResult> {
  const [fate, state, profile] = await Promise.all([
    getActiveFateProfile(), db.sequenceState.get("active"), db.personalProfile.get("me"),
  ]);
  if (!fate || fate.attributes.length === 0) throw new Error("请先在转盘抽出命运，再生成人物背景。");
  const sequence = state ? getSequence(state.pathwayId, state.sequence) : null;
  const pathway = state ? getPathway(state.pathwayId) : null;
  const startedAt = Date.now();
  const response = await fetch("/api/adventure/background", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...clientAIConfigHeader() },
    body: JSON.stringify({
      fateSummary: fate.attributes.map((attribute) => attribute.categoryLabel + "：" + attribute.optionLabel).join("｜"),
      fateAttributes: fate.attributes.map((attribute) => ({ category: attribute.categoryLabel, value: attribute.optionLabel, sourceNote: attribute.sourceNote })),
      pathwayName: pathway?.name ?? "未选择",
      sequenceName: sequence?.name ?? "未知",
      sequenceRank: state?.sequence ?? 9,
      realitySummary: (profile?.summary ?? "").slice(0, 400),
      // 原著依据包：让 AI 有据可依，而不是自由发挥
      loreGrounding: buildLoreGrounding({ pathwayId: state?.pathwayId ?? null, sequence: state?.sequence ?? 9, fateAttributes: fate.attributes }),
      existingFields: {},
    }),
  });
  const payload = await response.json() as (BackgroundDraftResult & { error?: string });
  if (!response.ok) throw new Error(payload.error || "人物背景生成失败");
  await recordAIRequest({
    id: uid(), provider: payload.provider, protocol: "background", model: payload.model, endpoint: "/api/adventure/background",
    contextHash: await contextHash({ fateProfileId: fate.id, pathwayId: state?.pathwayId ?? null, sequence: state?.sequence ?? 9 }),
    contextPreview: "人物背景生成", status: "success", error: "", outputChars: payload.backgroundText.length,
    elapsedMs: Date.now() - startedAt, createdAt: new Date().toISOString(),
  });
  return { fields: payload.fields, backgroundText: payload.backgroundText, provider: payload.provider, model: payload.model };
}

async function runTurn(input: {
  threadId: string;
  userInput: string;
  mode: StoryInputMode;
  phase: "opening" | "turn";
  onDelta?: (delta: string) => void;
}) {
  const [profile, state, settings, quests, completions, habits, habitLogs, context, fate, background] = await Promise.all([
    db.personalProfile.get("me"), db.sequenceState.get("active"), db.settings.get("app"), db.quests.toArray(), db.completions.toArray(), db.habits.toArray(), db.habitLogs.toArray(), getStoryContext(input.threadId), getActiveFateProfile(), getActiveCharacterBackground(),
  ]);
  if (!profile || !state || !settings || !context.thread || !context.worldState) throw new Error("故事时间线不存在");
  const date = localDay(new Date(), settings.timezone);
  const digestionCap = calculateDigestionCap(state.sequence, settings);
  const aiContext = buildAIContext({
    localDate: date, profile, quests, completions, flags: context.flags, events: await db.adventureEvents.toArray(), habits, habitLogs,
    pathwayId: state.pathwayId, sequence: state.sequence, digestion: state.digestion, digestionCap, status: settings.status,
    fate, background, skills: await db.skills.toArray(), relationships: await db.storyActors.toArray(),
  });
  await createStoryCheckpoint({ threadId: input.threadId, turnId: context.thread.currentTurnId, label: input.phase === "opening" ? "第一章开始" : "自动存档 · 回合开始", automatic: true });
  const startedAt = Date.now();
  const response = await fetch("/api/adventure/turn", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...clientAIConfigHeader() },
    body: JSON.stringify({
      context: aiContext,
      userInput: input.userInput,
      mode: input.mode,
      worldState: context.worldState,
      flags: context.flags,
      actors: context.actors,
      items: context.items,
      recentTurns: context.turns.slice(0, 6).map((turn) => ({ input: turn.userInput, text: turn.chapterText })),
      summary: context.summaries[0]?.text ?? context.worldState.summary,
      previousResponseId: context.thread.providerResponseId,
      sequenceName: getSequence(state.pathwayId, state.sequence)?.name ?? "未知",
      pathwayName: getPathway(state.pathwayId)?.name ?? "未知",
      goal: profile.goals.find((goal) => goal.active)?.title,
      phase: input.phase,
      chapterLength: settings.chapterLength ?? "long",
    }),
  });
  if (!response.ok || !response.body) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error ?? "叙事服务不可用");
  }

  let chapterText = "";
  let statePayload: TurnStatePayload | null = null;
  let streamError: string | null = null;
  let responseId: string | null = context.thread.providerResponseId;
  let provider = context.thread.provider;
  let model = context.thread.model;
  const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ""; let eventName = ""; let dataLine = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n"); buffer = lines.pop() ?? "";
    for (const raw of lines) {
      const line = raw.trimEnd();
      if (!line) {
        if (dataLine) {
          const payload = JSON.parse(dataLine) as Record<string, unknown>;
          if (eventName === "delta" && typeof payload.delta === "string") { chapterText += payload.delta; input.onDelta?.(payload.delta); }
          if (eventName === "state") statePayload = payload as unknown as NonNullable<typeof statePayload>;
          if (eventName === "error") streamError = [payload.message, payload.hint].filter((item) => typeof item === "string" && item).join(" —— ");
          if (eventName === "done") { responseId = typeof payload.responseId === "string" ? payload.responseId : responseId; provider = typeof payload.provider === "string" ? payload.provider : provider; model = typeof payload.model === "string" ? payload.model : model; }
        }
        eventName = ""; dataLine = ""; continue;
      }
      if (line.startsWith("event:")) eventName = line.slice(6).trim();
      if (line.startsWith("data:")) dataLine += line.slice(5).trim();
    }
  }

  // Honest failure: if no prose came back, surface the reason and keep the previous chapter untouched.
  if (chapterText.trim().length === 0) {
    const detail = streamError ?? "模型没有返回正文";
    const error = new Error(detail);
    error.name = "NarrationFailed";
    throw error;
  }

  const finalState = statePayload as TurnStatePayload | null;
  if (!finalState) throw new Error("叙事裁定缺失，请重试本轮。");
  const turn: StoryTurn = {
    id: uid(), threadId: input.threadId, parentTurnId: context.thread.currentTurnId, inputMode: input.mode,
    userInput: input.phase === "opening" ? "（第一章开篇）" : input.userInput,
    chapterText, operations: finalState.operations, suggestedChoices: finalState.suggestedChoices,
    providerResponseId: responseId, provider, model, status: "complete", createdAt: new Date().toISOString(),
  };
  const turnCount = context.turns.length + 1;
  const summaryText = buildRollingSummary({
    previous: context.summaries[0]?.text ?? context.worldState.summary,
    delta: finalState.summaryDelta,
    knownFacts: finalState.worldState.knownFacts,
    openThreads: finalState.worldState.openThreads,
  });
  finalState.worldState.summary = summaryText;
  await commitStoryTurn({ turn, worldState: finalState.worldState, flags: finalState.flags, actors: finalState.actors, items: finalState.items });
  if (shouldPersistSummary(turnCount)) {
    await saveStorySummary({ id: uid(), threadId: input.threadId, throughTurnId: turn.id, text: summaryText, createdAt: new Date().toISOString() });
  }
  await recordAIRequest({
    id: uid(), provider, protocol: "turn", model, endpoint: "/api/adventure/turn",
    contextHash: await contextHash({ threadId: input.threadId, phase: input.phase, userInput: input.userInput.slice(0, 120) }),
    contextPreview: input.phase === "opening" ? "第一章开篇" : "回合推进", status: "success", error: "", outputChars: chapterText.length,
    elapsedMs: Date.now() - startedAt, createdAt: new Date().toISOString(),
  });
  return { turn, thread: { ...context.thread, currentTurnId: turn.id, providerResponseId: responseId }, worldState: finalState.worldState, flags: finalState.flags, actors: finalState.actors, items: finalState.items, taskProposals: finalState.taskProposals, suggestedChoices: finalState.suggestedChoices } satisfies StoryTurnResult;
}

export async function submitStoryTurn(input: {
  threadId: string;
  userInput: string;
  mode: StoryInputMode;
  onDelta?: (delta: string) => void;
}) {
  return runTurn({ ...input, phase: "turn" });
}

/** Generates the opening chapter (1500–2500 chars) as the first turn of the timeline. */
export async function startOpening(threadId: string, onDelta?: (delta: string) => void) {
  return runTurn({ threadId, userInput: "", mode: "auto", phase: "opening", onDelta });
}

export async function undoLatestStoryTurn(threadId: string) {
  const checkpoints = await db.storyCheckpoints.where("threadId").equals(threadId).reverse().sortBy("createdAt");
  const latest = checkpoints.find((checkpoint) => checkpoint.automatic);
  if (!latest) throw new Error("没有可用的存档点");
  return branchFromCheckpoint(latest.id);
}

export async function createNamedCheckpoint(threadId: string, label: string) {
  const context = await getStoryContext(threadId);
  if (!context.thread) throw new Error("时间线不存在");
  return createStoryCheckpoint({ threadId, turnId: context.thread.currentTurnId, label, automatic: false });
}

export async function createRealityEcho(quest: Quest, completion: QuestCompletion) {
  if (!quest.originEventId) return null;
  const event = await db.adventureEvents.get(quest.originEventId);
  if (!event?.threadId) return null;
  const quality = { missed: "未达成", done: "完成", good: "良好", excellent: "卓越" }[completion.quality];
  return submitStoryTurn({ threadId: event.threadId, userInput: `现实行动“${quest.title}”已经结束，完成质量为${quality}，实际用时${completion.actualMinutes}分钟。请只根据这个结果生成现实回响，不增加隐藏 XP。`, mode: "action" });
}













