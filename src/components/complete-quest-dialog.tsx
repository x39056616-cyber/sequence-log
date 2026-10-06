"use client";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { Calculator, LoaderCircle } from "lucide-react";
import type { Quality, Quest } from "@/lib/types";
import { calculateDigestion, QUALITY_MULTIPLIER } from "@/lib/domain/digestion";
import { completeQuest } from "@/lib/repository";
import { createRealityEcho } from "@/lib/adventure/service";
import { useUIStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/form";

export function CompleteQuestDialog({ quest, onClose }: { quest: Quest | null; onClose: () => void }) {
  const settings = useLiveQuery(() => db.settings.get("app"), []);
  const [quality, setQuality] = useState<Quality>("done");
  const [actualMinutes, setActualMinutes] = useState(quest?.estimatedMinutes ?? 30);
  const [adjustment, setAdjustment] = useState("0");
  const [saving, setSaving] = useState(false);
  const showCompletion = useUIStore((state) => state.showCompletion);
  if (!quest || !settings) return null;
  const preview = calculateDigestion(quest, quality, settings, Number(adjustment || 0));
  async function submit() {
    if (!quest) return;
    setSaving(true);
    try { const completion = await completeQuest(quest.id, { quality, actualMinutes, manualAdjustment: Number(adjustment || 0) }); showCompletion(completion); void createRealityEcho(quest, completion).catch(() => {}); onClose(); }
    finally { setSaving(false); }
  }
  return <Dialog open onClose={onClose} title="仪式结束 · 消化结算">
    <div className="space-y-5">
      <div>{quest.narrativeTitle&&<p className="text-[10px] tracking-[.2em] text-brass">{quest.narrativeTitle}</p>}<p className="serif mt-1 text-xl">{quest.title}</p>{quest.realityAction&&<p className="mt-2 text-xs leading-5 text-muted">现实行动：{quest.realityAction}</p>}<p className="mt-2 text-xs text-muted">结算会同时写入灵性经验与魔药消化事件。</p></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><Label>完成质量</Label><Select value={quality} onChange={(event) => setQuality(event.target.value as Quality)}><option value="missed">未达成 · ×0.5</option><option value="done">完成 · ×1.0</option><option value="good">良好 · ×1.5</option><option value="excellent">卓越 · ×2.0</option></Select></div>
        <div><Label>实际分钟</Label><Input type="number" value={actualMinutes} onChange={(event) => setActualMinutes(Number(event.target.value))} /></div>
      </div>
      <div><Label>手动调整消化值</Label><Input type="number" value={adjustment} onChange={(event) => setAdjustment(event.target.value)} /><p className="mt-1 text-xs text-muted">仅用于修正异常情况，调整会记录在账本中。</p></div>
      <div className="panel-soft rounded-lg p-4">
        <div className="mb-3 flex items-center gap-2 text-xs text-muted"><Calculator className="size-4" />透明计算预览</div>
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4"><Preview label="基础" value={preview.base} /><Preview label="质量" value={`×${QUALITY_MULTIPLIER[quality]}`} /><Preview label="状态" value={`×${preview.statusMultiplier.toFixed(2)}`} /><Preview label="契合" value={`×${quest.actingFit}`} /></div>
        <div className="mt-4 flex items-end justify-between"><span className="text-sm text-muted">预计获得消化度</span><strong className="serif text-3xl gold-text">{preview.awarded}</strong></div>
        <p className="mt-2 text-xs text-muted">计算值 {preview.computed}，保底 {preview.minimum}，默认上限 {preview.maximum}。</p>
      </div>
      <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>取消</Button><Button onClick={submit} disabled={saving}>{saving && <LoaderCircle className="size-4 animate-spin" />}完成结算</Button></div>
    </div>
  </Dialog>;
}
function Preview({ label, value }: { label: string; value: string | number }) { return <div className="rounded-md border border-border/70 p-3 text-center"><div className="text-[11px] text-muted">{label}</div><div className="mt-1 font-medium">{value}</div></div>; }





