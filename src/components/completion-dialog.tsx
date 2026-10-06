"use client";
import { motion } from "framer-motion";
import { RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { undoCompletion } from "@/lib/repository";
import { useUIStore } from "@/lib/store";
import { ACTING_FIT_LABEL } from "@/lib/domain/digestion";

export function CompletionDialog() {
  const completion = useUIStore((state) => state.completion);
  const close = useUIStore((state) => state.closeCompletion);
  if (!completion) return null;
  async function undo() {
    await undoCompletion(completion!.id);
    close();
  }
  return <Dialog open onClose={close} title="魔药消化结算">
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="text-center">
        <div className="mx-auto mb-3 grid size-14 place-items-center rounded-full border border-brass/40 bg-brass/10 text-brass-bright"><Sparkles className="size-6" /></div>
        <h3 className="serif text-xl">{completion.questTitle}</h3>
        <p className="mt-1 text-sm text-muted">结算已写入不可变历史，可随时撤销。</p>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Metric label="基础值" value={completion.baseDigestion} />
        <Metric label="质量倍率" value={`×${completion.qualityMultiplier}`} />
        <Metric label="状态倍率" value={`×${completion.statusMultiplier}`} />
        <Metric label="扮演契合" value={ACTING_FIT_LABEL[completion.actingFit]} />
      </div>
      <div className="panel-soft rounded-lg p-4">
        <div className="mb-2 flex items-center justify-between"><span className="text-sm text-muted">本次消化度</span><strong className="serif text-2xl gold-text">+{completion.digestionAwarded}</strong></div>
        <Progress value={completion.digestionAwarded} max={Math.max(completion.baseDigestion * 3, 1)} />
        <p className="mt-2 text-xs text-muted">灵性经验 +{completion.spiritualityAwarded}；实际用时 {completion.actualMinutes} 分钟。</p>
      </div>
      {completion.actingFit === 0 && <p className="rounded-md border border-warning/30 bg-warning/10 p-3 text-xs text-warning">该任务标记为“无关”，只增加灵性经验与属性，不推进魔药消化。</p>}
      <div className="rounded-md border border-moss/25 bg-moss/10 p-3"><p className="text-[10px] tracking-[.2em] text-moss">仪式回声</p><p className="mt-2 text-xs leading-5 text-muted-strong">灰雾记录下这次现实行动。消化值来自透明公式，剧情不会额外覆盖奖励；下一次事件会参考你的选择与当前状态。</p></div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={undo}><RotateCcw className="size-4" />撤销完成</Button>
        <Button onClick={close}>确认记录</Button>
      </div>
    </motion.div>
  </Dialog>;
}
function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="panel-soft rounded-md p-3 text-center"><div className="text-[11px] text-muted">{label}</div><div className="mt-1 font-medium">{value}</div></div>;
}


