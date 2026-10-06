"use client";
import { useState } from "react";
import { Activity, Brain, HeartPulse, Zap } from "lucide-react";
import type { Settings } from "@/lib/types";
import { calculateStatusAverage, calculateStatusMultiplier, statusBand } from "@/lib/domain/digestion";
import { checkInStatus } from "@/lib/repository";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/form";

const fields: Array<{ key: keyof Settings["status"]; label: string; icon: typeof Brain }> = [
  { key: "san", label: "SAN 理智", icon: Brain },
  { key: "energy", label: "体力", icon: HeartPulse },
  { key: "focus", label: "专注", icon: Zap },
  { key: "motivation", label: "动力", icon: Activity },
];

export function StatusCheckIn({ settings }: { settings: Settings }) {
  const [values, setValues] = useState(settings.status);
  const [saved, setSaved] = useState(false);
  const average = calculateStatusAverage(values);
  const multiplier = calculateStatusMultiplier(average);
  const band = statusBand(average);
  async function save() { await checkInStatus(values); setSaved(true); window.setTimeout(() => setSaved(false), 1800); }
  return <Card><CardHeader><div><h2 className="serif text-lg">状态记录</h2><p className="mt-1 text-xs text-muted">平均 60 为中性；数值直接影响消化倍率，但不会随机触发惩罚。</p></div><span className="text-sm gold-text">×{multiplier.toFixed(2)}</span></CardHeader><CardContent className="space-y-5">{fields.map((field) => { const value=values[field.key]; const Icon=field.icon; return <label key={field.key} className="block"><span className="mb-2 flex items-center justify-between text-xs"><span className="flex items-center gap-1.5 text-muted-strong"><Icon className="size-3.5" />{field.label}</span><strong>{value}</strong></span><Input type="range" min="0" max="100" value={value} onChange={(event) => setValues((current) => ({ ...current, [field.key]: Number(event.target.value) }))} className="h-2 cursor-pointer border-0 bg-transparent p-0" /></label>; })}<div className="flex items-center justify-between"><span className={band.className === "danger" ? "text-danger" : band.className === "warning" ? "text-warning" : "text-moss"}>{band.label} · 平均 {average}</span><Button size="sm" onClick={save}>{saved ? "已记录" : "保存状态"}</Button></div></CardContent></Card>;
}
