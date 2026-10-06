"use client";
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ExternalLink, Search } from "lucide-react";
import { LORE_EVIDENCE, LORE_EVIDENCE_LABEL, getLoreEvidence } from "@/lib/lore/evidence";
import { db } from "@/lib/db";
import { PATHWAYS, SEQUENCES, getSequence, sequenceSearch } from "@/lib/lore/pathways";
import type { SequenceRank } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FormulaPanel } from "@/components/formula-panel";
import { getAuthorFormula, pathwaysWithFormulas } from "@/lib/lore/author-content";
import { Input, Select } from "@/components/ui/form";

export default function CodexPage() {
  const state=useLiveQuery(()=>db.sequenceState.get("active"),[]);
  const [pathwayId,setPathwayId]=useState(state?.pathwayId??"fool");
  const [sequence,setSequence]=useState<SequenceRank>(state?.sequence??9);
  const [query,setQuery]=useState("");
  const results=useMemo(()=>sequenceSearch(query).slice(0,60),[query]);
  const currentPathway=PATHWAYS.find(i=>i.id===pathwayId)??PATHWAYS[0];
  const current=getSequence(currentPathway.id,sequence)??currentPathway.sequences[0];
  const evidence=getLoreEvidence(currentPathway.id,sequence);
  // 作者（乌贼）发布的配方：静态读取，保证在序列详情里可见。
  const authorFormula=getAuthorFormula(currentPathway.id,sequence);
  const pathwaysWithAuthorFormula=pathwaysWithFormulas();
  // 作者资料未覆盖的途径（如愚者）回落到原作全文里的配方/能力原文。
  const novelFormula=(evidence?.evidence ?? []).filter(item=>item.kind==="formula").slice(0,4);
  const novelAbility=(evidence?.evidence ?? []).filter(item=>item.kind==="ability").slice(0,4);
  return <div className="space-y-6">
    <div><p className="text-xs tracking-[.28em] text-brass">CODEX · 亵渎石板</p><h1 className="serif mt-2 text-3xl">22 条途径，220 个序列</h1><p className="mt-2 text-sm text-muted">原作配方、能力、扮演守则和晋升仪式仅作档案展示；资料未核验处会明确标记。</p><div className="mt-3 flex gap-2"><Badge>名称索引 {SEQUENCES.length}/220</Badge><Badge>原文证据 {LORE_EVIDENCE.coverage.withEvidence}/220</Badge><Badge>证据片段 {LORE_EVIDENCE.coverage.evidenceItems}</Badge><Badge>作者配方 {pathwaysWithAuthorFormula.length}/22 途径</Badge></div></div><FormulaPanel/>
    <FormulaPanel/>
    <Card><CardContent className="grid gap-3 sm:grid-cols-3"><div><label className="mb-1.5 block text-xs text-muted">途径</label><Select value={pathwayId} onChange={e=>{setPathwayId(e.target.value);setSequence(9)}}>{PATHWAYS.map(i=><option key={i.id} value={i.id}>{i.name}途径</option>)}</Select></div><div><label className="mb-1.5 block text-xs text-muted">序列</label><Select value={sequence} onChange={e=>setSequence(Number(e.target.value) as SequenceRank)}>{currentPathway.sequences.map(i=><option key={i.id} value={i.sequence}>序列 {i.sequence} · {i.name}</option>)}</Select></div><div><label className="mb-1.5 block text-xs text-muted">全库搜索</label><div className="relative"><Search className="absolute left-3 top-3 size-4 text-muted"/><Input value={query} onChange={e=>setQuery(e.target.value)} className="pl-9" placeholder="搜索途径或序列"/></div></div></CardContent></Card>
    {query?<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{results.map(item=><button key={item.id} className="panel rounded-lg p-4 text-left" onClick={()=>{setPathwayId(item.pathwayId);setSequence(item.sequence);setQuery("")}}><div className="flex items-center justify-between"><Badge>{item.pathwayName}途径</Badge><span className="text-xs text-muted">序列 {item.sequence}</span></div><h2 className="serif mt-3 text-xl">{item.name}</h2><p className="mt-2 line-clamp-2 text-xs text-muted">{item.abilities[0]}</p></button>)}</div>:<div className="grid gap-5 xl:grid-cols-[280px_1fr]">
      <Card><CardHeader><div><h2 className="serif text-lg">{currentPathway.name}途径</h2><p className="mt-1 text-xs text-muted">{currentPathway.tarot} · {currentPathway.sefirah}</p></div></CardHeader><CardContent className="space-y-2">{currentPathway.sequences.map(item=><button key={item.id} onClick={()=>setSequence(item.sequence)} className={"flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm "+(item.sequence===sequence?"bg-brass/15 text-brass-bright":"hover:bg-panel-soft")}><span>序列 {item.sequence}</span><span>{item.name}</span></button>)}</CardContent></Card>
      <Card><CardHeader><div><div className="flex flex-wrap gap-2"><Badge>序列 {current.sequence}</Badge><Badge>{current.loreStatus}</Badge></div><h2 className="serif mt-3 text-3xl">{current.name}</h2></div></CardHeader><CardContent className="space-y-6"><section><h3 className="serif text-lg">原作能力</h3>{current.abilities.length>0?<ul className="mt-2 space-y-1 text-sm leading-6 text-muted">{current.abilities.map(item=><li key={item}>· {item}</li>)}</ul>:novelAbility.length>0?<ul className="mt-2 space-y-3 text-sm leading-6 text-muted">{novelAbility.map(item=><li key={item.line}><span className="text-[11px] text-muted">{item.chapter} · 行 {item.line}</span><p className="mt-1">“{item.quote}”</p></li>)}</ul>:<p className="mt-2 text-sm text-muted">该序列的能力档案待补充。</p>}</section><section className="grid gap-5 md:grid-cols-2"><div><h3 className="serif text-lg">魔药配方</h3>{authorFormula&&<div className="mt-2 space-y-1 rounded-md border border-brass/30 bg-brass/5 p-3 text-xs leading-6">{authorFormula.main&&<p><span className="text-muted">主材料：</span>{authorFormula.main}</p>}{authorFormula.auxiliary&&<p><span className="text-muted">辅助材料：</span>{authorFormula.auxiliary}</p>}{authorFormula.potionLook&&<p><span className="text-muted">魔药外观：</span>{authorFormula.potionLook}</p>}{authorFormula.traitLook&&<p><span className="text-muted">非凡特性外观：</span>{authorFormula.traitLook}</p>}{authorFormula.mythicForm&&<p><span className="text-muted">神话生物形态：</span>{authorFormula.mythicForm}</p>}</div>}{authorFormula&&<div className="mt-2 space-y-1 rounded-md border border-brass/30 bg-brass/5 p-3 text-xs leading-6">{authorFormula.main&&<p><span className="text-muted">主材料：</span>{authorFormula.main}</p>}{authorFormula.auxiliary&&<p><span className="text-muted">辅助材料：</span>{authorFormula.auxiliary}</p>}{authorFormula.potionLook&&<p><span className="text-muted">魔药外观：</span>{authorFormula.potionLook}</p>}{authorFormula.traitLook&&<p><span className="text-muted">非凡特性外观：</span>{authorFormula.traitLook}</p>}{authorFormula.mythicForm&&<p><span className="text-muted">神话生物形态：</span>{authorFormula.mythicForm}</p>}</div>}{!authorFormula&&novelFormula.length>0&&<div className="mt-2 space-y-2 rounded-md border border-border bg-panel-soft p-3 text-xs leading-6">{novelFormula.map(item=><div key={item.line}><span className="text-[11px] text-muted">{item.chapter} · 行 {item.line}</span><p className="mt-1">“{item.quote}”</p></div>)}</div>}{authorFormula&&<p className="mt-3 text-[11px] text-muted">以下为本站核验索引中的材料线索：</p>}<p className="mt-2 text-xs text-muted">主材料</p>{current.mainIngredients.length?<ul className="mt-1 space-y-1 text-sm">{current.mainIngredients.map(i=><li key={i}>{i}</li>)}</ul>:<p className="mt-1 text-sm text-muted">原作未披露或待核验。</p>}<p className="mt-3 text-xs text-muted">辅助材料</p>{current.auxiliaryIngredients.length?<ul className="mt-1 space-y-1 text-sm">{current.auxiliaryIngredients.map(i=><li key={i}>{i}</li>)}</ul>:<p className="mt-1 text-sm text-muted">原作未披露或待核验。</p>}</div><div><h3 className="serif text-lg">扮演守则</h3>{current.actingPrinciples.length?<ul className="mt-2 space-y-2 text-sm leading-6 text-muted">{current.actingPrinciples.map(i=><li key={i}>· {i}</li>)}</ul>:<p className="mt-2 text-sm leading-6 text-muted">原作扮演守则待逐条核验；可在角色页建立安全现实映射。</p>}</div></section><section><h3 className="serif text-lg">晋升仪式</h3><p className="mt-2 text-sm leading-6 text-muted">{current.advancementRitual??"本序列原作档案中没有必需的晋升仪式。"}</p></section><section className="border-t border-border pt-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="serif text-lg">本地全文证据</h3><Badge>{evidence?.evidence.length ?? 0} 条匹配</Badge></div><p className="mt-2 text-xs leading-5 text-muted">引用来自本地精校全文，只保留用于核验的短片段。版本指纹 {LORE_EVIDENCE.source.sha256.slice(0, 12)}。</p>{evidence?.evidence.length ? <div className="mt-3 space-y-3">{evidence.evidence.map(item => <blockquote key={item.line + "-" + item.kind} className="rounded-md border border-border/70 bg-panel-soft p-3"><div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-muted"><Badge>{LORE_EVIDENCE_LABEL[item.kind]}</Badge><span>{item.chapter}</span><span>· 行 {item.line}</span></div><p className="text-xs leading-6 text-muted-strong">“{item.quote}”</p></blockquote>)}</div> : <p className="mt-3 text-sm text-muted">本序列尚未在本地全文索引中找到可靠匹配。</p>}</section><section className="border-t border-border pt-4"><h3 className="text-xs text-muted">资料来源与核验日期</h3><div className="mt-2 flex flex-wrap gap-3">{current.sources.map(source=><a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs gold-text">{source.title}<ExternalLink className="size-3"/></a>)}</div></section></CardContent></Card>
    </div>}
    <p className="text-xs leading-5 text-muted">非官方个人同人工具。原作名称与设定版权归原作者及相关权利方所有；本站不提供商业服务，也不会把危险仪式转换为现实指令。</p>
  </div>;
}









