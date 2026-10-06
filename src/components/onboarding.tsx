"use client";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { BookOpen, Eye, LoaderCircle, Sparkles } from "lucide-react";
import { db } from "@/lib/db";
import { PATHWAYS } from "@/lib/lore/pathways";
import { selectPathway } from "@/lib/repository";
import { PathwayTarot } from "@/components/pathway-tarot";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function Onboarding() {
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const achievements = useLiveQuery(() => db.achievements.toArray(), [], []);
  const path = PATHWAYS.find((item) => item.id === selected) ?? null;
  async function confirm() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      await selectPathway(selected);
    } catch (cause) {
      console.error("selectPathway failed", cause);
      setError(cause instanceof Error ? cause.message + "\n" + (cause.stack ?? "") : String(cause));
    } finally {
      setSaving(false);
    }
  }
  return <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-10">
    <header className="mb-8 flex items-center justify-between">
      <div className="flex items-center gap-3"><Eye className="size-6 text-brass-bright" /><div><p className="serif text-lg gold-text">SEQUENCE</p><p className="text-[11px] tracking-[0.3em] text-muted">序列日志</p></div></div>
      <Badge>开局 · 选择途径</Badge>
    </header>
    <section className="grid flex-1 gap-8 lg:grid-cols-[1fr_360px]">
      <div>
        <p className="text-xs tracking-[0.3em] text-brass">THE FIRST CARD</p>
        <h1 className="serif mt-3 max-w-3xl text-4xl leading-tight sm:text-5xl">从二十二张大阿卡纳中，选择你在现实里的非凡途径。</h1>
        <p className="mt-5 max-w-2xl text-sm leading-7 text-muted">选择后不可随意更换；到达序列 4 或 3 时，才可通过相邻途径转途。所有现实任务都应保持安全、合法和不伤害自己或他人。</p>
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {PATHWAYS.map((pathway) => <button key={pathway.id} type="button" data-testid={"pathway-" + pathway.id} onClick={() => setSelected(pathway.id)} className={`tarot-choice group relative mx-auto w-full max-w-[230px] text-left ${selected === pathway.id ? "is-selected" : ""}`} aria-pressed={selected === pathway.id}>
            <PathwayTarot pathway={pathway} />
            <span className="tarot-choice-caption"><span className="text-[10px] tracking-[0.16em] text-muted">{pathway.tarot}</span><span className="text-[10px] text-muted">起始 · {pathway.sequences[0].name}</span></span>
          </button>)}
        </div>
      </div>
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="panel rune-corner rounded-xl p-6">
          {!path ? <div className="grid min-h-80 place-items-center text-center"><div><BookOpen className="mx-auto size-8 text-muted" /><p className="mt-3 text-sm text-muted">选择一张牌，查看途径档案。</p></div></div> : <div className="space-y-5">
            <div className="mx-auto w-[190px] max-w-full"><PathwayTarot pathway={path} /></div>
            <div><p className="text-xs tracking-[0.25em] text-brass">{path.tarot}</p><h2 className="serif mt-1 text-3xl">{path.name}途径</h2><p className="mt-2 text-sm text-muted">源质：{path.sefirah} · 终点：{path.sequence0}</p></div>
            <div className="space-y-2">{[9,8,7,6,5,4,3,2,1,0].map((sequence) => <div key={sequence} className="flex items-center justify-between border-b border-border/50 pb-2 text-sm"><span className="text-muted">序列 {sequence}</span><span>{path.sequences.find((item) => item.sequence === sequence)?.name}</span></div>)}</div>
            <Button data-testid="confirm-pathway" className="w-full" onClick={confirm} disabled={saving}>{saving ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}确认选择并开始</Button>
            {error && <div role="alert" className="rounded-md border border-danger/60 bg-danger/10 p-3 text-xs leading-5 text-danger"><p className="font-semibold">选择途径失败</p><pre className="mt-1 whitespace-pre-wrap break-all">{error}</pre></div>}
          </div>}
        </div>
        <p className="mt-4 text-xs leading-5 text-muted">已有成就：{achievements.filter((item) => item.unlockedAt).length}。未完成资料会明确标记，不伪造原作内容。</p>
      </aside>
    </section>
  </main>;
}
