"use client";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { CalendarCheck2, Coffee, Plus, SkipForward } from "lucide-react";
import { db } from "@/lib/db";
import { createHabit, logHabit } from "@/lib/repository";
import { localDay } from "@/lib/domain/time";
import type { HabitLog } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { Progress } from "@/components/ui/progress";
const SESSION_NOW = Date.now();
export default function HabitsPage(){
const habits=useLiveQuery(()=>db.habits.toArray(),[],[]),logs=useLiveQuery(()=>db.habitLogs.toArray(),[],[]),settings=useLiveQuery(()=>db.settings.get("app"),[]);const [title,setTitle]=useState(""),[fit,setFit]=useState("1"),[saved,setSaved]=useState(false);const today=localDay(new Date(),settings?.timezone);
function rate(id:string,days:number){const now=SESSION_NOW;const relevant=logs.filter(l=>l.habitId===id&&new Date(l.localDate).getTime()>=now-days*86400000);const success=relevant.filter(l=>l.status==="completed"||l.status==="backfilled").length;return Math.min(100,Math.round(success/days*100));}
async function add(){if(!title.trim())return;await createHabit(title.trim(),"以宽容连续为原则，不因中断清空长期进度。",Number(fit) as 0|0.5|1|1.5);setTitle("");setSaved(true);window.setTimeout(()=>setSaved(false),1500)}
return <div className="space-y-6"><div><p className="text-xs tracking-[.28em] text-brass">HABITS · 精神锚点</p><h1 className="serif mt-2 text-3xl">为失稳时期建立可恢复的锚点</h1><p className="mt-2 text-sm text-muted">完成、跳过、休息和补记都会保留历史；跳过与休息用于连接连续，而不是伪装完成。</p></div>
<Card><CardHeader><h2 className="serif text-xl">建立新的稳定锚点</h2></CardHeader><CardContent className="flex flex-col gap-3 sm:flex-row"><Input value={title} onChange={e=>setTitle(e.target.value)} placeholder="例如：睡前阅读 20 分钟"/><Select value={fit} onChange={e=>setFit(e.target.value)} className="sm:w-44"><option value="0">无关</option><option value="0.5">间接</option><option value="1">契合</option><option value="1.5">高度契合</option></Select><Button onClick={add}><Plus className="size-4"/>{saved?"已创建":"添加习惯"}</Button></CardContent></Card>
<div className="grid gap-5 lg:grid-cols-2">{habits.map(habit=>{const todayLog=logs.find(l=>l.habitId===habit.id&&l.localDate===today);return <Card key={habit.id}><CardHeader><div><h2 className="serif text-xl">{habit.title}</h2><p className="mt-1 text-xs text-muted">每天 · 宽限 {habit.graceDays} 天 · 契合度 ×{habit.actingFit}</p></div><Badge>{todayLog?({completed:"已完成",skipped:"已跳过",rest:"休息日",backfilled:"已补记"}[todayLog.status]):"未记录"}</Badge></CardHeader><CardContent className="space-y-5"><div className="grid grid-cols-2 gap-4"><div><div className="mb-1 flex justify-between text-xs"><span>近 7 天</span><span>{rate(habit.id,7)}%</span></div><Progress value={rate(habit.id,7)}/></div><div><div className="mb-1 flex justify-between text-xs"><span>近 30 天</span><span>{rate(habit.id,30)}%</span></div><Progress value={rate(habit.id,30)}/></div></div><div className="flex flex-wrap gap-2">{( [["completed","完成"],["skipped","跳过"],["rest","休息"],["backfilled","补记"]] as Array<[HabitLog["status"],string]>).map(([status,label])=><Button key={status} size="sm" variant={status==="completed"?"default":"secondary"} onClick={()=>logHabit(habit.id,status,today)}>{status==="completed"?<CalendarCheck2 className="size-4"/>:status==="skipped"?<SkipForward className="size-4"/>:<Coffee className="size-4"/>}{label}</Button>)}</div><p className="text-xs text-muted">连续只用于描述，不额外奖励，也不会因一次中断清空长期完成率。</p></CardContent></Card>})}{!habits.length&&<Card><CardContent className="py-16 text-center text-sm text-muted">还没有习惯。先建立一个可以在一周内完成三次的锚点。</CardContent></Card>}</div></div>}



