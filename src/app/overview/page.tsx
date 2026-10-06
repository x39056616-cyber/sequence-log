"use client";
import { useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowRight, CalendarDays, CheckCircle2, CircleDashed, Plus, Sparkles } from "lucide-react";
import { db } from "@/lib/db";
import { calculateDigestionCap, calculateStatusAverage, statusBand } from "@/lib/domain/digestion";
import { getPathway, getSequence } from "@/lib/lore/pathways";
import { localDay } from "@/lib/domain/time";
import { advanceSequence } from "@/lib/repository";
import type { Quest } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PathwayTarot } from "@/components/pathway-tarot";
import { QuestForm } from "@/components/quest-form";
import { QuestCard } from "@/components/quest-card";
import { CompleteQuestDialog } from "@/components/complete-quest-dialog";
import { StatusCheckIn } from "@/components/status-check-in";

export default function DashboardPage() {
  const [adding, setAdding] = useState(false);
  const [completing, setCompleting] = useState<Quest | null>(null);
  const [advanceMessage, setAdvanceMessage] = useState("");
  const profile = useLiveQuery(() => db.profile.get("me"), []);
  const state = useLiveQuery(() => db.sequenceState.get("active"), []);
  const settings = useLiveQuery(() => db.settings.get("app"), []);
  const quests = useLiveQuery(() => db.quests.orderBy("createdAt").reverse().toArray(), [], []);
  const completions = useLiveQuery(() => db.completions.orderBy("completedAt").reverse().toArray(), [], []);
  if (!profile || !state || !settings || !state.pathwayId) return null;
  const pathway = getPathway(state.pathwayId);
  const sequence = getSequence(state.pathwayId, state.sequence);
  if (!pathway || !sequence) return null;
  const cap = calculateDigestionCap(state.sequence, settings);
  const today = localDay(new Date(), settings.timezone);
  const active = quests.filter((quest) => quest.status === "today" || quest.status === "active");
  const completedToday = completions.filter((item) => !item.revokedAt && item.completedAt.slice(0, 10) === today).length;
  const validCompletions = completions.filter((item) => !item.revokedAt).slice(0, 30);
  const planCount = active.length + completedToday;
  const rate = planCount ? Math.round(completedToday / planCount * 100) : 0;
  const average = calculateStatusAverage(settings.status);
  const band = statusBand(average);
  async function promote() { try { const result = await advanceSequence(); setAdvanceMessage("晋升完成：序列 " + result.sequence + "·" + result.name); } catch (error) { setAdvanceMessage(error instanceof Error ? error.message : "晋升失败"); } }
  return <div className="space-y-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs tracking-[0.28em] text-brass">DASHBOARD · 灰雾之上</p><h1 className="serif mt-2 text-3xl sm:text-4xl">今日的记录，决定魔药如何消化。</h1><p className="mt-2 text-sm text-muted">{profile.name}，当前处于 {pathway.name}途径 · 序列 {state.sequence}「{sequence.name}」。</p></div><Button onClick={() => setAdding(true)}><Plus className="size-4" />快速派发任务</Button></div>
    <div className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
      <Card><CardContent className="grid gap-6 sm:grid-cols-[auto_1fr]">
        <div className="mx-auto w-[180px] max-w-full sm:w-[210px]"><PathwayTarot pathway={pathway} /></div>
        <div className="flex flex-col justify-between gap-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><Badge>{pathway.name}途径 · {pathway.tarot}</Badge><h2 className="serif mt-3 text-3xl">序列 {state.sequence} · {sequence.name}</h2><p className="mt-2 text-sm text-muted">当前阶段：{{formula:"取得配方",materials:"收集现实材料",acting:"服食并扮演",ritual:"完成晋升仪式",ready:"可以晋升"}[state.stage]}</p></div><div className="text-right"><div className="text-xs text-muted">累计灵性经验</div><div className="serif text-2xl gold-text">{profile.totalSpirituality}</div></div></div><div><div className="mb-2 flex items-center justify-between text-xs"><span className="text-muted">魔药消化度</span><span>{state.digestion} / {cap}</span></div><Progress value={state.digestion} max={cap} /><div className="mt-3 flex items-center justify-between text-xs text-muted"><span>达到 100% 后才能晋升</span><span>{Math.round(state.digestion / cap * 100)}%</span></div></div><div className="flex flex-wrap gap-2"><Button onClick={promote} disabled={state.digestion < cap}><Sparkles className="size-4" />尝试晋升</Button><Link href="/character"><Button variant="secondary">查看角色档案<ArrowRight className="size-4" /></Button></Link></div>{advanceMessage && <p className="text-xs gold-text">{advanceMessage}</p>}</div>
      </CardContent></Card>
      <StatusCheckIn settings={settings} />
    </div>
    <div className="grid gap-4 sm:grid-cols-3"><Metric icon={CheckCircle2} label="今日完成" value={completedToday} hint="以结算记录为准" /><Metric icon={CircleDashed} label="等待行动" value={active.length} hint="今日与进行中" /><Metric icon={CalendarDays} label="今日完成率" value={rate + "%"} hint="完成 / 计划" /></div>
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <Card><CardHeader><div><h2 className="serif text-xl">今日扮演任务</h2><p className="mt-1 text-xs text-muted">只有契合任务会推进消化；无关任务仍记录灵性经验与属性。</p></div><Link href="/quests" className="text-xs gold-text">任务中心 →</Link></CardHeader><CardContent className="space-y-3">{active.slice(0, 5).map((quest) => <QuestCard key={quest.id} quest={quest} onEdit={() => {}} onComplete={setCompleting} onDelete={() => {}} />)}{!active.length && <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted">今天暂无任务。派发一个足够明确的小任务。</div>}</CardContent></Card>
      <div className="space-y-5"><Card><CardHeader><div><h2 className="serif text-lg">恢复与稳定</h2><p className="mt-1 text-xs text-muted">稳定度不会自动扣除。</p></div></CardHeader><CardContent><div className="flex items-end justify-between"><span className={band.className === "danger" ? "text-danger" : band.className === "warning" ? "text-warning" : "text-moss"}>{band.label}</span><strong className="serif text-3xl">{average}</strong></div><Progress value={average} className="mt-3" /><p className="mt-3 text-xs leading-5 text-muted">低于 15 时可在角色页主动进行失控结算；不确认就不会倒退。</p></CardContent></Card><Card><CardHeader><h2 className="serif text-lg">近期结算</h2></CardHeader><CardContent className="space-y-3">{validCompletions.slice(0, 5).map((item) => <div key={item.id} className="flex items-center justify-between border-b border-border/50 pb-2 text-xs last:border-0"><div><p className="font-medium">{item.questTitle}</p><p className="mt-1 text-muted">{new Date(item.completedAt).toLocaleDateString("zh-CN")}</p></div><span className="gold-text">+{item.digestionAwarded}</span></div>)}{!validCompletions.length && <p className="text-xs text-muted">尚无结算记录。</p>}</CardContent></Card></div>
    </div>
    <QuestForm open={adding} onClose={() => setAdding(false)} />
    <CompleteQuestDialog key={completing?.id ?? "empty"} quest={completing} onClose={() => setCompleting(null)} />
  </div>;
}
function Metric({ icon: Icon, label, value, hint }: { icon: typeof CheckCircle2; label: string; value: string | number; hint: string }) { return <Card><CardContent className="flex items-center gap-4"><div className="grid size-11 place-items-center rounded-lg bg-brass/10 text-brass-bright"><Icon className="size-5" /></div><div><p className="text-xs text-muted">{label}</p><p className="serif text-2xl">{value}</p><p className="mt-1 text-[11px] text-muted">{hint}</p></div></CardContent></Card>; }



