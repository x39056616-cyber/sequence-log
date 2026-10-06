"use client";

import { AlertTriangle, MapPin, Sparkles, Users } from "lucide-react";
import type { StoryActor, StoryFlag, StoryItem, WorldState } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

export function WorldStatePanel({
  worldState,
  actors,
  items,
  flags,
}: {
  worldState: WorldState;
  actors: StoryActor[];
  items: StoryItem[];
  flags: StoryFlag[];
}) {
  return (
    <div className="space-y-5 text-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="panel-soft rounded-md p-3">
          <p className="text-xs text-muted">时间与地点</p>
          <p className="mt-1 flex items-center gap-2"><MapPin className="size-4 text-brass" />{worldState.timeLabel} · {worldState.location}</p>
          <p className="mt-2 text-[11px] text-muted">当前第 {worldState.chapter} 章 · 主角状态：{worldState.protagonistState}</p>
        </div>
        <div className="panel-soft rounded-md p-3">
          <p className="text-xs text-muted">威胁与偏离</p>
          <p className="mt-1 flex items-center gap-2"><AlertTriangle className="size-4 text-warning" />威胁等级 {worldState.threatLevel}</p>
          <p className="mt-2 text-[11px] text-muted">{worldState.canonDivergence.length ? "已记录 " + worldState.canonDivergence.length + " 条原作偏离" : "仍在原作主线范围内"}</p>
        </div>
      </div>

      <section>
        <h3 className="serif flex items-center gap-2 text-base"><Sparkles className="size-4 text-brass" />已知事实</h3>
        <div className="mt-2 space-y-2">
          {worldState.knownFacts.map((fact, index) => <p key={index} className="rounded-md border border-border bg-panel-soft p-3 text-xs leading-5">{fact}</p>)}
          {!worldState.knownFacts.length && <p className="text-xs text-muted">尚无可确认事实。</p>}
        </div>
      </section>

      <section>
        <h3 className="serif flex items-center gap-2 text-base"><Users className="size-4 text-brass" />开放线索与人物关系</h3>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            {worldState.openThreads.map((thread) => <div key={thread.id} className="rounded-md border border-border bg-panel-soft p-3 text-xs"><div className="flex items-center justify-between gap-2"><strong>{thread.title}</strong><Badge>{thread.status}</Badge></div><p className="mt-1 text-muted">{thread.description}</p></div>)}
            {!worldState.openThreads.length && <p className="text-xs text-muted">当前没有未结线索。</p>}
          </div>
          <div className="space-y-2">
            {actors.map((actor) => <div key={actor.id} className="flex items-center justify-between rounded-md border border-border bg-panel-soft p-3 text-xs"><span>{actor.name} · {actor.role}</span><Badge>{actor.attitude ?? actor.relationship}</Badge></div>)}
            {!actors.length && <p className="text-xs text-muted">尚未建立人物关系。</p>}
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div>
          <h3 className="serif text-base">持有物</h3>
          <div className="mt-2 space-y-2">{items.map((item) => <div key={item.id} className="flex items-center justify-between rounded-md border border-border bg-panel-soft p-2 text-xs"><span>{item.name}</span><Badge>{item.status}</Badge></div>)}{!items.length && <p className="text-xs text-muted">没有记录持有物。</p>}</div>
        </div>
        <div>
          <h3 className="serif text-base">剧情旗标</h3>
          <div className="mt-2 space-y-2">{flags.map((flag) => <div key={flag.id} className="flex items-center justify-between rounded-md border border-border bg-panel-soft p-2 text-xs"><span>{flag.label || flag.key}</span><strong>{flag.value}</strong></div>)}{!flags.length && <p className="text-xs text-muted">没有记录剧情旗标。</p>}</div>
        </div>
      </section>
    </div>
  );
}