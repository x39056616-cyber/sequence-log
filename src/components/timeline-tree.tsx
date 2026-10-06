"use client";

import { GitBranch, History } from "lucide-react";
import type { AdventureEvent, StoryCheckpoint, StoryThread, StoryTurn } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface TimelineTreeProps {
  threads: StoryThread[];
  checkpoints: StoryCheckpoint[];
  turns: StoryTurn[];
  events: AdventureEvent[];
  currentThreadId: string | null;
  onSelect: (eventId: string) => void;
  onBranch: (checkpointId: string) => void;
}

export function TimelineTree({ threads, checkpoints, turns, events, currentThreadId, onSelect, onBranch }: TimelineTreeProps) {
  const childrenByCheckpoint = new Map<string, StoryThread[]>();
  for (const thread of threads) {
    if (!thread.parentCheckpointId) continue;
    const rows = childrenByCheckpoint.get(thread.parentCheckpointId) ?? [];
    rows.push(thread);
    childrenByCheckpoint.set(thread.parentCheckpointId, rows);
  }
  const knownCheckpoints = new Set(checkpoints.map((checkpoint) => checkpoint.id));
  const roots = threads.filter((thread) => !thread.parentCheckpointId || !knownCheckpoints.has(thread.parentCheckpointId));

  function ThreadNode({ thread, depth }: { thread: StoryThread; depth: number }) {
    const event = events.find((item) => item.id === thread.eventId);
    const threadCheckpoints = checkpoints.filter((checkpoint) => checkpoint.threadId === thread.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const turnCount = turns.filter((turn) => turn.threadId === thread.id).length;
    return (
      <div style={{ marginLeft: depth * 16 }} className="space-y-2">
        <button
          type="button"
          onClick={() => onSelect(thread.eventId)}
          className={"w-full rounded-md border p-3 text-left transition " + (thread.id === currentThreadId ? "border-brass bg-brass/10" : "border-border bg-panel-soft hover:border-brass/50")}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted">
            <span className="flex items-center gap-1"><History className="size-3" />{thread.createdAt.slice(0, 10)} · {thread.parentCheckpointId ? "平行分支" : "原始时间线"}</span>
            <Badge>{thread.status}</Badge>
          </div>
          <p className="serif mt-2 text-sm">{thread.title}</p>
          <p className="mt-1 line-clamp-2 text-[11px] text-muted">{event?.opening}</p>
          <p className="mt-2 text-[10px] text-muted">回合 {turnCount} · 存档点 {threadCheckpoints.length}</p>
        </button>

        {threadCheckpoints.map((checkpoint) => (
          <div key={checkpoint.id} className="ml-3 border-l border-border/70 pl-3">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/70 bg-black/10 p-2 text-[11px]">
              <span>{checkpoint.automatic ? "自动存档" : "命名存档"} · {checkpoint.label} · {new Date(checkpoint.createdAt).toLocaleString("zh-CN")}</span>
              <Button size="sm" variant="ghost" onClick={() => onBranch(checkpoint.id)}><GitBranch className="size-3" />从此分支</Button>
            </div>
            {(childrenByCheckpoint.get(checkpoint.id) ?? []).map((child) => <div key={child.id} className="mt-2"><ThreadNode thread={child} depth={depth + 1} /></div>)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {roots.map((thread) => <ThreadNode key={thread.id} thread={thread} depth={0} />)}
      {!roots.length && <p className="text-xs text-muted">还没有时间线。先在冒险页开始第一章。</p>}
    </div>
  );
}