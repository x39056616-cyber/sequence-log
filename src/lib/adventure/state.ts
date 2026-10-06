import type { StoryActor, StoryItem, StoryFlag, TaskProposal, TurnOperation, WorldState } from "@/lib/types";
import { clamp, uid } from "@/lib/utils";
import { attitudeFor } from "@/lib/domain/skill";

export interface WorldSnapshot {
  worldState: WorldState;
  flags: StoryFlag[];
  actors: StoryActor[];
  items: StoryItem[];
}

export function createInitialWorldState(threadId: string, chapter = 1): WorldState {
  const now = new Date().toISOString();
  return { id: threadId, threadId, chapter, timeLabel: "灰雾之上的清晨", location: "现实与灵界交界处", knownFacts: [], openThreads: [], canonDivergence: [], threatLevel: 0, protagonistState: "alive", summary: "", updatedAt: now };
}

export function applyTurnOperations(snapshot: WorldSnapshot, operations: TurnOperation[]) {
  const worldState: WorldState = { ...snapshot.worldState, knownFacts: [...snapshot.worldState.knownFacts], openThreads: [...snapshot.worldState.openThreads], canonDivergence: [...snapshot.worldState.canonDivergence] };
  const flags = [...snapshot.flags];
  const actors = [...snapshot.actors];
  const items = [...snapshot.items];
  const taskProposals: TaskProposal[] = [];
  const now = new Date().toISOString();
  for (const operation of operations) {
    if (operation.type === "set_location") worldState.location = operation.location.slice(0, 120);
    if (operation.type === "advance_time") worldState.timeLabel = operation.value.slice(0, 120);
    if (operation.type === "add_fact" && !worldState.knownFacts.includes(operation.fact)) worldState.knownFacts = [...worldState.knownFacts, operation.fact.slice(0, 300)].slice(-80);
    if (operation.type === "adjust_flag") {
      const existing = flags.find((flag) => flag.key === operation.key);
      const next = { id: existing?.id ?? uid(), threadId: worldState.threadId, key: operation.key, label: operation.label, description: operation.description ?? existing?.description ?? "", value: clamp((existing?.value ?? 0) + operation.delta, -100, 100), updatedAt: now };
      const index = flags.findIndex((flag) => flag.key === operation.key);
      if (index >= 0) flags[index] = next; else flags.push(next);
    }
    if (operation.type === "open_thread") worldState.openThreads = [...worldState.openThreads, { id: uid(), title: operation.title, description: operation.description, status: "open" as const }].slice(-40);
    if (operation.type === "resolve_thread") worldState.openThreads = worldState.openThreads.map((thread) => thread.title === operation.title ? { ...thread, status: "resolved" as const } : thread);
    if (operation.type === "upsert_actor") {
      const existing = actors.find((actor) => actor.name === operation.name);
      const relationship = clamp((existing?.relationship ?? 0) + operation.relationshipDelta, -100, 100);
      const next: StoryActor = {
        id: existing?.id ?? uid(), threadId: worldState.threadId, name: operation.name, role: operation.role,
        relationship, notes: operation.notes,
        faction: operation.faction ?? existing?.faction,
        attitude: operation.attitude ?? attitudeFor(relationship),
        tags: operation.tags ?? existing?.tags ?? [],
        lastInteractionAt: now, updatedAt: now,
      };
      const index = actors.findIndex((actor) => actor.name === operation.name);
      if (index >= 0) actors[index] = next; else actors.push(next);
    }
    if (operation.type === "add_item") items.push({ id: uid(), threadId: worldState.threadId, name: operation.name, description: operation.description, rarity: operation.rarity, status: "held", equipped: false, category: "beyond", updatedAt: now });
    if (operation.type === "remove_item") items.forEach((item) => { if (item.name === operation.name) item.status = "lost"; });
    if (operation.type === "canon_divergence" && !worldState.canonDivergence.includes(operation.description)) worldState.canonDivergence = [...worldState.canonDivergence, operation.description].slice(-80);
    if (operation.type === "set_protagonist_state") worldState.protagonistState = operation.state;
    if (operation.type === "add_task_proposal") taskProposals.push(operation.proposal);
  }
  worldState.updatedAt = now;
  return { worldState, flags, actors, items, taskProposals };
}

export function localOperationsFromInput(input: string, snapshot: WorldSnapshot): TurnOperation[] {
  const clean = input.trim().slice(0, 600);
  const operations: TurnOperation[] = [{ type: "add_fact", fact: "行动记录：" + clean }];
  if (/离开|前往|进入|走出|进入/.test(clean)) operations.push({ type: "set_location", location: "根据行动前往的新地点（待下一叙事确认）" });
  if (/调查|观察|线索|发现/.test(clean)) operations.push({ type: "open_thread", title: "行动带来的新线索", description: clean });
  if (/相信|帮助|救|保护/.test(clean)) operations.push({ type: "upsert_actor", name: "当前事件中的关键人物", role: "因你的选择建立联系", relationshipDelta: 1, notes: clean });
  if (/伤害|攻击|杀死|背叛/.test(clean)) operations.push({ type: "adjust_flag", key: "risk", label: "风险", delta: 1, description: "冲突行动提高了局势风险" });
  if (snapshot.worldState.protagonistState === "alive" && /死亡|自杀|杀掉自己/.test(clean)) operations.push({ type: "set_protagonist_state", state: "injured", description: "现实安全层不会执行自伤指令；剧情仅转化为受困或危机状态" });
  return operations;
}







