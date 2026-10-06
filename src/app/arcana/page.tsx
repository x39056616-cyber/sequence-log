"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowRight, Eye, Sparkles } from "lucide-react";
import { db } from "@/lib/db";
import { PATHWAYS, getPathway } from "@/lib/lore/pathways";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PathwayTarot } from "@/components/pathway-tarot";

export default function ArcanaPage() {
  const state=useLiveQuery(()=>db.sequenceState.get("active"),[]);
  const currentId=state?.pathwayId??PATHWAYS[0].id;
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const selected=getPathway(selectedId??currentId)??PATHWAYS[0];
  const related=useMemo(()=>selected.adjacentIds.map(getPathway).filter(Boolean),[selected]);
  return <div className="space-y-7"><header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs tracking-[.28em] text-brass">ARCANA · 途径牌组</p><h1 className="serif mt-2 text-3xl sm:text-4xl">二十二张大阿卡纳</h1><p className="mt-2 max-w-2xl text-sm leading-7 text-muted">每张牌使用独立场景、途径组背景与新艺术风格边框。牌面代表角色主途径，不替代原有的序列与任务机制。</p></div><Badge><Eye className="mr-1 size-3"/>当前：{getPathway(currentId)?.name}途径</Badge></header>
  <div className="grid gap-7 xl:grid-cols-[1fr_360px]"><div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">{PATHWAYS.map(path=><button key={path.id} type="button" onClick={()=>setSelectedId(path.id)} className={`tarot-choice relative mx-auto w-full max-w-[220px] text-left ${selected.id===path.id?"is-selected":""}`}><PathwayTarot pathway={path}/><span className="tarot-choice-caption"><span className="text-[10px] text-muted">{path.tarot}</span>{path.id===currentId&&<span className="text-[10px] text-brass-bright">当前主途径</span>}</span></button>)}</div>
  <aside className="xl:sticky xl:top-24 xl:self-start"><Card><CardContent className="space-y-5"><div className="mx-auto w-[230px] max-w-full"><PathwayTarot pathway={selected}/></div><div><Badge>{selected.tarot}</Badge><h2 className="serif mt-3 text-3xl">{selected.name}途径</h2><p className="mt-2 text-sm text-muted">源质：{selected.sefirah} · 终点：{selected.sequence0}</p></div><div className="grid grid-cols-3 gap-2 text-center text-xs">{[9,8,7].map(sequence=>{const item=selected.sequences.find(value=>value.sequence===sequence);return <div key={sequence} className="panel-soft rounded-md p-3"><div className="text-muted">序列 {sequence}</div><div className="mt-1">{item?.name}</div></div>})}</div>{related.length>0&&<div><p className="mb-2 text-xs text-muted">相邻途径</p><div className="flex flex-wrap gap-2">{related.map(path=>path&&<button key={path.id} onClick={()=>setSelectedId(path.id)} className="rounded-full border border-border px-3 py-1 text-xs hover:border-brass/60">{path.name}</button>)}</div></div>}<Link href="/codex"><Button className="w-full" variant="secondary">查看完整序列档案<ArrowRight className="size-4"/></Button></Link><p className="flex items-center gap-2 text-[11px] text-muted"><Sparkles className="size-3 text-brass"/>原创新艺术风格矢量牌面</p></CardContent></Card></aside></div></div>;
}
