"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { Brain, Check, ChevronRight, Clock3, Dices, Eye, FileText, History, ImagePlus, LoaderCircle, MapPin, Plus, RotateCcw, Save, Sparkles, X } from "lucide-react";
import { db } from "@/lib/db";
import { calculateDigestionCap, calculateStatusAverage, statusBand } from "@/lib/domain/digestion";
import { localDay } from "@/lib/domain/time";
import { getPathway, getSequence } from "@/lib/lore/pathways";
import { acceptTaskProposal, branchFromCheckpoint, getActiveCharacterBackground, getActiveFateProfile, rejectTaskProposal, updateTaskProposal } from "@/lib/repository";
import { fateSummary } from "@/lib/wheel/engine";
import { createNamedCheckpoint, generateAdventure, generateScene, getAdventureStatus, startOpening, submitStoryTurn, undoLatestStoryTurn, type AdventureStatus } from "@/lib/adventure/service";
import { detectSensitiveInput } from "@/lib/adventure/privacy";
import { checkProse, type ProseIssue } from "@/lib/domain/prose-check";
import { clientAIConfigHeader } from "@/lib/ai/client-config";
import type { AdventureEvent, CharacterBackground, FateProfile, StoryInputMode } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Input, Select, Textarea } from "@/components/ui/form";
import { PathwayTarot } from "@/components/pathway-tarot";
import { PersonalProfileDialog } from "@/components/personal-profile-dialog";
import { WorldStatePanel } from "@/components/world-state-panel";
import { TimelineTree } from "@/components/timeline-tree";

const modeLabels: Record<StoryInputMode, string> = { auto: "自动", action: "行动", dialogue: "对白", observe: "观察", thought: "内心" };

function safeQuery<T>(query: () => Promise<T>, fallback: T) {
  return () => query().catch((error) => {
    console.error("SEQUENCE 查询失败", error);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new ErrorEvent("error", {
        message: error instanceof Error ? error.message : String(error),
        error,
      }));
    }
    return fallback;
  });
}

