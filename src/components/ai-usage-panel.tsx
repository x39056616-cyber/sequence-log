"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Activity, Gauge, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

/** 粗略估算：中文按约 1.5 字符/token 估算，只用于本地趋势观察。 */
function estimateTokens(chars: number) {
  return Math.ceil(chars / 1.5);
}

export function AIUsagePanel() {
  const logs = useLiveQuery(() => db.aiRequestLogs.orderBy("createdAt").reverse().limit(50).toArray(), [], []);

  const totals = logs.reduce((sum, log) => {
    const inputChars = log.promptChars ?? log.contextPreview.length;
    const outputChars = log.outputChars ?? 0;
    return {
      calls: sum.calls + 1,
      inputChars: sum.inputChars + inputChars,
      outputChars: sum.outputChars + outputChars,
      elapsedMs: sum.elapsedMs + (log.elapsedMs ?? 0),
    };
  }, { calls: 0, inputChars: 0, outputChars: 0, elapsedMs: 0 });

  async function clearUsage() {
    if (!window.confirm("只清除本地 AI 用量记录，不会影响故事、任务或备份。确认继续？")) return;
    await db.aiRequestLogs.clear();
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <h2 className="serif flex items-center gap-2 text-xl"><Gauge className="size-4 text-brass" />AI 用量与成本估算</h2>
          <p className="mt-1 text-xs text-muted">只统计当前浏览器里的最近请求；字符/token 为粗略估算，不代表供应商标单。</p>
        </div>
        <Button variant="ghost" onClick={() => void clearUsage()}><Trash2 className="size-4" />清空用量记录</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="panel-soft rounded-md p-3"><p className="text-xs text-muted">最近请求</p><p className="serif mt-1 text-2xl">{totals.calls}</p></div>
          <div className="panel-soft rounded-md p-3"><p className="text-xs text-muted">输入估算</p><p className="serif mt-1 text-2xl">{estimateTokens(totals.inputChars)}</p><p className="text-[10px] text-muted">tokens · {totals.inputChars} 字符</p></div>
          <div className="panel-soft rounded-md p-3"><p className="text-xs text-muted">输出估算</p><p className="serif mt-1 text-2xl">{estimateTokens(totals.outputChars)}</p><p className="text-[10px] text-muted">tokens · {totals.outputChars} 字符</p></div>
          <div className="panel-soft rounded-md p-3"><p className="text-xs text-muted">累计耗时</p><p className="serif mt-1 text-2xl">{Math.round(totals.elapsedMs / 1000)}s</p></div>
        </div>

        <div className="space-y-2">
          {logs.slice(0, 12).map((log) => (
            <div key={log.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-panel-soft p-3 text-xs">
              <span className="flex items-center gap-2"><Activity className="size-3 text-brass" />{log.provider} · {log.model}</span>
              <span className="text-muted">{log.protocol} · {new Date(log.createdAt).toLocaleString("zh-CN")}</span>
              <span className="text-muted">输入 {estimateTokens(log.promptChars ?? log.contextPreview.length)} / 输出 {estimateTokens(log.outputChars ?? 0)} tokens</span>
              <span className="text-muted">{log.elapsedMs ? Math.round(log.elapsedMs / 1000) + "s" : "—"}</span>
              <Badge>{log.status}</Badge>
            </div>
          ))}
          {!logs.length && <p className="text-xs text-muted">还没有 AI 用量记录。生成一次人物背景或推进一章后，这里会出现本地统计。</p>}
        </div>
      </CardContent>
    </Card>
  );
}