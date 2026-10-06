"use client";

import { useMemo, useState } from "react";
import { Download, FileJson, ListChecks } from "lucide-react";
import { buildContentAuditSnapshot, pendingRowsToCsv, toPendingExportRows, type ContentAuditRow } from "@/lib/lore/content-audit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/form";

const SNAPSHOT = buildContentAuditSnapshot();

function statusClass(status: ContentAuditRow["status"]) {
  if (status === "author" || status === "verified") return "border-moss/40 text-moss";
  if (status === "canon") return "border-brass/40 text-brass-bright";
  if (status === "unverified") return "border-warning/40 text-warning";
  return "border-danger/40 text-danger";
}

function statusLabel(status: ContentAuditRow["status"]) {
  if (status === "author") return "已核验能力";
  if (status === "canon") return "小说原文";
  if (status === "verified") return "全文核验";
  if (status === "unverified") return "未核验";
  return "待补充";
}

export function ContentAuditPanel() {
  const [category, setCategory] = useState("全部");
  const categories = useMemo(() => ["全部", ...new Set(SNAPSHOT.rows.map((row) => row.category))], []);
  const rows = useMemo(() => category === "全部" ? SNAPSHOT.rows : SNAPSHOT.rows.filter((row) => row.category === category), [category]);

  function download(name: string, content: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportJson() {
    download("sequence-lore-audit.json", JSON.stringify(SNAPSHOT, null, 2), "application/json");
  }

  function exportPendingCsv() {
    download("sequence-lore-pending.csv", pendingRowsToCsv(toPendingExportRows(SNAPSHOT)), "text/csv;charset=utf-8");
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <h2 className="serif text-xl">内容审计</h2>
          <p className="mt-1 text-xs text-muted">核对能力、配方与转盘实体；待补项只导出清单，不自动编造原著内容。</p>
        </div>
        <Badge className="border-warning/40 text-warning">{SNAPSHOT.pending.length} 项待补</Badge>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="panel-soft rounded-md p-3">
            <p className="text-xs text-muted">能力覆盖</p>
            <p className="serif mt-1 text-2xl">{SNAPSHOT.summary.withAbilityEvidence} / {SNAPSHOT.summary.sequences}</p>
            <p className="mt-1 text-[11px] text-muted">作者 {SNAPSHOT.summary.authorAbilities} · 小说原文 {SNAPSHOT.summary.novelAbilities}</p>
          </div>
          <div className="panel-soft rounded-md p-3">
            <p className="text-xs text-muted">待补能力</p>
            <p className="serif mt-1 text-2xl text-warning">{SNAPSHOT.summary.undisclosedAbilities}</p>
            <p className="mt-1 text-[11px] text-muted">仅在资料库与审计页显示</p>
          </div>
          <div className="panel-soft rounded-md p-3">
            <p className="text-xs text-muted">魔药配方</p>
            <p className="serif mt-1 text-2xl">{SNAPSHOT.summary.formulas}</p>
            <p className="mt-1 text-[11px] text-muted">覆盖 {SNAPSHOT.summary.formulaPathways} 条途径</p>
          </div>
          <div className="panel-soft rounded-md p-3">
            <p className="text-xs text-muted">转盘实体</p>
            <p className="serif mt-1 text-2xl">{Object.values(SNAPSHOT.summary.entities).reduce((sum, count) => sum + count, 0)}</p>
            <p className="mt-1 text-[11px] text-muted">人物/组织/地点/事件/物品</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {Object.entries(SNAPSHOT.summary.entities).map(([key, count]) => (
            <div key={key} className="rounded-md border border-border bg-panel-soft p-3 text-xs">
              <div className="flex items-center justify-between"><span className="text-muted">{key}</span><strong>{count}</strong></div>
              <p className="mt-1 text-[10px] text-muted">未核验 {SNAPSHOT.summary.unverified[key] ?? 0}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <label className="mb-1.5 block text-xs font-medium text-muted-strong" htmlFor="lore-audit-category">筛选类别</label>
            <Select id="lore-audit-category" value={category} onChange={(event) => setCategory(event.target.value)}>
              {categories.map((item) => <option key={item} value={item}>{item}</option>)}
            </Select>
          </div>
          <Button variant="secondary" onClick={exportJson}><FileJson className="size-4" />导出审计 JSON</Button>
          <Button variant="secondary" onClick={exportPendingCsv}><Download className="size-4" />导出待补 CSV</Button>
        </div>

        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="bg-panel-soft text-muted">
              <tr><th className="px-3 py-2 font-medium">类别</th><th className="px-3 py-2 font-medium">名称</th><th className="px-3 py-2 font-medium">状态</th><th className="px-3 py-2 font-medium">来源</th><th className="px-3 py-2 font-medium">引用</th><th className="px-3 py-2 font-medium">说明</th></tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-border/60">
                  <td className="px-3 py-2 text-muted">{row.category}</td>
                  <td className="max-w-[280px] px-3 py-2">{row.name}</td>
                  <td className="px-3 py-2"><Badge className={statusClass(row.status)}>{statusLabel(row.status)}</Badge></td>
                  <td className="px-3 py-2 text-muted">{row.source}</td>
                  <td className="px-3 py-2 text-muted">{row.citationCount}</td>
                  <td className="max-w-[360px] px-3 py-2 text-muted">{row.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <div className="p-6 text-center text-sm text-muted"><ListChecks className="mx-auto mb-2 size-5" />当前筛选没有记录。</div>}
        </div>
      </CardContent>
    </Card>
  );
}