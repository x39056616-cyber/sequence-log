"use client";
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Columns3, ListFilter, Plus, Search } from "lucide-react";
import { db } from "@/lib/db";
import { deleteQuest } from "@/lib/repository";
import type { Quest, QuestStatus } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { QuestCard } from "@/components/quest-card";
import { QuestForm } from "@/components/quest-form";
import { CompleteQuestDialog } from "@/components/complete-quest-dialog";

const columns: Array<{ id: QuestStatus; label: string }> = [{ id: "inbox", label: "收集箱" }, { id: "today", label: "今日" }, { id: "active", label: "进行中" }, { id: "completed", label: "已完成" }];

export default function QuestsPage() {
  const quests = useLiveQuery(() => db.quests.orderBy("createdAt").reverse().toArray(), [], []);
  const [editing, setEditing] = useState<Quest | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [completing, setCompleting] = useState<Quest | null>(null);
  const [status, setStatus] = useState<"all" | QuestStatus>("all");
  const [type, setType] = useState<"all" | Quest["type"]>("all");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"list" | "board">("list");
  const filtered = useMemo(() => quests.filter((quest) => (status === "all" || quest.status === status) && (type === "all" || quest.type === type) && (!query || [quest.title, quest.description, ...quest.tags].join(" ").toLowerCase().includes(query.toLowerCase()))), [quests, status, type, query]);
  function add() { setEditing(null); setFormOpen(true); }
  async function remove(quest: Quest) { if (window.confirm("删除任务及其结算历史？此操作不可恢复。")) await deleteQuest(quest.id); }
  return <div className="space-y-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs tracking-[0.28em] text-brass">QUEST BOARD · 非凡委托</p><h1 className="serif mt-2 text-3xl">承接灰雾之上的现实委托</h1><p className="mt-2 text-sm text-muted">叙事负责包装，行动标准、时长和限制保持清晰可见。</p></div><Button onClick={add}><Plus className="size-4" />新建任务</Button></div>
    <Card><CardContent className="flex flex-col gap-3 lg:flex-row lg:items-center"><div className="relative flex-1"><Search className="absolute left-3 top-3 size-4 text-muted" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题、描述或标签" className="pl-9" /></div><Select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="lg:w-36"><option value="all">全部状态</option>{columns.map((column) => <option key={column.id} value={column.id}>{column.label}</option>)}</Select><Select value={type} onChange={(event) => setType(event.target.value as typeof type)} className="lg:w-36"><option value="all">全部类型</option><option value="main">主线</option><option value="side">支线</option><option value="daily">日常</option><option value="weekly">每周</option><option value="boss">首领</option></Select><div className="flex rounded-md border border-border p-1"><Button variant={view === "list" ? "default" : "ghost"} size="sm" onClick={() => setView("list")}><ListFilter className="size-4" />列表</Button><Button variant={view === "board" ? "default" : "ghost"} size="sm" onClick={() => setView("board")}><Columns3 className="size-4" />看板</Button></div></CardContent></Card>
    <div className="flex flex-wrap gap-2"><Badge>全部 {quests.length}</Badge>{columns.map((column) => <Badge key={column.id}>{column.label} {quests.filter((item) => item.status === column.id).length}</Badge>)}</div>
    {view === "list" ? <div className="space-y-3">{filtered.map((quest) => <QuestCard key={quest.id} quest={quest} onEdit={(item) => { setEditing(item); setFormOpen(true); }} onComplete={setCompleting} onDelete={remove} />)}{!filtered.length && <Card><CardContent className="py-16 text-center text-sm text-muted">没有符合筛选条件的任务。</CardContent></Card>}</div> : <div className="grid gap-4 lg:grid-cols-4">{columns.map((column) => <div key={column.id} className="panel rounded-lg p-3"><div className="mb-3 flex items-center justify-between px-1"><h2 className="serif text-base">{column.label}</h2><Badge>{filtered.filter((item) => item.status === column.id).length}</Badge></div><div className="space-y-3">{filtered.filter((item) => item.status === column.id).map((quest) => <QuestCard key={quest.id} quest={quest} onEdit={(item) => { setEditing(item); setFormOpen(true); }} onComplete={setCompleting} onDelete={remove} />)}</div></div>)}</div>}
    <QuestForm open={formOpen} onClose={() => setFormOpen(false)} quest={editing} />
    <CompleteQuestDialog key={completing?.id ?? "empty"} quest={completing} onClose={() => setCompleting(null)} />
  </div>;
}


