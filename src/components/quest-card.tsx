"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Clock3, MoreHorizontal } from "lucide-react";
import type { Quest } from "@/lib/types";
import { ACTING_FIT_LABEL, calculateBaseDigestion } from "@/lib/domain/digestion";
import { moveQuest, undoCompletion } from "@/lib/repository";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const statusLabels: Record<Quest["status"], string> = { inbox: "收集箱", today: "今日", active: "进行中", completed: "已完成" };
const typeLabels: Record<Quest["type"], string> = { main: "主线", side: "支线", daily: "日常", weekly: "每周", oneoff: "一次性", habit: "习惯", boss: "首领" };

export function QuestCard({ quest, onEdit, onComplete, onDelete }: { quest: Quest; onEdit: (quest: Quest) => void; onComplete: (quest: Quest) => void; onDelete: (quest: Quest) => void }) {
  const [menu, setMenu] = useState(false);
  const base = calculateBaseDigestion(quest);
  async function toggleComplete() {
    if (quest.status !== "completed") { onComplete(quest); return; }
    const { db } = await import("@/lib/db");
    const completion = await db.completions.where("questId").equals(quest.id).filter((item) => !item.revokedAt).first();
    if (completion) await undoCompletion(completion.id);
    else await moveQuest(quest.id, "active");
  }
  return <motion.article layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cn("panel-soft rounded-lg p-4", quest.status === "completed" && "opacity-70")}>
    <div className="flex items-start gap-3">
      <button type="button" aria-label={quest.status === "completed" ? "撤销完成" : "完成任务"} onClick={toggleComplete} className={cn("mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border text-xs", quest.status === "completed" ? "border-moss bg-moss/20 text-moss" : "border-border text-transparent hover:border-brass hover:text-brass")}>✓</button>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3"><div>{quest.narrativeTitle&&<p className="serif text-xs gold-text">{quest.narrativeTitle}</p>}<h3 className="font-medium">{quest.title}</h3>{quest.narrativeDescription?<p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">{quest.narrativeDescription}</p>:quest.description&&<p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">{quest.description}</p>}{quest.realityAction&&<div className="mt-3 rounded-md border border-brass/20 bg-black/10 p-3"><p className="text-[10px] uppercase tracking-wide text-muted">现实行动</p><p className="mt-1 text-xs leading-5">{quest.realityAction}</p>{quest.successCriteria&&<p className="mt-2 text-[11px] text-muted">完成标准：{quest.successCriteria}</p>}</div>}</div><div className="relative"><Button variant="ghost" size="icon" onClick={() => setMenu((value) => !value)} aria-label="任务菜单"><MoreHorizontal className="size-4" /></Button>{menu && <div className="absolute right-0 top-10 z-20 w-36 rounded-md border border-border bg-panel-solid p-1 shadow-xl"><button className="w-full rounded px-3 py-2 text-left text-xs hover:bg-panel-soft" onClick={() => { setMenu(false); onEdit(quest); }}>编辑</button><button className="w-full rounded px-3 py-2 text-left text-xs text-danger hover:bg-danger/10" onClick={() => { setMenu(false); onDelete(quest); }}>删除</button></div>}</div></div>
        <div className="mt-3 flex flex-wrap gap-2"><Badge>{typeLabels[quest.type]}</Badge><Badge>难度 {quest.difficulty}</Badge><Badge>{ACTING_FIT_LABEL[quest.actingFit]} · ×{quest.actingFit}</Badge><Badge>{base} 基础消化</Badge><Badge>{statusLabels[quest.status]}</Badge></div>
        <div className="mt-3 flex items-center justify-between text-[11px] text-muted"><span className="flex items-center gap-1"><Clock3 className="size-3" />{quest.estimatedMinutes} 分钟</span>{quest.dueAt && <span>截止 {new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(quest.dueAt))}</span>}</div>
      </div>
    </div>
  </motion.article>;
}