export function AdventureConsole() {
  const profile=useLiveQuery(()=>db.personalProfile.get("me"),[]);
  const state=useLiveQuery(()=>db.sequenceState.get("active"),[]);
  const settings=useLiveQuery(()=>db.settings.get("app"),[]);
  const events=useLiveQuery(safeQuery(()=>db.adventureEvents.orderBy("createdAt").reverse().toArray(), [] as AdventureEvent[]),[],[] as AdventureEvent[]);
  const turns=useLiveQuery(safeQuery(()=>db.storyTurns.orderBy("createdAt").reverse().toArray(), []),[],[]);
  const checkpoints=useLiveQuery(safeQuery(()=>db.storyCheckpoints.orderBy("createdAt").reverse().toArray(), []),[],[]);
  const storyThreads=useLiveQuery(safeQuery(()=>db.storyThreads.orderBy("createdAt").reverse().toArray(), []),[],[]);
  const worldStates=useLiveQuery(()=>db.worldStates.toArray(),[],[]);
  const actors=useLiveQuery(()=>db.storyActors.toArray(),[],[]);
  const storyItems=useLiveQuery(()=>db.storyItems.toArray(),[],[]);
  const flags=useLiveQuery(()=>db.storyFlags.toArray(),[],[]);
  const fate=useLiveQuery(()=>getActiveFateProfile(),[],null as FateProfile | null);
  const background=useLiveQuery(()=>getActiveCharacterBackground(),[],null as CharacterBackground | null);
  const sceneAssets=useLiveQuery(()=>db.sceneAssets.toArray(),[],[]);
  const [status,setStatus]=useState<AdventureStatus|null>(null);
  const [loading,setLoading]=useState(false);
  const [message,setMessage]=useState("");
  const [focusId,setFocusId]=useState<string|null>(null);
  const [profileOpen,setProfileOpen]=useState(false);
  const [historyOpen,setHistoryOpen]=useState(false);const [worldOpen,setWorldOpen]=useState(false);const [directoryOpen,setDirectoryOpen]=useState(false);const [fontSize,setFontSize]=useState<"sm"|"base"|"lg">("base");
  const [input,setInput]=useState("");
  const [mode,setMode]=useState<StoryInputMode>("auto");
  const [streaming,setStreaming]=useState("");
  const [narrationError,setNarrationError]=useState("");
  const [viewOffset,setViewOffset]=useState(0);  const [rewrites,setRewrites]=useState<Record<number,string>>({});
  const [rewriting,setRewriting]=useState<number|null>(null);
  const today=localDay(new Date(),settings?.timezone);
  const todayEvent=events.find((event)=>event.localDate===today&&event.kind==="daily")??null;
  const activeEvent=events.find((event)=>event.id===focusId)??todayEvent??events[0]??null;
  const threadId=activeEvent?.threadId??null;
  const threadTurns=threadId?turns.filter((turn)=>turn.threadId===threadId):[];
  const latestTurn=threadTurns[0]??null;
  const worldState=threadId?worldStates.find((item)=>item.threadId===threadId):null;const currentThread=threadId?storyThreads.find((item)=>item.id===threadId):null;const deathPending=worldState?.protagonistState==="dead"&&currentThread?.status!=="completed";
  const threadActors=threadId?actors.filter((actor)=>!actor.threadId||actor.threadId===threadId):[];
  const threadItems=threadId?storyItems.filter((item)=>item.threadId===threadId):[];
  const threadFlags=threadId?flags.filter((flag)=>!flag.threadId||flag.threadId===threadId):[];
  const asset=activeEvent?sceneAssets.find((item)=>item.id===activeEvent.imageAssetId):null;
  useEffect(()=>{getAdventureStatus().then(setStatus)},[]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(()=>{if(typeof window==="undefined")return;const saved=window.localStorage.getItem("sequence-reading-size");if(saved==="sm"||saved==="base"||saved==="lg")setFontSize(saved)},[]);
  useEffect(()=>{if(typeof window!=="undefined")window.localStorage.setItem("sequence-reading-size",fontSize)},[fontSize]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(()=>{if(!threadId)return;const raw=window.localStorage.getItem("sequence-reading-"+threadId);setViewOffset(raw?Number(raw)||0:0)},[threadId]);
  useEffect(()=>{if(threadId)window.localStorage.setItem("sequence-reading-"+threadId,String(viewOffset))},[threadId,viewOffset]);
  if(!profile||!state||!settings||!state.pathwayId)return null;
  const pathway=getPathway(state.pathwayId);const sequence=getSequence(state.pathwayId,state.sequence);
  if(!pathway||!sequence)return null;
  const cap=calculateDigestionCap(state.sequence,settings);const average=calculateStatusAverage(settings.status);const band=statusBand(average);
  async function submit(text=input,modeOverride:StoryInputMode=mode){
    const clean=text.trim();if(!clean||!threadId)return;
    if(detectSensitiveInput(clean)&&!window.confirm("输入中检测到疑似邮箱、电话、地址或证件信息。确认仍要发送给已配置的 AI 服务吗？"))return;
    setLoading(true);setStreaming("");
    try{await submitStoryTurn({threadId,userInput:clean,mode:modeOverride,onDelta:(delta)=>setStreaming((current)=>current+delta)});setInput("");setStreaming("")}
    catch(error){setMessage(error instanceof Error?error.message:"行动推进失败")}finally{setLoading(false)}
  }
  async function undo(){if(!threadId||!window.confirm("撤回上一回合并建立新的时间线？旧时间线会保留。"))return;setLoading(true);try{const thread=await undoLatestStoryTurn(threadId);if(activeEvent)setFocusId(activeEvent.id);setMessage("已从最近存档点建立新时间线：" + thread.title)}catch(error){setMessage(error instanceof Error?error.message:"撤回失败")}finally{setLoading(false)}}
  async function checkpoint(){if(!threadId)return;const label=window.prompt("存档点名称：","关键抉择前");if(!label)return;await createNamedCheckpoint(threadId,label);setMessage("存档点已创建：" + label)}
  async function branch(checkpointId:string){setLoading(true);try{if(!window.confirm("从该存档点建立平行时间线？旧时间线会保留。"))return;const thread=await branchFromCheckpoint(checkpointId);setFocusId(thread.eventId);setHistoryOpen(false);setMessage("已从存档点建立平行时间线：" + thread.title)}catch(error){setMessage(error instanceof Error?error.message:"建立分支失败")}finally{setLoading(false)}}
  async function rollbackFromDeath(){if(!threadId)return;setLoading(true);try{const latest=checkpoints.filter((item)=>item.threadId===threadId).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0];if(!latest)throw new Error("没有可用存档点");const thread=await branchFromCheckpoint(latest.id);setFocusId(thread.eventId);setMessage("已回到最近存档点并建立平行时间线。现实数据不变。")}catch(error){setMessage(error instanceof Error?error.message:"回退失败")}finally{setLoading(false)}}
  async function acceptEnding(){if(!threadId)return;await db.storyThreads.update(threadId,{status:"completed",updatedAt:new Date().toISOString()});setMessage("已接受当前结局；现实等级、XP、任务和背包不会被删除。")}
  async function explore(){setLoading(true);try{const {event}=await generateAdventure("manual");setFocusId(event.id)}catch(error){setMessage(error instanceof Error?error.message:"主动探查失败")}finally{setLoading(false)}}
  async function startChapter(){if(!threadId)return;setLoading(true);setStreaming("");setNarrationError("");setViewOffset(0);try{await startOpening(threadId,(delta)=>setStreaming((current)=>current+delta));setStreaming("")}catch(error){setStreaming("");setNarrationError(error instanceof Error?error.message:"第一章生成失败")}finally{setLoading(false)}}
  async function spinOpen(){setLoading(true);try{const kind = todayEvent ? "manual" : "daily";const {event}=await generateAdventure(kind);setFocusId(event.id);setMessage(kind === "manual" ? "今日章节已存在，已按命运档案生成一个额外事件。" : "已按命运档案生成本章。")}catch(error){setMessage(error instanceof Error?error.message:"用转盘开局失败")}finally{setLoading(false)}}
  async function accept(id:string){if(!activeEvent)return;try{await acceptTaskProposal(activeEvent.id,id);setMessage("委托已写入非凡委托中心。")}catch(error){setMessage(error instanceof Error?error.message:"采纳失败")}}
  async function reject(id:string){if(!activeEvent)return;try{await rejectTaskProposal(activeEvent.id,id);setMessage("已拒绝该现实提案；不会产生任何惩罚。")}catch(error){setMessage(error instanceof Error?error.message:"拒绝失败")}}
  async function updateProposal(id:string,patch:{realityAction:string;successCriteria:string;estimatedMinutes:number}){if(!activeEvent)return;try{await updateTaskProposal(activeEvent.id,id,patch);setMessage("现实提案已修改，仍然可以选择采纳或拒绝。")}catch(error){setMessage(error instanceof Error?error.message:"修改失败")}}
  async function createImage(){if(!activeEvent)return;setLoading(true);const result=await generateScene(activeEvent);setLoading(false);if(!result)setMessage("图像服务不可用，保留程序化场景。")}
  const viewedTurn=threadTurns[Math.min(viewOffset,Math.max(0,threadTurns.length-1))]??latestTurn;
  const openingPending=Boolean(threadId)&&threadTurns.length===0;
  const rawText=streaming||viewedTurn?.chapterText||(openingPending?"":(activeEvent?.opening??""));
  const displayText=rawText.trim();
  const paragraphs=displayText.split(/\n{2,}/).map((part)=>part.trim()).filter(Boolean);
  const fontSizeClass=fontSize==="sm"?"text-sm leading-7":fontSize==="lg"?"text-xl leading-10":"text-base leading-8 sm:text-lg sm:leading-9";
  const chapterIndex=Math.max(1,threadTurns.length-Math.min(viewOffset,Math.max(0,threadTurns.length-1)));  // 本地规则校验（不调用模型）：把读起来不像原著的地方列出来
  const proseIssues: ProseIssue[] = displayText ? checkProse(displayText) : [];
  async function rewriteSentence(issue: ProseIssue){
    setRewriting(issue.index);
    try{
      const response=await fetch("/api/adventure/rewrite",{method:"POST",headers:{"Content-Type":"application/json",...clientAIConfigHeader()},body:JSON.stringify({sentence:issue.sentence,reason:issue.label})});
      const payload=await response.json() as {sentence?:string;error?:string};
      if(payload.sentence)setRewrites((current)=>({...current,[issue.index]:payload.sentence as string}));
      else setMessage(payload.error||"重写失败");
    }catch(error){setMessage(error instanceof Error?error.message:"重写失败")}finally{setRewriting(null)}
  }
  const viewedChapterTitle=viewedTurn?.chapterTitle||(openingPending?"灰雾尚未回信":activeEvent?.title??"灰雾尚未回信");
  const viewedProviderLabel=viewedTurn&&viewedTurn.provider?" · "+viewedTurn.provider:"";
  const suggestions=latestTurn?.suggestedChoices.length?latestTurn.suggestedChoices:(activeEvent?.choices??[]).map((choice)=>({id:choice.id,label:choice.label,description:choice.description}));
  return <div className="space-y-4">
    <PersonalProfileDialog open={profileOpen||profile.consentVersion===0} onClose={()=>setProfileOpen(false)} required={profile.consentVersion===0}/>
    <section className="adventure-shell relative min-h-[calc(100vh-9rem)] overflow-hidden rounded-xl border border-border">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(165,140,86,.2),transparent_36%),linear-gradient(145deg,#05090c,#11191c_52%,#06080d)]"/>
      {asset&&<div className="absolute inset-0 bg-cover bg-center opacity-40" style={{backgroundImage:"url("+asset.dataUrl+")"}}/>}<div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/85"/>
      <div className="relative z-10 grid min-h-[calc(100vh-9rem)] lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-h-[760px] flex-col p-4 sm:p-7 lg:min-h-0">
          <header className="flex items-start justify-between gap-4"><div><p className="text-[10px] tracking-[.32em] text-brass">THE GREY FOG ABOVE · MULTI-TURN CHRONICLE</p><h1 className="serif mt-2 text-2xl text-[#f0e6ce] sm:text-3xl">{viewedTurn?.chapterTitle?`第 ${chapterIndex} 章 · ${viewedTurn.chapterTitle}`:openingPending?`第一章 · ${viewedChapterTitle}`:activeEvent?.title??"灰雾尚未回信"}</h1>{worldState&&<p className="mt-1 text-[11px] text-muted">{worldState.timeLabel} · {worldState.location}</p>}{background&&<p className="mt-2 text-[11px] text-muted">{background.fields.name} · {background.fields.occupation} · {fate?.attributes.find((attribute)=>attribute.categoryId==="codename")?.optionLabel??"未定代号"} · {background.fields.origin}</p>}</div><div className="flex gap-2"><Button variant="ghost" size="icon" onClick={()=>setWorldOpen(true)} aria-label="世界状态"><Eye className="size-4"/></Button><Button variant="ghost" size="icon" onClick={()=>setHistoryOpen(true)} aria-label="时间线"><History className="size-4"/></Button><Button variant="ghost" size="icon" onClick={checkpoint} aria-label="创建存档点"><Save className="size-4"/></Button></div></header>
          <div className="my-5 flex-1 overflow-y-auto pr-1"><div className="mb-4 flex flex-wrap gap-2">{activeEvent?.systemMessages.map((item)=><Badge key={item}>{item}</Badge>)}{worldState?.canonDivergence.length?<Badge className="border-warning/40 text-warning">平行时间线</Badge>:null}</div>{deathPending&&<div className="mb-4 rounded-lg border border-danger/50 bg-danger/10 p-4 text-sm"><p className="font-medium text-danger">当前时间线已经走到死亡或严重失控节点。</p><p className="mt-1 text-xs leading-6 text-muted">现实数据不会随剧情失败删除。你可以回到最近存档、打开时间线选择更早的存档点，或接受这个结局。</p><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="secondary" onClick={rollbackFromDeath}>回到最近存档</Button><Button size="sm" variant="ghost" onClick={()=>setHistoryOpen(true)}>打开时间线</Button><Button size="sm" variant="ghost" onClick={acceptEnding}>接受结局</Button></div></div>}{loading&&!streaming&&<div className="grid min-h-80 place-items-center text-center"><div><LoaderCircle className="mx-auto size-8 animate-spin text-brass"/><p className="mt-3 text-sm text-muted">正在读取灰雾与命运的分叉……</p></div></div>}{narrationError&&<div role="alert" className="mb-4 rounded-lg border border-danger/60 bg-danger/10 p-4 text-sm text-danger"><p className="font-medium">正文没有生成成功</p><p className="mt-1 text-xs leading-6">{narrationError}</p><p className="mt-2 text-xs text-muted">已为你保留上一章内容；可以直接重试，不会写入半成品。</p><div className="mt-3 flex gap-2">{openingPending?<Button size="sm" onClick={startChapter} disabled={loading}>重试生成第一章</Button>:<Button size="sm" onClick={()=>submit()} disabled={loading||!input.trim()}>重试本轮</Button>}<Button size="sm" variant="ghost" onClick={()=>setNarrationError("")}>关闭提示</Button></div></div>}
{openingPending&&!displayText&&!loading&&!narrationError&&<div className="grid min-h-80 place-items-center text-center"><div>{background?<><Sparkles className="mx-auto size-9 text-brass"/><p className="mt-3 text-sm">{background.fields.name} · {background.fields.occupation}</p><p className="mt-1 max-w-md text-xs leading-6 text-muted">人物档案已就绪。点下面的按钮生成第一章（约 1500–2500 字），之后就能自由输入行动继续冒险。</p><Button className="mt-4" onClick={startChapter}>开始第一章</Button></>:<><Eye className="mx-auto size-9 text-brass"/><p className="mt-3 text-sm">还没有人物档案。</p><p className="mt-1 text-xs text-muted">去「命运转盘」抽命运并生成人物背景，再回来开始第一章。</p><Link href="/wheel"><Button className="mt-4" variant="secondary"><Dices className="size-4"/>去命运转盘</Button></Link></>}</div></div>}
{!displayText&&!openingPending&&!narrationError&&<div className="grid min-h-80 place-items-center text-center"><div><Eye className="mx-auto size-9 text-brass"/><p className="mt-3 text-sm text-muted">输入行动，或点击一个建议继续本章。</p></div></div>}
{displayText&&<article className={"rounded-lg border border-[#b9a56f]/30 bg-[#080d10]/88 p-5 font-serif text-[#eee4cd] shadow-2xl "+fontSizeClass}>{viewedTurn?.chapterTitle&&<h2 className="serif mb-4 text-xl text-brass-bright">{viewedTurn.chapterTitle}</h2>}{paragraphs.map((paragraph,index)=><p key={index} className="mb-4 last:mb-0">{paragraph}</p>)}{loading&&streaming&&<span className="animate-pulse">▋</span>}</article>}
{displayText&&<div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[11px] text-muted"><span>第 {chapterIndex} 章 · {viewedTurn?.chapterTitle??"未命名章节"} · 本章 {displayText.length} 字{viewedProviderLabel}</span><span className="flex flex-wrap items-center gap-2"><button type="button" className="underline" onClick={()=>setDirectoryOpen(true)}>目录</button><span className="inline-flex overflow-hidden rounded border border-border">{[["sm","简"],["base","中"],["lg","大"]].map(([key,label])=><button key={key} type="button" onClick={()=>setFontSize(key as "sm"|"base"|"lg")} className={(fontSize===key?"bg-brass/20 text-brass-bright ":"")+"px-2 py-0.5"}>{label}</button>)}</span><button type="button" className="underline disabled:no-underline disabled:opacity-40" disabled={viewOffset>=threadTurns.length-1} onClick={()=>setViewOffset((value)=>Math.min(threadTurns.length-1,value+1))}>← 上一章</button><button type="button" className="underline disabled:no-underline disabled:opacity-40" disabled={viewOffset<=0} onClick={()=>setViewOffset((value)=>Math.max(0,value-1))}>下一章 →</button></span></div>}
{viewedTurn&&!streaming&&<StateChanges turn={viewedTurn}/>}
<details className="mt-4 rounded-lg border border-warning/40 bg-warning/5 p-3" open={proseIssues.length > 0}>
  <summary className="cursor-pointer text-xs text-warning">出戏清单（本地规则校验）：{proseIssues.length} 处</summary>
  {proseIssues.length === 0 ? <p className="mt-2 text-[11px] text-muted">没有发现违和之处。</p> : (
    <div className="mt-2 space-y-2">
      {proseIssues.map((issue) => (
        <div key={issue.index} className="rounded-md border border-border bg-panel-soft p-2 text-[11px]">
          <div className="flex flex-wrap items-center gap-2"><Badge>第 {issue.index} 句</Badge><span className="text-warning">{issue.label}</span></div>
          <p className="mt-1 text-muted">{issue.hint}</p>
          <p className="mt-1 italic">“{issue.sentence.slice(0, 80)}”</p>
          <div className="mt-2"><Button size="sm" variant="secondary" disabled={rewriting === issue.index} onClick={() => rewriteSentence(issue)}>{rewriting === issue.index ? "重写中…" : "只重写这句"}</Button></div>
          {rewrites[issue.index] && <p className="mt-2 rounded-sm border border-moss/40 bg-moss/10 p-2 text-moss">改后：{rewrites[issue.index]}</p>}
        </div>
      ))}
    </div>
  )}
</details></div>
          {activeEvent?.proposals.some((proposal)=>proposal.proposalStatus==="pending")&&<TaskProposals event={activeEvent} onAccept={accept} onReject={reject} onUpdate={updateProposal}/>}
          <div className="mt-5 border-t border-border/60 pt-4"><div className="mb-3 flex flex-wrap gap-2">{suggestions.map((choice)=><button key={choice.id} onClick={()=>submit(choice.label,"auto")} className="rounded-full border border-border bg-panel-soft px-3 py-2 text-xs transition hover:border-brass/60 hover:text-brass"><span className="font-medium">{choice.label}</span><span className="ml-2 text-muted">{choice.description}</span></button>)}</div><div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-brass/30 bg-brass/5 p-3"><Dices className="size-4 text-brass"/>{fate?<><span className="text-xs text-muted">命运档案</span><span className="text-xs">{fateSummary(fate)}</span><Button size="sm" variant="secondary" onClick={spinOpen} disabled={loading}>用转盘开局</Button></>:<><span className="text-xs text-muted">还没有命运档案，可先去转盘抽一次。</span><Link href="/wheel"><Button size="sm" variant="secondary"><Dices className="size-3"/>去转盘</Button></Link></>}</div><div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-brass/30 bg-brass/5 p-3"><Dices className="size-4 text-brass"/>{fate?<><span className="text-xs text-muted">命运档案</span><span className="text-xs">{fateSummary(fate)}</span><Button size="sm" variant="secondary" onClick={spinOpen} disabled={loading}>用转盘开局</Button></>:<><span className="text-xs text-muted">还没有命运档案，可先去转盘抽一次。</span><Link href="/wheel"><Button size="sm" variant="secondary"><Dices className="size-3"/>去转盘</Button></Link></>}</div><div className="rounded-lg border border-border bg-[#060b0e]/90 p-3"><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><Select value={mode} onChange={(event)=>setMode(event.target.value as StoryInputMode)} className="h-8 w-28 text-xs">{Object.entries(modeLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</Select><div className="flex gap-2"><Button variant="secondary" size="sm" onClick={undo} disabled={loading||!latestTurn}><RotateCcw className="size-3"/>撤回</Button><Button variant="secondary" size="sm" onClick={explore} disabled={loading}><Sparkles className="size-3"/>主动探查</Button></div></div><Textarea value={input} onChange={(event)=>setInput(event.target.value)} onKeyDown={(event)=>{if(event.key==="Enter"&&(event.ctrlKey||event.metaKey))void submit()}} placeholder="输入你想采取的行动、想说的话、观察对象或内心念头…… Ctrl/⌘+Enter 发送" className="min-h-24"/><div className="mt-3 flex items-center justify-between gap-3"><p className="text-[10px] text-muted">自由输入优先；推荐选项不是限制。敏感信息会先确认。</p><Button onClick={()=>submit()} disabled={loading||!input.trim()}><ChevronRight className="size-4"/>{loading?"推进中":"推进回合"}</Button></div></div></div>
        </div>
        <aside className="border-t border-border/70 bg-[#070d10]/82 p-5 backdrop-blur-xl lg:border-l lg:border-t-0"><div className="mx-auto w-[175px]"><PathwayTarot pathway={pathway}/></div><div className="mt-3 text-center"><Badge>序列 {state.sequence}</Badge><h2 className="serif mt-2 text-2xl">{sequence.name}</h2><p className="mt-1 text-xs text-muted">{pathway.name}途径</p></div><div className="mt-5"><div className="mb-2 flex justify-between text-xs"><span className="text-muted">消化度</span><span>{state.digestion}/{cap}</span></div><Progress value={state.digestion} max={cap}/></div><div className="mt-5 grid grid-cols-2 gap-2">{Object.entries(settings.status).map(([key,value])=><div key={key} className="panel-soft rounded-md p-3"><div className="text-[10px] uppercase text-muted">{key}</div><div className="mt-1 flex items-end justify-between"><strong className="serif text-xl">{value}</strong><span className="text-[10px] text-muted">{value<30?"危险":value<60?"波动":"稳定"}</span></div></div>)}</div><div className="mt-5 space-y-3 text-xs"><Info icon={MapPin} label="时间地点" value={worldState?`${worldState.timeLabel} · ${worldState.location}`:"尚未确定"}/><Info icon={Clock3} label="人物状态" value={worldState?.protagonistState??"alive"}/><Info icon={Brain} label="开放线索" value={String(worldState?.openThreads.filter((thread)=>thread.status==="open").length??0)}/>{(threadActors.length>0||threadItems.length>0||threadFlags.length>0)&&<div className="rounded-md border border-border/70 p-3"><p className="mb-2 text-muted">剧情状态</p>{threadActors.slice(0,3).map((actor)=><div key={actor.id} className="flex justify-between"><span>{actor.name}</span><span className="gold-text">{actor.relationship>0?"+":""}{actor.relationship}</span></div>)}{threadItems.filter((item)=>item.status==="held").slice(0,4).map((item)=><div key={item.id} className="mt-1 truncate">{item.name}</div>)}{threadFlags.slice(0,4).map((flag)=><div key={flag.id} className="mt-1 flex justify-between"><span>{flag.label||flag.key}</span><span className="gold-text">{flag.value}</span></div>)}</div>}</div><div className="mt-4 flex flex-col gap-2"><Button variant="secondary" onClick={()=>setProfileOpen(true)}><Brain className="size-4"/>编辑生活画像</Button>{activeEvent&&!asset&&status?.imageConfigured&&<Button variant="ghost" onClick={createImage}><ImagePlus className="size-4"/>生成章节插画</Button>}<Link href="/quests"><Button className="w-full"><FileText className="size-4"/>查看非凡委托</Button></Link></div><p className="mt-4 text-center text-[10px] text-muted">稳定度 {average} · {band.label}</p></aside>
      </div>
    </section>
    {message&&<div className="fixed bottom-24 right-4 z-50 max-w-sm rounded-md border border-brass/40 bg-panel-solid p-3 text-sm shadow-xl sm:bottom-6"><div className="flex gap-3"><Check className="mt-0.5 size-4 text-moss"/><span>{message}</span><button onClick={()=>setMessage("")} aria-label="关闭消息"><X className="size-4"/></button></div></div>}
    <Dialog open={historyOpen} onClose={()=>setHistoryOpen(false)} title="命运时间线" className="max-w-3xl"><div className="max-h-[70vh] overflow-y-auto"><TimelineTree threads={storyThreads} checkpoints={checkpoints} turns={turns} events={events} currentThreadId={threadId} onSelect={(eventId)=>{setFocusId(eventId);setHistoryOpen(false)}} onBranch={branch}/></div></Dialog>
    <Dialog open={worldOpen} onClose={()=>setWorldOpen(false)} title="世界状态" className="max-w-3xl">{worldState?<WorldStatePanel worldState={worldState} actors={threadActors} items={threadItems} flags={threadFlags}/>:<p className="text-sm text-muted">还没有可读取的世界状态。先开始第一章。</p>}</Dialog>
    <Dialog open={directoryOpen} onClose={()=>setDirectoryOpen(false)} title="章节目录" className="max-w-2xl"><div className="max-h-[70vh] space-y-2 overflow-y-auto">{threadTurns.map((turn,index)=><button key={turn.id} type="button" onClick={()=>{setViewOffset(index);setDirectoryOpen(false)}} className="flex w-full items-center justify-between gap-3 rounded-md border border-border bg-panel-soft p-3 text-left text-sm hover:border-brass/50"><span className="min-w-0 flex-1 truncate text-left">第 {threadTurns.length-index} 章 · {turn.chapterTitle||"未命名章节"}</span><span className="text-xs text-muted">{turn.chapterText.length} 字 · {new Date(turn.createdAt).toLocaleString("zh-CN")}</span></button>)}{!threadTurns.length&&<p className="text-sm text-muted">还没有章节。先开始第一章。</p>}</div></Dialog>
  </div>;
}

function StateChanges({turn}:{turn:import("@/lib/types").StoryTurn}){const changes=turn.operations.filter((op)=>op.type!=="add_fact").slice(0,6);return changes.length?<div className="mt-4 rounded-md border border-border bg-panel-soft p-3"><p className="text-[10px] tracking-[.2em] text-brass">状态变化</p><div className="mt-2 flex flex-wrap gap-2">{changes.map((op,index)=><Badge key={index}>{operationLabel(op)}</Badge>)}</div></div>:null}
function operationLabel(op:import("@/lib/types").TurnOperation){if(op.type==="adjust_flag")return `${op.label} ${op.delta>0?"+":""}${op.delta}`;if(op.type==="upsert_actor")return `人物：${op.name}`;if(op.type==="add_item")return `获得：${op.name}`;if(op.type==="remove_item")return `失去：${op.name}`;if(op.type==="canon_divergence")return "平行时间线变化";if(op.type==="set_protagonist_state")return `状态：${op.state}`;if(op.type==="open_thread")return `线索：${op.title}`;if(op.type==="add_task_proposal")return `现实委托：${op.proposal.title}`;return op.type}
function TaskProposals({event,onAccept,onReject,onUpdate}:{event:AdventureEvent;onAccept:(id:string)=>void;onReject:(id:string)=>void;onUpdate:(id:string,patch:{realityAction:string;successCriteria:string;estimatedMinutes:number})=>void}){
  const pending=event.proposals.filter((proposal)=>proposal.proposalStatus==="pending").slice(-2);
  const [editing,setEditing]=useState<string|null>(null);
  const [draft,setDraft]=useState({realityAction:"",successCriteria:"",estimatedMinutes:30});
  function beginEdit(proposal:AdventureEvent["proposals"][number]){setEditing(proposal.id);setDraft({realityAction:proposal.realityAction,successCriteria:proposal.successCriteria,estimatedMinutes:proposal.estimatedMinutes})}
  return <div className="mb-4 rounded-lg border border-brass/25 bg-brass/5 p-4">
    <div className="mb-3 flex items-center justify-between"><div><h2 className="serif text-lg">剧情触发的现实委托</h2><p className="mt-1 text-xs text-muted">叙事标题不能掩盖现实行动；可采纳、修改或拒绝，拒绝不会扣分。</p></div><Badge>{pending.length}</Badge></div>
    <div className="grid gap-3 md:grid-cols-2">{pending.map((proposal)=><div key={proposal.id} className="rounded-md border border-border bg-panel-soft p-3">
      <Badge>{proposal.type==="main"?"主委托":"支线"}</Badge>
      <h3 className="serif mt-2">{proposal.narrativeTitle}</h3>
      <p className="mt-2 text-xs text-muted">{proposal.narrativeDescription}</p>
      <div className="mt-3 rounded bg-black/15 p-3 text-xs"><strong>现实行动</strong><p className="mt-1">{proposal.realityAction}</p><p className="mt-2 text-muted">完成标准：{proposal.successCriteria}</p></div>
      <div className="mt-3 flex flex-wrap gap-2"><Badge>{proposal.estimatedMinutes} 分钟</Badge><Badge>难度 {proposal.difficulty}</Badge>{proposal.safetyNotes.map((note)=><Badge key={note} className="border-warning/40 text-warning">{note}</Badge>)}</div>
      {editing===proposal.id&&<div className="mt-3 space-y-2 rounded-md border border-brass/30 p-3">
        <label className="block text-[11px] text-muted">现实行动<Input value={draft.realityAction} onChange={(event)=>setDraft({...draft,realityAction:event.target.value})}/></label>
        <label className="block text-[11px] text-muted">完成标准<Input value={draft.successCriteria} onChange={(event)=>setDraft({...draft,successCriteria:event.target.value})}/></label>
        <label className="block text-[11px] text-muted">预计分钟<Input type="number" value={draft.estimatedMinutes} onChange={(event)=>setDraft({...draft,estimatedMinutes:Number(event.target.value)})}/></label>
        <Button size="sm" onClick={()=>{onUpdate(proposal.id,draft);setEditing(null)}}>保存修改</Button>
      </div>}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={()=>onAccept(proposal.id)}><Plus className="size-3"/>采纳</Button>
        <Button size="sm" variant="secondary" onClick={()=>beginEdit(proposal)}>修改</Button>
        <Button size="sm" variant="ghost" onClick={()=>onReject(proposal.id)}>拒绝</Button>
      </div>
    </div>)}</div>
  </div>
}
function Info({icon:Icon,label,value}:{icon:typeof Brain;label:string;value:string}){return <div className="flex items-start gap-2"><Icon className="mt-0.5 size-3.5 text-brass"/><span className="text-muted">{label}</span><span className="ml-auto max-w-[170px] text-right">{value}</span></div>}
















