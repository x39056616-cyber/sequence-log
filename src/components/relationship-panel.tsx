"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Users } from "lucide-react";
import { db } from "@/lib/db";
import { listRelationships } from "@/lib/repository";
import { clampRelationship } from "@/lib/domain/skill";
import type { RelationshipAttitude } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const ATTITUDE_CLASS: Record<RelationshipAttitude, string> = {
  敌对: "border-danger/40 text-danger",
  警惕: "border-warning/40 text-warning",
  中立: "border-border text-muted",
  友好: "border-brass/40 text-brass-bright",
  信任: "border-moss/40 text-moss",
};

export function RelationshipPanel() {
  const [scope, setScope] = useState<"all" | "current">("current");
  const threads = useLiveQuery(() => db.storyThreads.orderBy("updatedAt").reverse().limit(1).toArray(), [], []);
  const currentThreadId = threads[0]?.id ?? null;
  const actors = useLiveQuery(() => listRelationships(scope === "current" ? currentThreadId : null), [scope, currentThreadId], []);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="serif flex items-center gap-2 text-xl"><Users className="size-4 text-brass" />人物关系</h2>
            <p className="mt-1 text-xs text-muted">关系只能由剧情推进改变：态度由关系值推导，你无法手动调整，也不会被随机扣分。</p>
          </div>
          <div className="flex gap-2">
            {(["current", "all"] as const).map((key) => (
              <button key={key} type="button" onClick={() => setScope(key)} className={"rounded-full border px-3 py-1 text-xs " + (scope === key ? "border-brass bg-brass/15 text-brass-bright" : "border-border text-muted hover:border-brass/50")}>{key === "current" ? "当前时间线" : "全部"}</button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {actors.map((actor) => {
          const attitude = actor.attitude ?? "中立";
          const percent = ((clampRelationship(actor.relationship) + 100) / 200) * 100;
          return (
            <div key={actor.id} className="rounded-md border border-border bg-panel-soft p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="serif">{actor.name}</span>
                  <Badge className={ATTITUDE_CLASS[attitude]}>{attitude}</Badge>
                  {actor.faction && <Badge>{actor.faction}</Badge>}
                </div>
                <span className="text-[11px] text-muted">{actor.relationship > 0 ? "+" : ""}{actor.relationship}</span>
              </div>
              <p className="mt-1 text-[11px] text-muted">{actor.role}{actor.notes ? " · " + actor.notes : ""}</p>
              <div className="mt-2"><Progress value={percent} /></div>
              {actor.lastInteractionAt && <p className="mt-1 text-[10px] text-muted">最近互动：{new Date(actor.lastInteractionAt).toLocaleString("zh-CN")}</p>}
            </div>
          );
        })}
        {actors.length === 0 && <p className="text-xs text-muted">还没有记录到人物关系。推进剧情后会自然出现。</p>}
      </CardContent>
    </Card>
  );
}
